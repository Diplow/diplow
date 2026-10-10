// The server bus, in-process, on Effect's PubSub. A domain publishes a fact (src/domains/bus.ts); the
// API layer, which alone composes domains, wires who reacts with `on`, in ./run.ts. Each event rides
// in an envelope with who acted, which this layer reads from the request. Published inside a
// transaction, it waits for the commit (`AfterCommit`), and a rollback drops it. Each subscription
// reads the PubSub from its own fiber, which lives as long as the runtime, not the request, and
// finishes inside the request that published through the platform's waitUntil. A lost event is
// acceptable: the day a subscriber cannot be lost, the bus moves to an outbox table.
import { Context, Deferred, Effect, Layer, Option, PubSub, Schema } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { CurrentKey, CurrentSession, type SignedIn, signedInBy } from '#/domains/iam/iam'
import { AfterCommit } from '#/repositories/database/database'

/**
 * Hands work to the platform, which keeps the request's function up until the work is done (Vercel's
 * `waitUntil`). The helper (./run.ts) provides it to each request's program.
 */
export class WaitUntil extends Context.Service<WaitUntil, (work: Effect.Effect<void>) => void>()(
  'hexframe/WaitUntil',
) {}

/**
 * What the bus carries: the event, as its domain declared it, and who acted, the signed-in Account and
 * the proof that gave it, a Session or a Key, filled from the request; none when nobody signed in. A
 * domain's event never holds an actor.
 */
export interface Envelope {
  readonly event: DomainEvent
  readonly actor: Option.Option<SignedIn>
}

/** A reaction to one event, wired by the API layer with `on`. */
export interface Subscription<R> {
  readonly accepts: (event: DomainEvent) => boolean
  readonly handle: (envelope: Envelope) => Effect.Effect<void, unknown, R>
}

/**
 * Reacts to every event `event`, the schema its domain declares, accepts, with who acted. A
 * subscriber that fails is reported; neither the publisher nor the other subscribers hear of it.
 */
export function on<A extends DomainEvent, R>(
  event: Schema.Codec<A, unknown>,
  react: (event: A, actor: Envelope['actor']) => Effect.Effect<void, unknown, R>,
): Subscription<R> {
  const accepts = Schema.is(event)
  return {
    accepts,
    handle: ({ event: published, actor }) =>
      accepts(published) ? react(published, actor) : Effect.void,
  }
}

/** What the PubSub carries: an envelope, and one slot per subscription, completed once it has reacted. */
interface Delivery {
  readonly envelope: Envelope
  readonly handled: ReadonlyArray<Deferred.Deferred<undefined> | undefined>
}

/**
 * Who acted, as the request proves it, by IAM's rule: none outside a request, or when nothing proves
 * it.
 */
const actor = Effect.gen(function* () {
  const session = yield* Effect.serviceOption(CurrentSession)
  const key = yield* Effect.serviceOption(CurrentKey)
  return signedInBy(Option.flatten(session), Option.flatten(key))
})

// A bus message is logged at `medium` (../report/observability/levels.ts), by its tag, never its fields.
const logged = (message: string) =>
  Effect.annotateLogs(Effect.log(message), { bus: 'server', topic: 'bus' })

function deliver<R>(subscription: Subscription<R>, slot: number) {
  return ({ envelope, handled }: Delivery) => {
    const done = handled[slot]
    if (done === undefined) return Effect.void
    const { event } = envelope
    // Suspended, so a reaction that throws while building its effect is caught like one that fails.
    return Effect.suspend(() => subscription.handle(envelope)).pipe(
      // An error line with its cause: Sentry gets it, and PostHog an `error` event pointing to it.
      Effect.catchCause((cause) =>
        Effect.logError(`A subscriber to ${event._tag} failed`, cause).pipe(
          Effect.annotateLogs({ bus: 'server', code: event._tag }),
        ),
      ),
      Effect.ensuring(Deferred.succeed(done, undefined)),
    )
  }
}

/** Hands an envelope to every subscription, and their reactions to the platform's waitUntil. */
function delivered<R>(
  pubsub: PubSub.PubSub<Delivery>,
  subscriptions: ReadonlyArray<Subscription<R>>,
) {
  return (envelope: Envelope) =>
    Effect.gen(function* () {
      const { event } = envelope
      const handled = subscriptions.map((subscription) =>
        subscription.accepts(event) ? Deferred.makeUnsafe<undefined>() : undefined,
      )
      yield* logged(`${event._tag} published`)
      yield* PubSub.publish(pubsub, { envelope, handled })
      const reactions = handled.filter((done) => done !== undefined)
      const waitUntil = yield* Effect.serviceOption(WaitUntil)
      if (reactions.length > 0 && Option.isSome(waitUntil)) {
        waitUntil.value(Effect.forEach(reactions, Deferred.await, { discard: true }))
      }
    })
}

/**
 * Publishes an event in its envelope, who acted read from the request now. Inside a transaction it
 * waits for the commit, and a rollback, a refusal's included, drops it; outside one it goes at once.
 */
function publish<R>(
  pubsub: PubSub.PubSub<Delivery>,
  subscriptions: ReadonlyArray<Subscription<R>>,
) {
  const toSubscribers = delivered(pubsub, subscriptions)
  return (event: DomainEvent) =>
    Effect.gen(function* () {
      const delivery = toSubscribers({ event, actor: yield* actor })
      const afterCommit = yield* Effect.serviceOption(AfterCommit)
      yield* Option.isSome(afterCommit) ? afterCommit.value(delivery) : delivery
    })
}

/**
 * The bus, with every subscription the API layer wires. Each reads the PubSub in its own fiber, in
 * the order events were published, until the runtime is disposed. The layer requires what the
 * subscriptions use, the repositories, so it is built over them (./run.ts).
 */
export function serverBus<R>(subscriptions: ReadonlyArray<Subscription<R>>) {
  return Layer.effect(Bus)(
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<Delivery>()
      yield* Effect.forEach(subscriptions, (subscription, slot) =>
        Effect.gen(function* () {
          const inbox = yield* PubSub.subscribe(pubsub)
          const next = Effect.flatMap(PubSub.take(inbox), deliver(subscription, slot))
          yield* Effect.forkScoped(Effect.forever(next))
        }),
      )
      return { publish: publish(pubsub, subscriptions) }
    }),
  )
}
