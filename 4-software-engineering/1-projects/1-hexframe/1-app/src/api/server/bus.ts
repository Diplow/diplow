// The server bus, in-process, on Effect's PubSub. A domain publishes a fact (src/domains/bus.ts); the
// API layer, which alone composes domains, wires who reacts with `on`, in ./run.ts. Each subscription
// reads the PubSub from its own fiber, which lives as long as the runtime, not the request, and
// finishes inside the request that published through the platform's waitUntil. A lost event is
// acceptable: the day a subscriber cannot be lost, the bus moves to an outbox table.
import { Context, Deferred, Effect, Layer, Option, PubSub, Schema } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'

/**
 * Hands work to the platform, which keeps the request's function up until the work is done (Vercel's
 * `waitUntil`). The helper (./run.ts) provides it to each request's program.
 */
export class WaitUntil extends Context.Service<WaitUntil, (work: Effect.Effect<void>) => void>()(
  'hexframe/WaitUntil',
) {}

/** A reaction to one event, wired by the API layer with `on`. */
export interface Subscription<R> {
  readonly accepts: (event: DomainEvent) => boolean
  readonly handle: (event: DomainEvent) => Effect.Effect<void, unknown, R>
}

/**
 * Reacts to every event `event`, the schema its domain declares, accepts. A subscriber that fails is
 * reported; neither the publisher nor the other subscribers hear of it.
 */
export function on<A extends DomainEvent, R>(
  event: Schema.Codec<A, unknown>,
  react: (event: A) => Effect.Effect<void, unknown, R>,
): Subscription<R> {
  const accepts = Schema.is(event)
  return { accepts, handle: (published) => (accepts(published) ? react(published) : Effect.void) }
}

/** What the PubSub carries: the event, and one slot per subscription, completed once it has reacted. */
interface Envelope {
  readonly event: DomainEvent
  readonly handled: ReadonlyArray<Deferred.Deferred<undefined> | undefined>
}

// Until HEX-19 sets the levels, a bus message is a log line tagged with the level it belongs to.
const logged = (message: string) =>
  Effect.annotateLogs(Effect.log(message), { bus: 'server', verbosity: 'medium' })

function deliver<R>(subscription: Subscription<R>, slot: number) {
  return ({ event, handled }: Envelope) => {
    const done = handled[slot]
    if (done === undefined) return Effect.void
    // Suspended, so a reaction that throws while building its effect is caught like one that fails.
    return Effect.suspend(() => subscription.handle(event)).pipe(
      Effect.catchCause((cause) => Effect.logError(`A subscriber to ${event._tag} failed`, cause)),
      Effect.ensuring(Deferred.succeed(done, undefined)),
    )
  }
}

function publish<R>(
  pubsub: PubSub.PubSub<Envelope>,
  subscriptions: ReadonlyArray<Subscription<R>>,
) {
  return (event: DomainEvent) =>
    Effect.gen(function* () {
      const handled = subscriptions.map((subscription) =>
        subscription.accepts(event) ? Deferred.makeUnsafe<undefined>() : undefined,
      )
      yield* logged(`${event._tag} published`)
      yield* PubSub.publish(pubsub, { event, handled })
      const reactions = handled.filter((done) => done !== undefined)
      const waitUntil = yield* Effect.serviceOption(WaitUntil)
      if (reactions.length > 0 && Option.isSome(waitUntil)) {
        waitUntil.value(Effect.forEach(reactions, Deferred.await, { discard: true }))
      }
    })
}

/**
 * The bus, with every subscription the API layer wires. Each reads the PubSub in its own fiber, in
 * the order events were published, until the runtime is disposed.
 */
export function serverBus<R>(subscriptions: ReadonlyArray<Subscription<R>>) {
  return Layer.effect(Bus)(
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<Envelope>()
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
