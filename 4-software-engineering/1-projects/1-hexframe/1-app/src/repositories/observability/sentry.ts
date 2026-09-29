// Sentry, behind the observability seam: its TanStack Start SDK is a beta, so this folder is the only
// place that imports it, and swapping it touches nothing above. The one package serves both sides: the
// bundler picks its browser build for the client and its Node build for the server.
import * as Sentry from '@sentry/tanstackstart-react'
import type { AnyRouter } from '@tanstack/react-router'

interface SentryOptions {
  /** Sentry's DSN, public by design. Sentry stays off without one. */
  readonly dsn: string | undefined
  readonly environment: 'development' | 'preview' | 'production'
  /** The client's router, whose navigations become traces. The server passes none. */
  readonly router?: AnyRouter
}

// An email address, or a run of 24 characters or more that could be a token, a key or a session id.
const sensitive = /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}|[\w+=-]{24,}/g

/** A text with every email address and token-like run replaced, for what Sentry keeps of an error. */
export function redacted(text: string) {
  return text.replace(sensitive, '[redacted]')
}

/** A URL without its query and fragment, its sensitive runs redacted: a path is all Sentry needs. */
function redactedUrl(url: string) {
  return redacted(url.replace(/[?#].*$/s, ''))
}

/**
 * An event as Sentry may keep it: no request data but its method and redacted URL, no user, and every
 * message and exception value redacted, since a defect's message can quote what a user sent (a
 * database error quotes the row it refused).
 */
export function scrubbed<E extends Sentry.Event>(event: E): E {
  const { request } = event
  return {
    ...event,
    user: undefined,
    request:
      request === undefined
        ? undefined
        : {
            method: request.method,
            url: request.url === undefined ? undefined : redactedUrl(request.url),
          },
    message: event.message === undefined ? undefined : redacted(event.message),
    exception:
      event.exception === undefined
        ? undefined
        : {
            ...event.exception,
            values: event.exception.values?.map((value) => ({
              ...value,
              value: value.value === undefined ? undefined : redacted(value.value),
            })),
          },
  }
}

/**
 * A breadcrumb as Sentry may keep it: none from the console, which prints anything; a navigation's or
 * a fetch's URLs without their query; every message redacted.
 */
export function scrubbedBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === 'console') return null
  const data: Record<string, unknown> = { ...breadcrumb.data }
  for (const key of ['url', 'from', 'to']) {
    const value = data[key]
    if (typeof value === 'string') data[key] = redactedUrl(value)
  }
  return {
    ...breadcrumb,
    message: breadcrumb.message === undefined ? undefined : redacted(breadcrumb.message),
    data,
  }
}

/** Starts Sentry once, on whichever side calls it; without a DSN, it stays off. */
export function startSentry({ dsn, environment, router }: SentryOptions) {
  if (dsn === undefined || dsn === '' || Sentry.getClient() !== undefined) return
  Sentry.init({
    dsn,
    environment,
    // Every trace in previews and development; a fifth of them in production.
    tracesSampleRate: environment === 'production' ? 0.2 : 1,
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
    // What collection leaves, a message or a URL, is redacted before it leaves.
    beforeSend: scrubbed,
    beforeSendTransaction: scrubbed,
    beforeBreadcrumb: scrubbedBreadcrumb,
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
