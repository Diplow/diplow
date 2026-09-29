// PostHog in the browser, behind the observability seam: page visits and action clicks, captured by
// PostHog itself, the events the client logs, and the flags PostHog serves the person on this device.
import posthog from 'posthog-js'

let started = false

interface BrowserAnalyticsOptions {
  /** PostHog's project key and host, public by design. PostHog stays off without both. */
  readonly key: string | undefined
  readonly host: string | undefined
  /** Called with a flag's value each time PostHog loads the flags of the person on this device. */
  readonly flag: { readonly key: string; readonly loaded: (value: unknown) => void }
}

/** Starts PostHog once, in the browser; without a key and a host, it stays off. */
export function startBrowserAnalytics({ key, host, flag }: BrowserAnalyticsOptions) {
  if (started || key === undefined || key === '' || host === undefined || host === '') return
  started = true
  posthog.init(key, {
    api_host: host,
    // Page visits and action clicks log at every level, `high` included: PostHog captures both.
    capture_pageview: 'history_change',
    autocapture: true,
    // Errors are Sentry's; PostHog gets a small `error` event pointing to Sentry's.
    capture_exceptions: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  })
  posthog.onFeatureFlags(() => {
    flag.loaded(posthog.getFeatureFlag(flag.key))
  })
}

/** Whether PostHog is on in this browser. */
export function browserAnalyticsStarted() {
  return started
}

/** Sends one event, while PostHog is on. */
export function captureInBrowser(event: string, properties: Readonly<Record<string, unknown>>) {
  if (started) posthog.capture(event, properties)
}

/** Ties this device's events and flags to an Account, by its id. */
export function identifyInBrowser(distinctId: string) {
  if (started && posthog.get_distinct_id() !== distinctId) posthog.identify(distinctId)
}

/**
 * Unties this device from the Account it was signed in as: its next events are anonymous. A page
 * load that finds nobody signed in calls it, so it resets once after each sign-out.
 */
export function forgetInBrowser() {
  // PostHog keeps whether the device is identified across page loads; this reads it back.
  if (started && posthog._isIdentified()) posthog.reset()
}
