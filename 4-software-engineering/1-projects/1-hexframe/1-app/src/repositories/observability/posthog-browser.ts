// PostHog in the browser, behind the observability seam: page visits and action clicks, captured by
// PostHog itself, the events the client logs, and the flags PostHog serves the person on this device.
import posthog from 'posthog-js'

let started = false

interface BrowserAnalyticsOptions {
  /** PostHog's project key and host, public by design. PostHog stays off without both. */
  readonly key: string | undefined
  readonly host: string | undefined
  /** Called each time PostHog loads the flags of the person on this device. */
  readonly flagsLoaded: () => void
}

/** Starts PostHog once, in the browser; without a key and a host, it stays off. */
export function startBrowserAnalytics({ key, host, flagsLoaded }: BrowserAnalyticsOptions) {
  if (started || key === undefined || key === '' || host === undefined || host === '') return
  started = true
  posthog.init(key, {
    api_host: host,
    // Page visits and action clicks log at every level, `high` included: PostHog captures both.
    capture_pageview: 'history_change',
    autocapture: true,
    // A click is recorded by the element's kind and place, never its text nor its attributes' values:
    // a Tile's title, a label, anything a user wrote.
    mask_all_text: true,
    mask_all_element_attributes: true,
    // Errors are Sentry's; PostHog gets a small `error` event pointing to Sentry's.
    capture_exceptions: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  })
  posthog.onFeatureFlags(flagsLoaded)
}

/** Whether PostHog is on in this browser. */
export function browserAnalyticsStarted() {
  return started
}

/** Sends one event, while PostHog is on. */
export function captureInBrowser(event: string, properties: Readonly<Record<string, unknown>>) {
  if (started) posthog.capture(event, properties)
}

/**
 * A feature flag's value for this device, while it is tied to an Account, or `undefined`: a flag
 * that raises one Account's verbosity never applies to an anonymous visitor, nor after a sign-out.
 */
export function accountFlagInBrowser(key: string) {
  return started && posthog._isIdentified() ? posthog.getFeatureFlag(key) : undefined
}

/** Ties this device's events and flags to an Account, by its id; PostHog keeps it across loads. */
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
