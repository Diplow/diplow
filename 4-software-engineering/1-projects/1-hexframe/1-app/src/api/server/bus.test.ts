import { describe, expect, it, layer } from '@effect/vitest'
import { Deferred, Duration, Effect, Exit, Logger, Option, References, Schema } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { CurrentKey, CurrentSession } from '#/domains/iam/iam'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'

import { type Envelope, WaitUntil, on, serverBus, type Subscription } from './bus'

// Two events, named for the test rather than in a domain's language.
class DevHappened extends Schema.TaggedClass<DevHappened>()('DevHappened', { n: Schema.Number }) {}
class DevOther extends Schema.TaggedClass<DevOther>()('DevOther', {}) {}

const bus = <R>(...subscriptions: ReadonlyArray<Subscription<R>>) => serverBus(subscriptions)

/** Publishes as a request's program does, and returns the work it handed to waitUntil. */
const published = (event: DomainEvent) =>
  Effect.gen(function* () {
    const kept: Array<Effect.Effect<void>> = []
    const { publish } = yield* Bus
    yield* publish(event).pipe(Effect.provideService(WaitUntil, (work) => void kept.push(work)))
    return kept
  })

/** Publishes, then waits as the platform does for what the request handed to waitUntil. */
const settled = (event: DomainEvent) =>
  Effect.flatMap(published(event), (kept) => Effect.all(kept, { discard: true }))

describe('the server bus', () => {
  it.effect('delivers an event to the subscriptions its schema accepts, and to no other', () =>
    Effect.gen(function* () {
      const seen: Array<string> = []
      yield* Effect.all([settled(new DevHappened({ n: 1 })), settled(new DevOther())]).pipe(
        Effect.provide(
          bus(
            on(DevHappened, ({ n }) => Effect.sync(() => seen.push(`happened ${String(n)}`))),
            on(DevOther, () => Effect.sync(() => seen.push('other'))),
          ),
        ),
      )
      expect(seen).toEqual(['happened 1', 'other'])
    }),
  )

  it.effect('hands waitUntil work that settles once every subscriber has reacted', () =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<undefined>()
      let reacted = false
      const slow = on(DevHappened, () =>
        Effect.map(Deferred.await(gate), () => {
          reacted = true
        }),
      )
      yield* Effect.gen(function* () {
        const kept = yield* published(new DevHappened({ n: 1 }))
        expect([kept.length, reacted]).toEqual([1, false])
        yield* Deferred.succeed(gate, undefined)
        yield* Effect.all(kept)
        expect(reacted).toBe(true)
      }).pipe(Effect.provide(bus(slow)))
    }),
  )

  it.effect('hands waitUntil nothing when no subscription accepts the event', () =>
    Effect.gen(function* () {
      const kept = yield* published(new DevOther()).pipe(
        Effect.provide(bus(on(DevHappened, () => Effect.void))),
      )
      expect(kept).toEqual([])
    }),
  )

  it.effect('keeps a failing subscriber from the publisher and the other subscribers', () =>
    Effect.gen(function* () {
      const seen: Array<number> = []
      yield* settled(new DevHappened({ n: 1 })).pipe(
        Effect.provide(
          bus(
            on(DevHappened, () => Effect.die(new Error('a bug in a subscriber'))),
            on(DevHappened, ({ n }) => Effect.sync(() => seen.push(n))),
          ),
        ),
      )
      expect(seen).toEqual([1])
    }),
  )

  it.effect('keeps a subscription listening after its reaction throws instead of failing', () =>
    Effect.gen(function* () {
      const seen: Array<number> = []
      const throwsOnFirst = on(DevHappened, ({ n }) => {
        if (n === 1) throw new Error('a bug before the effect is built')
        return Effect.sync(() => seen.push(n))
      })
      yield* Effect.all([
        settled(new DevHappened({ n: 1 })),
        settled(new DevHappened({ n: 2 })),
      ]).pipe(Effect.provide(bus(throwsOnFirst)))
      expect(seen).toEqual([2])
    }),
  )

  it.live('delivers to each subscription in the order events were published', () =>
    Effect.gen(function* () {
      const seen: Array<number> = []
      // The first event takes the longest to handle; it is still handled first.
      const slowerFirst = on(DevHappened, ({ n }) =>
        Effect.map(Effect.sleep(Duration.millis(4 - n)), () => {
          seen.push(n)
        }),
      )
      yield* Effect.gen(function* () {
        const kept = yield* Effect.forEach([1, 2, 3], (n) => published(new DevHappened({ n })))
        yield* Effect.all(kept.flat(), { concurrency: 'unbounded' })
      }).pipe(Effect.provide(bus(slowerFirst)))
      expect(seen).toEqual([1, 2, 3])
    }),
  )

  it.effect('logs every event it carries under the bus topic, which logs at medium', () =>
    Effect.gen(function* () {
      const lines: Array<{ message: unknown; annotations: unknown }> = []
      const capture = Logger.make(({ message, fiber }) => {
        lines.push({ message, annotations: fiber.getRef(References.CurrentLogAnnotations) })
      })
      yield* published(new DevHappened({ n: 1 })).pipe(
        Effect.provide(bus<never>()),
        Effect.provide(Logger.layer([capture])),
      )
      expect(lines).toEqual([
        { message: ['DevHappened published'], annotations: { bus: 'server', topic: 'bus' } },
      ])
    }),
  )
})

/** A bus whose one subscription keeps every envelope it hears, and what it heard. */
const listening = () => {
  const heard: Array<Envelope> = []
  const keep = on(DevHappened, (event, actor) =>
    Effect.sync(() => void heard.push({ event, actor })),
  )
  return { heard, bus: bus(keep) }
}

/** What the subscription heard, as tags, once the work handed to waitUntil has settled. */
const tags = (heard: ReadonlyArray<Envelope>) => heard.map(({ event }) => event._tag)

layer(TestDatabase)('the server bus, in a transaction', (it) => {
  it.effect('holds an event published inside a transaction until it commits', () =>
    Effect.gen(function* () {
      const { heard, bus: listened } = listening()
      const kept: Array<Effect.Effect<void>> = []
      yield* Effect.gen(function* () {
        const { publish } = yield* Bus
        const inside = yield* transactional(
          Effect.gen(function* () {
            yield* publish(new DevHappened({ n: 1 }))
            return kept.length
          }),
        )
        yield* Effect.all(kept, { discard: true })
        expect([inside, kept.length, tags(heard)]).toEqual([0, 1, ['DevHappened']])
      }).pipe(
        Effect.provide(listened),
        Effect.provideService(WaitUntil, (work) => void kept.push(work)),
      )
    }),
  )

  it.effect(
    'drops an event published in a transaction that rolls back, on a refusal or a defect',
    () =>
      Effect.gen(function* () {
        const { heard, bus: listened } = listening()
        const kept: Array<Effect.Effect<void>> = []
        yield* Effect.gen(function* () {
          const { publish } = yield* Bus
          const refused = yield* transactional(
            Effect.andThen(publish(new DevHappened({ n: 1 })), Effect.fail('refused')),
          ).pipe(Effect.exit)
          const died = yield* transactional(
            Effect.andThen(publish(new DevHappened({ n: 2 })), Effect.die(new Error('a bug'))),
          ).pipe(Effect.exit)
          expect([Exit.isFailure(refused), Exit.isFailure(died)]).toEqual([true, true])
        }).pipe(
          Effect.provide(listened),
          Effect.provideService(WaitUntil, (work) => void kept.push(work)),
        )
        expect([kept.length, heard]).toEqual([0, []])
      }),
  )
})

describe('the envelope', () => {
  const account = { id: 'a-1', email: 'ada@example.com' }

  /** Publishes on a request proven by a Session, a Key, or nothing, and answers what was heard. */
  const heardOn = (proofs: { session?: boolean; keyId?: string }) =>
    Effect.gen(function* () {
      const { heard, bus: listened } = listening()
      const session =
        proofs.session === true ? Option.some({ account, expiresAt: new Date() }) : Option.none()
      const key = Option.map(Option.fromNullishOr(proofs.keyId), (keyId) => ({ account, keyId }))
      yield* settled(new DevHappened({ n: 1 })).pipe(
        Effect.provide(listened),
        Effect.provideService(CurrentSession, session),
        Effect.provideService(CurrentKey, key),
      )
      return heard
    })

  it.effect(
    'carries the event as its domain declared it, and who acted, by the proof the request gave',
    () =>
      Effect.gen(function* () {
        const event = new DevHappened({ n: 1 })
        expect(yield* heardOn({ session: true })).toEqual([
          { event, actor: Option.some({ account, by: { _tag: 'Session' } }) },
        ])
        expect(yield* heardOn({ keyId: 'k-1' })).toEqual([
          { event, actor: Option.some({ account, by: { _tag: 'Key', keyId: 'k-1' } }) },
        ])
      }),
  )

  it.effect('carries no actor when nothing proves the request, or outside one', () =>
    Effect.gen(function* () {
      const { heard, bus: listened } = listening()
      yield* settled(new DevHappened({ n: 1 })).pipe(Effect.provide(listened))
      expect(yield* heardOn({})).toEqual([
        { event: new DevHappened({ n: 1 }), actor: Option.none() },
      ])
      expect(heard).toEqual([{ event: new DevHappened({ n: 1 }), actor: Option.none() }])
    }),
  )
})
