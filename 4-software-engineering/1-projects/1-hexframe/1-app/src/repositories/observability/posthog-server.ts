// PostHog on the server, behind the observability seam: the leveled event log and the feature flags a
// request reads. Server only; the browser has its own client (./posthog-browser.ts).
import { Cache, Context, Duration, Effect, Layer } from 'effect'
import { PostHog } from 'posthog-node'

/** One event for PostHog: who it is about, and what happened. */
export interface AnalyticsEvent {
  readonly event: string
  /** The Account's id, or the request's when nobody is signed in. */
  readonly distinctId: string
  /** Nobody is signed in: PostHog records the event without a person to hang it on. */
  readonly anonymous: boolean
  readonly properties: Readonly<Record<string, string | undefined>>
}

/** PostHog, as the server's runtime sees it. Every call is a no-op while PostHog is off. */
export class Analytics extends Context.Service<
  Analytics,
  {
    /** Queues an event; `flush` sends the queue. Synchronous, so a logger can call it. */
    readonly capture: (event: AnalyticsEvent) => void
    /** A feature flag's value for one person, or `undefined`: unset, PostHog off or unreachable. */
    readonly flag: (key: string, distinctId: string) => Effect.Effect<unknown>
    /** Sends what is queued. A serverless function hands it to `waitUntil` before it ends. */
    readonly flush: Effect.Effect<void>
  }
>()('hexframe/Analytics') {}

/** PostHog off: what the runtime gets without `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`. */
const off = Analytics.of({
  capture: () => undefined,
  flag: () => Effect.succeed(undefined),
  flush: Effect.void,
})

// A flag read costs a request to PostHog, so each person's value is kept for a few minutes: raising
// someone's verbosity takes effect within that time.
const flagCache = { capacity: 10_000, timeToLive: Duration.minutes(5) }

function on(key: string, host: string) {
  return Effect.gen(function* () {
    const client = yield* Effect.acquireRelease(
      Effect.sync(
        () => new PostHog(key, { host, featureFlagsRequestTimeoutMs: 500, disableGeoip: true }),
      ),
      (client) => Effect.tryPromise(() => client.shutdown()).pipe(Effect.ignore),
    )
    const flags = yield* Cache.make({
      ...flagCache,
      lookup: (entry: string) => {
        const [flag = '', distinctId = ''] = entry.split('\n')
        return Effect.tryPromise(() => client.evaluateFlags(distinctId, { flagKeys: [flag] })).pipe(
          Effect.map((evaluated) => evaluated.getFlag(flag)),
          Effect.orElseSucceed(() => undefined),
        )
      },
    })
    return Analytics.of({
      capture: ({ event, distinctId, anonymous, properties }) => {
        client.capture({
          event,
          distinctId,
          properties: anonymous ? { ...properties, $process_person_profile: false } : properties,
        })
      },
      flag: (flag, distinctId) => Cache.get(flags, `${flag}\n${distinctId}`),
      flush: Effect.tryPromise(() => client.flush()).pipe(Effect.ignore),
    })
  })
}

/** Analytics over PostHog's Node SDK, from the project key and host both sides share; off without them. */
export const analytics = Layer.effect(Analytics)(
  Effect.suspend(() => {
    const key = import.meta.env.VITE_POSTHOG_KEY ?? ''
    const host = import.meta.env.VITE_POSTHOG_HOST ?? ''
    return key === '' || host === '' ? Effect.succeed(off) : on(key, host)
  }),
)
