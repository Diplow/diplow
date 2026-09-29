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

// What a message can carry of what a user sent, each kind a pattern, tried in this order at every place.
const sensitive = new RegExp(
  [
    // A value the message quotes: in quotes, or in parentheses after `=`, as Postgres quotes a row.
    /(?<!\w)'[^'\n]*'|"[^"\n]*"|`[^`\n]*`|(?<==)\([^)\n]*\)/,
    // A value named by a key that says it is secret: `password=…`, `token: …`.
    /(?<=\b(?:password|passcode|passphrase|secret|token|otp|code|pin|key)s?\s*[:=]\s*)[^\s,;)]+/,
    // An email address.
    /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/,
    // A run of six digits or more: a one-time code, a card or a phone number.
    /\b\d{6,}\b/,
    // A run of 24 characters or more that could be a token, a key or a session id.
    /[\w+=-]{24,}/,
  ]
    .map((pattern) => pattern.source)
    .join('|'),
  'gi',
)

const quotes = new Set([`'`, '"', '`', '('])

/**
 * A text with every value it quotes, every value a secret key names, every email address, long number
 * and token-like run replaced, for what Sentry keeps of an error: the shape of a message, never what a
 * user sent. A quoted value keeps its quotes, so the message still reads.
 */
export function redacted(text: string) {
  return text.replace(sensitive, (match) => {
    const first = match.charAt(0)
    return quotes.has(first) && match.length > 1
      ? `${first}[redacted]${match.charAt(match.length - 1)}`
      : '[redacted]'
  })
}

/** A URL without its query and fragment, its sensitive runs redacted: a path is all Sentry needs. */
function redactedUrl(url: string) {
  return redacted(url.replace(/[?#].*$/s, ''))
}

/** A span's or a transaction's name, such as `GET /reset/…?email=…`: every URL in it without its query. */
function redactedName(name: string) {
  return redacted(name.replace(/(?<=[^\s?#])[?#]\S*/g, ''))
}

// A span attribute that holds a URL's query or fragment, dropped whole; any other text is redacted, a URL
// losing its query first.
const dropped = /(?:^|\.)(?:query|fragment)$/
const urlLike = /(?:^|\.)(?:url|full|target|path|from|to)$/

/** A span's attributes as Sentry may keep them, as fetch and HTTP instrumentation fill them. */
function scrubbedData<D extends Readonly<Record<string, unknown>>>(data: D): D {
  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (dropped.test(key)) continue
    kept[key] =
      typeof value !== 'string' ? value : urlLike.test(key) ? redactedUrl(value) : redacted(value)
  }
  return kept as D
}

/**
 * An event as Sentry may keep it: no request data but its method and redacted URL, no user, and every
 * message and exception value redacted, since a defect's message can quote what a user sent (a
 * database error quotes the row it refused). A transaction's name, spans and trace keep no query and
 * no sensitive run either, since fetch and HTTP instrumentation name a span by its full URL.
 */
export function scrubbed<E extends Sentry.Event>(event: E): E {
  const { request, contexts } = event
  const trace = contexts?.trace
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
    transaction: event.transaction === undefined ? undefined : redactedName(event.transaction),
    spans: event.spans?.map((span) => ({
      ...span,
      description: span.description === undefined ? undefined : redactedName(span.description),
      data: scrubbedData(span.data),
    })),
    contexts:
      trace?.data === undefined
        ? contexts
        : { ...contexts, trace: { ...trace, data: scrubbedData(trace.data) } },
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
