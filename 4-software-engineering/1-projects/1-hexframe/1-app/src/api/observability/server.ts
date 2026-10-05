// The server's side of observability. Every layer logs through Effect's logger, naming its line's
// topic with a `topic` annotation; the logger added here sends the lines the request's verbosity logs
// to PostHog, and an error line carrying a cause to Sentry first, so PostHog's `error` event points to
// Sentry's. The helper (../server/run.ts) resolves each request's verbosity and logs its call and its
// failure; the server entry (src/server.ts) starts Sentry and traces every request.
import { Cause, Context, Effect, Exit, Layer, Logger, Option, References } from 'effect'

import type { KeyProof, Session } from '#/domains/iam/iam'
import { Analytics, analytics } from '#/repositories/observability/posthog-server'
import { captureError, startSentry } from '#/repositories/observability/sentry'
import { ErrorTracker, errorTracker, traced } from '#/repositories/observability/sentry-server'

import {
  isTopic,
  logs,
  verbosityFlag,
  verbosityFor,
  type Environment,
  type Topic,
  type Verbosity,
} from './levels'

/** Who a request's log lines are about, and how many of them PostHog gets. */
interface RequestLog {
  readonly verbosity: Verbosity
  /** The Account's id when someone is signed in, the request's otherwise. */
  readonly distinctId: string
  readonly anonymous: boolean
  readonly requestId: string | undefined
  /** The server function called, or the MCP tool. */
  readonly scope: string | undefined
}

/**
 * The request a log line belongs to, which the helper provides to each program. A line logged outside
 * any request (a bus subscriber, which lives as long as the runtime) is the server's own, at the
 * environment's verbosity.
 */
export const CurrentRequestLog = Context.Reference<RequestLog>('hexframe/RequestLog', {
  defaultValue: () => ({
    verbosity: verbosityFor(undefined),
    distinctId: 'server',
    anonymous: true,
    requestId: undefined,
    scope: undefined,
  }),
})

interface Request {
  readonly requestId: string
  readonly scope: string
  readonly session: Exit.Exit<Option.Option<Session>>
  /** The Key `/mcp` proved; a server function has none. */
  readonly key?: Exit.Exit<Option.Option<KeyProof>>
}

/** The Account a proof names, when it was resolved and proves one. */
const accountOf = (proof: Exit.Exit<Option.Option<Session | KeyProof>> | undefined) =>
  proof !== undefined && Exit.isSuccess(proof)
    ? Option.getOrUndefined(Option.map(proof.value, ({ account }) => account.id))
    : undefined

/**
 * A request's log: the environment's verbosity, raised by the `verbosity` flag PostHog serves the
 * signed-in Account, whichever proof names it. Nobody signed in, no flag is read; a flag that cannot
 * be read leaves the environment's verbosity.
 */
export function requestLog(
  { requestId, scope, session, key }: Request,
  environment: Environment = __ENVIRONMENT__,
): Effect.Effect<RequestLog, never, Analytics> {
  const account = accountOf(session) ?? accountOf(key)
  const base: RequestLog = {
    verbosity: verbosityFor(undefined, environment),
    distinctId: account ?? requestId,
    anonymous: account === undefined,
    requestId,
    scope,
  }
  if (account === undefined) return Effect.succeed(base)
  return Analytics.use((analytics) => analytics.flag(verbosityFlag, account)).pipe(
    Effect.map((flag) => ({ ...base, verbosity: verbosityFor(flag, environment) })),
    Effect.catchCause(() => Effect.succeed(base)),
  )
}

/** A server function was called: logged at `high`. */
export const called = Effect.logInfo('Server function called').pipe(
  Effect.annotateLogs({ topic: 'call' }),
)

/** A server function sent a failure its program declared: PostHog's `error` event, and no Sentry. */
export function sent(failure: { readonly _tag: string; readonly kind: string }) {
  return Effect.logInfo('Server function failed').pipe(
    Effect.annotateLogs({ topic: 'error', kind: failure.kind, code: failure._tag }),
  )
}

/** A server function failed unexpectedly: Sentry gets the cause, PostHog an `error` event pointing to it. */
export function failedUnexpectedly(cause: Cause.Cause<unknown>) {
  return Effect.logError('A server function failed unexpectedly', cause).pipe(
    Effect.annotateLogs({ topic: 'error', kind: 'Unexpected', code: 'Unexpected' }),
  )
}

/** Sends what PostHog has queued; the helper hands it to `waitUntil` as a request ends. */
export const flushed = Analytics.use((analytics) => analytics.flush)

/**
 * A failure of the runtime itself (a layer that could not be built), which no logger heard: straight
 * to Sentry, and to the server's console.
 */
export function unobserved(cause: Cause.Cause<unknown>, { requestId, scope }: Request) {
  const tags = { requestId, scope, kind: 'Unexpected', code: 'Unexpected' }
  captureError(Cause.squash(cause), tags)
  console.error('The server function runtime failed', tags, Cause.pretty(cause))
}

// What a line may carry to Sentry's tags and PostHog's properties: identifiers, never a payload.
const carried = ['requestId', 'scope', 'kind', 'code', 'bus'] as const

function topicOf(logLevel: string, annotations: Readonly<Record<string, unknown>>): Topic {
  if (isTopic(annotations.topic)) return annotations.topic
  return logLevel === 'Error' || logLevel === 'Fatal' ? 'error' : 'info'
}

function textOf(message: unknown) {
  const parts = Array.isArray(message) ? message : [message]
  return parts.filter((part) => typeof part === 'string').join(' ')
}

function tagsOf(request: RequestLog, annotations: Readonly<Record<string, unknown>>) {
  const tags: Record<string, string> = {}
  if (request.requestId !== undefined) tags.requestId = request.requestId
  if (request.scope !== undefined) tags.scope = request.scope
  for (const key of carried) {
    const value = annotations[key]
    if (typeof value === 'string') tags[key] = value
  }
  return tags
}

const toPostHog = Effect.gen(function* () {
  const { capture } = yield* Analytics
  const tracker = yield* ErrorTracker
  return Logger.make(({ message, logLevel, cause, fiber }) => {
    const request = fiber.getRef(CurrentRequestLog)
    const annotations = fiber.getRef(References.CurrentLogAnnotations)
    const topic = topicOf(logLevel, annotations)
    if (!logs(request.verbosity, topic)) return
    const tags = tagsOf(request, annotations)
    const sentryEventId =
      topic === 'error' && cause.reasons.length > 0
        ? tracker.capture(Cause.squash(cause), tags)
        : undefined
    capture({
      event: topic,
      distinctId: request.distinctId,
      anonymous: request.anonymous,
      properties: { ...tags, message: textOf(message), sentryEventId },
    })
  })
})

/** The logger that sends to PostHog and Sentry, beside Effect's own, over the services it needs. */
export const logger = Logger.layer([toPostHog], { mergeWithExisting: true })

/** Observability for the server's runtime: the logger, over PostHog and Sentry. */
export const observability = logger.pipe(
  Layer.provideMerge(Layer.mergeAll(analytics, errorTracker)),
)

/** The server entry, observed: Sentry started, from the DSN both sides share, and every request traced. */
export function observedEntry(entry: Parameters<typeof traced>[0]) {
  startSentry({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: __ENVIRONMENT__ })
  return traced(entry)
}
