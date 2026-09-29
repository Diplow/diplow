import { describe, expect, it } from '@effect/vitest'
import { Cause, Effect, Exit, Layer, Option } from 'effect'
import { vi } from 'vitest'

import type { Session } from '#/domains/iam/iam'
import { Analytics, type AnalyticsEvent } from '#/repositories/observability/posthog-server'
import { captureError, startSentry } from '#/repositories/observability/sentry'
import { ErrorTracker, traced } from '#/repositories/observability/sentry-server'

import {
  CurrentRequestLog,
  called,
  failedUnexpectedly,
  logger,
  observedEntry,
  requestLog,
  sent,
  unobserved,
} from './server'

vi.mock('#/repositories/observability/sentry', async (original) => ({
  ...(await original<object>()),
  startSentry: vi.fn(),
  captureError: vi.fn(),
}))
vi.mock('#/repositories/observability/sentry-server', async (original) => ({
  ...(await original<object>()),
  traced: vi.fn((entry: unknown) => entry),
}))

/** PostHog, serving `flag` for the flag it is asked, or failing to answer when it is `null`. */
const posthog = (flag: unknown, asked: Array<string> = []) =>
  Layer.succeed(Analytics, {
    capture: () => undefined,
    flag: (key, distinctId) =>
      flag === null
        ? Effect.die(new Error('PostHog is unreachable'))
        : Effect.sync(() => {
            asked.push(`${key} ${distinctId}`)
            return flag
          }),
    flush: Effect.void,
  })

/** PostHog and Sentry, recorded: every event and every error. PostHog serves no flag. */
function recorded() {
  const events: Array<AnalyticsEvent> = []
  const errors: Array<{ error: unknown; tags: Readonly<Record<string, string>> }> = []
  const services = Layer.mergeAll(
    Layer.succeed(Analytics, {
      capture: (event) => void events.push(event),
      flag: () => Effect.succeed(undefined),
      flush: Effect.void,
    }),
    Layer.succeed(ErrorTracker, {
      capture: (error, tags) => {
        errors.push({ error, tags })
        return 'sentry-event-1'
      },
    }),
  )
  return { events, errors, layer: logger.pipe(Layer.provideMerge(services)) }
}

const signedOut: Exit.Exit<Option.Option<Session>> = Exit.succeed(Option.none())
const signedIn: Exit.Exit<Option.Option<Session>> = Exit.succeed(
  Option.some({ account: { id: 'account-1', email: 'ada@example.com' }, expiresAt: new Date() }),
)

/** Runs an effect inside a request, as the helper does, at the verbosity its log resolves to. */
const inRequest = <A, E, R>(effect: Effect.Effect<A, E, R>, session = signedOut) =>
  Effect.flatMap(requestLog({ requestId: 'req-1', scope: 'getTile', session }), (log) =>
    effect.pipe(Effect.provideService(CurrentRequestLog, log)),
  )

describe("the server's observability", () => {
  it.effect(
    'sends an unexpected failure to Sentry, and PostHog an error event carrying its id',
    () =>
      Effect.gen(function* () {
        const { events, errors, layer } = recorded()
        yield* inRequest(failedUnexpectedly(Cause.die(new Error('the database is down')))).pipe(
          Effect.provide(layer),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0]?.error).toEqual(new Error('the database is down'))
        expect(errors[0]?.tags).toEqual({
          requestId: 'req-1',
          scope: 'getTile',
          kind: 'Unexpected',
          code: 'Unexpected',
        })
        expect(events).toEqual([
          {
            event: 'error',
            distinctId: 'req-1',
            anonymous: true,
            properties: {
              requestId: 'req-1',
              scope: 'getTile',
              kind: 'Unexpected',
              code: 'Unexpected',
              message: 'A server function failed unexpectedly',
              sentryEventId: 'sentry-event-1',
            },
          },
        ])
      }),
  )

  it.effect('sends a declared failure to PostHog only, by its kind and tag', () =>
    Effect.gen(function* () {
      const { events, errors, layer } = recorded()
      yield* inRequest(sent({ _tag: 'EmailTaken', kind: 'Invalid' })).pipe(Effect.provide(layer))
      expect(errors).toEqual([])
      expect(events).toMatchObject([
        {
          event: 'error',
          properties: { kind: 'Invalid', code: 'EmailTaken', sentryEventId: undefined },
        },
      ])
    }),
  )

  it.effect("ties a signed-in request's events to its Account", () =>
    Effect.gen(function* () {
      const { events, layer } = recorded()
      yield* inRequest(called, signedIn).pipe(Effect.provide(layer))
      expect(events).toMatchObject([
        {
          event: 'call',
          distinctId: 'account-1',
          anonymous: false,
          properties: { scope: 'getTile' },
        },
      ])
    }),
  )

  it.effect("sends only the topics the request's verbosity logs", () =>
    Effect.gen(function* () {
      const busMessage = Effect.log('DevHappened published').pipe(
        Effect.annotateLogs({ topic: 'bus', bus: 'server' }),
      )
      const { events, layer } = recorded()
      const log = yield* requestLog({
        requestId: 'req-1',
        scope: 'getTile',
        session: signedIn,
      }).pipe(Effect.provide(layer))
      // At high, production's level, a bus message is not sent; at low, development's, it is.
      for (const verbosity of ['high', 'low'] as const) {
        yield* busMessage.pipe(
          Effect.provideService(CurrentRequestLog, { ...log, verbosity }),
          Effect.provide(layer),
        )
      }
      expect(events).toMatchObject([{ event: 'bus', properties: { bus: 'server' } }])
    }),
  )

  it.effect("raises a signed-in request's verbosity by the flag PostHog serves its Account", () =>
    Effect.gen(function* () {
      const asked: Array<string> = []
      const request = { requestId: 'req-1', scope: 'getTile', session: signedIn }
      const log = yield* requestLog(request, 'production').pipe(
        Effect.provide(posthog('low', asked)),
      )
      expect(asked).toEqual(['verbosity account-1'])
      expect(log.verbosity).toBe('low')
    }),
  )

  it.effect("keeps the environment's verbosity when the flag cannot be read", () =>
    Effect.gen(function* () {
      const request = { requestId: 'req-1', scope: 'getTile', session: signedIn }
      const log = yield* requestLog(request, 'production').pipe(Effect.provide(posthog(null)))
      expect(log).toMatchObject({ verbosity: 'high', distinctId: 'account-1', anonymous: false })
    }),
  )

  it.effect('reads no flag for a request nobody is signed in to', () =>
    Effect.gen(function* () {
      const asked: Array<string> = []
      const log = yield* requestLog({
        requestId: 'req-1',
        scope: 'getTile',
        session: signedOut,
      }).pipe(Effect.provide(posthog('low', asked)))
      expect(asked).toEqual([])
      expect(log).toEqual({
        verbosity: 'low',
        distinctId: 'req-1',
        anonymous: true,
        requestId: 'req-1',
        scope: 'getTile',
      })
    }),
  )

  it('starts Sentry before it traces the server entry', () => {
    const entry = { fetch: () => Promise.resolve(new Response()) }
    expect(observedEntry(entry)).toBe(entry)
    expect(startSentry).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    )
    expect(traced).toHaveBeenCalledWith(entry)
  })
})

describe('what no topic and no logger heard', () => {
  it.effect(
    'sends a line with no topic by its level: an error to Sentry and as `error`, the rest as `info`',
    () =>
      Effect.gen(function* () {
        const { events, errors, layer } = recorded()
        yield* inRequest(
          Effect.andThen(
            Effect.logError('A cache could not be read', Cause.die(new Error('disk full'))),
            Effect.logInfo('A cache was warmed'),
          ),
        ).pipe(Effect.provide(layer))
        expect(errors).toMatchObject([{ error: new Error('disk full') }])
        expect(events).toMatchObject([
          {
            event: 'error',
            properties: { message: 'A cache could not be read', sentryEventId: 'sentry-event-1' },
          },
          {
            event: 'info',
            properties: { message: 'A cache was warmed', sentryEventId: undefined },
          },
        ])
      }),
  )

  it("sends a failure of the runtime itself straight to Sentry, with the request's tags", () => {
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    unobserved(Cause.die(new Error('a layer could not be built')), {
      requestId: 'req-1',
      scope: 'getTile',
      session: signedOut,
    })
    expect(console_).toHaveBeenCalledOnce()
    console_.mockRestore()
    expect(captureError).toHaveBeenCalledWith(new Error('a layer could not be built'), {
      requestId: 'req-1',
      scope: 'getTile',
      kind: 'Unexpected',
      code: 'Unexpected',
    })
  })
})
