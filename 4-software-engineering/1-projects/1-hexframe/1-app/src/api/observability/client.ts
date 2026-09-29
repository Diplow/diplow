// The client's side of observability. PostHog captures page visits and action clicks by itself; the
// client logs the rest of its topics with `log`, at the page's verbosity: the environment's, raised by
// the `verbosity` flag PostHog serves the person on this device. An error the server never saw goes
// to Sentry first, then to PostHog as an `error` event pointing to Sentry's.
import type { AnyRouter } from '@tanstack/react-router'

import {
  accountFlagInBrowser,
  browserAnalyticsStarted,
  captureInBrowser,
  forgetInBrowser,
  identifyInBrowser,
  startBrowserAnalytics,
} from '#/repositories/observability/posthog-browser'
import { captureError, startSentry } from '#/repositories/observability/sentry'

import { logs, verbosityFlag, verbosityFor, type Topic } from './levels'

let verbosity = verbosityFor(undefined)

// The page's verbosity: the environment's, raised by the flag of the Account this device is tied to.
// An anonymous device, or one just signed out, gets no Account's flag.
function applyFlag() {
  verbosity = verbosityFor(accountFlagInBrowser(verbosityFlag))
}

/** Starts Sentry and PostHog in the browser, once; the router's navigations become Sentry's traces. */
export function startObservability(router: AnyRouter) {
  if (typeof window === 'undefined') return
  startSentry({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: __ENVIRONMENT__, router })
  startBrowserAnalytics({
    key: import.meta.env.VITE_POSTHOG_KEY,
    host: import.meta.env.VITE_POSTHOG_HOST,
    flagsLoaded: applyFlag,
  })
}

/**
 * Logs one line of a topic, if the page's verbosity logs it: to PostHog, or to the console while
 * PostHog is off (`pnpm dev`, the server's render). Properties are identifiers, never a payload.
 */
export function log(
  topic: Topic,
  message: string,
  properties: Readonly<Record<string, string>> = {},
) {
  if (!logs(verbosity, topic)) return
  if (browserAnalyticsStarted()) captureInBrowser(topic, { ...properties, message })
  else console.debug(message, { topic, ...properties })
}

interface ErrorDetails {
  /** Where it happened: the server function called, the fact being reacted to. */
  readonly scope: string
  /** The failure's kind and tag, when it is one; `Unexpected` otherwise. */
  readonly kind?: string
  readonly code?: string
}

/**
 * Reports an error the server never saw (a call that never reached it, a feature that threw): to
 * Sentry, then to PostHog as an `error` event carrying Sentry's event id. The console gets it while
 * both are off.
 */
export function reportError(
  error: unknown,
  { scope, kind = 'Unexpected', code = kind }: ErrorDetails,
) {
  const tags = { scope, kind, code }
  const sentryEventId = captureError(error, tags)
  if (browserAnalyticsStarted()) captureInBrowser('error', { ...tags, sentryEventId })
  if (sentryEventId === undefined && !browserAnalyticsStarted()) console.error(error, tags)
}

/**
 * Ties this device to the signed-in Account, so its events and flags are the Account's: on signing in
 * or up, and on every page `signedIn` guards. PostHog keeps it across page loads until `forget`.
 */
export function identify(accountId: string) {
  identifyInBrowser(accountId)
  applyFlag()
}

/** Unties this device from the Account it was signed in as, once nobody is, and drops its flag. */
export function forget() {
  forgetInBrowser()
  applyFlag()
}
