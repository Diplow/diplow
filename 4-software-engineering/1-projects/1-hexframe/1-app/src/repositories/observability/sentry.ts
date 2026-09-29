// Sentry, behind the observability seam: its TanStack Start SDK is a beta, so this folder is the only
// place that imports it, and swapping it touches nothing above. The one package serves both sides: the
// bundler picks its browser build for the client and its Node build for the server.
import * as Sentry from '@sentry/tanstackstart-react'

interface SentryOptions {
  /** Sentry's DSN, public by design. Sentry stays off without one. */
  readonly dsn: string | undefined
  readonly environment: string
  /** The client's router, whose navigations become traces. The server passes none. */
  readonly router?: unknown
}

/** Starts Sentry once, on whichever side calls it; without a DSN, it stays off. */
export function startSentry({ dsn, environment, router }: SentryOptions) {
  if (dsn === undefined || dsn === '' || Sentry.getClient() !== undefined) return
  Sentry.init({
    dsn,
    environment,
    // An error is traced by its request id, never by what the user sent: no cookie (the session's
    // among them), header, body, query parameter, local variable or database parameter reaches Sentry.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    tracesSampleRate: 1,
    integrations:
      router === undefined ? [] : [Sentry.tanstackRouterBrowserTracingIntegration(router)],
  })
}

/**
 * Sends an error to Sentry with the tags that trace it (request id, scope, kind) and returns the id
 * of the event it made, for the PostHog event that points to it. Nothing, and no id, while Sentry is off.
 */
export function captureError(error: unknown, tags: Readonly<Record<string, string>>) {
  if (Sentry.getClient() === undefined) return undefined
  return Sentry.captureException(error, { tags })
}
