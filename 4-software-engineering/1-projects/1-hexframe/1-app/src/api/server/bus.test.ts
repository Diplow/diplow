import { describe, expect, it } from '@effect/vitest'
import { Deferred, Duration, Effect, Logger, References, Schema } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'

import { WaitUntil, on, serverBus, type Subscription } from './bus'

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

  it.effect('logs every event it carries at medium', () =>
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
        { message: ['DevHappened published'], annotations: { bus: 'server', verbosity: 'medium' } },
      ])
    }),
  )
})
