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

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

// The words that say a key is secret, as a key spells them: in lower or upper case after anything but a
// letter (`password`, `client_secret`, `ACCESS_TOKEN`), or capitalised anywhere, as the last word of a
// camelCase key (`accessToken`, `apiKey`), so `monkey` and `opinion` name nothing secret.
const secretWords = ['password', 'passcode', 'passphrase', 'secret', 'token', 'otp', 'pin', 'key']

// `code` names a one-time code alone (`code=…`, `CODE: …`) or when a word says which one
// (`verificationCode`, `auth_code`, `OTP_CODE`); `statusCode`, `exit_code` and their like are
// diagnostics, kept.
const codeWords = ['verification', 'confirmation', 'auth', 'reset', 'login', 'otp', 'mfa', 'sms']
const codeKey = [
  '(?<![A-Za-z_])(?:code|CODE)',
  `(?:${codeWords.join('|')})_?code`,
  `(?:${[...codeWords, ...codeWords.map(capitalised)].join('|')})Code`,
  `(?:${codeWords.join('|').toUpperCase()})_?CODE`,
].join('|')

const secretKey = [
  `(?<![A-Za-z])(?:${secretWords.join('|')}|${secretWords.join('|').toUpperCase()})`,
  secretWords.map(capitalised).join('|'),
  codeKey,
].join('|')

// What a message can carry of what a user sent, each kind a pattern, tried in this order at every place.
const sensitive = new RegExp(
  [
    // A value the message quotes: in quotes, or in parentheses after `=`, as Postgres quotes a row.
    /(?<!\w)'[^'\n]*'|"[^"\n]*"|`[^`\n]*`|(?<==)\([^)\n]*\)/.source,
    // A value named by a key that says it is secret: `password=…`, `token: …`, `apiKey=…`.
    String.raw`(?<=(?:${secretKey})[sS]?\s*[:=]\s*)[^\s,;)]+`,
    // An email address.
    /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/.source,
    // A run of six digits or more: a one-time code, a card or a phone number.
    /\b\d{6,}\b/.source,
    // A run of 24 characters or more that could be a token, a key or a session id.
    /[\w+=-]{24,}/.source,
  ].join('|'),
  'g',
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

/**
 * Any value an event carries beside the fields Sentry names, every text in it redacted however deep it
 * sits, its keys and its shape kept. Sentry has normalized the event already: plain data, no cycle.
 */
function scrubbedValue<T>(value: T): T {
  if (typeof value === 'string') return redacted(value) as T
  if (Array.isArray(value)) return value.map(scrubbedValue) as T
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, scrubbedValue(inner)]),
  ) as T
}

// An attribute that holds a URL's query or fragment, dropped whole; any other text is redacted, a URL
// losing its query first.
const dropped = /(?:^|\.)(?:query|fragment)$/
const urlLike = /(?:^|\.)(?:url|full|target|path|from|to)$/

/** A span's or a breadcrumb's data as Sentry may keep it, as fetch and HTTP instrumentation fill it. */
function scrubbedData<D extends Readonly<Record<string, unknown>>>(data: D): D {
  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (dropped.test(key)) continue
    kept[key] =
      typeof value === 'string' && urlLike.test(key) ? redactedUrl(value) : scrubbedValue(value)
  }
  return kept as D
}

// The trace's ids, kept as they are: a trace id is a run a redaction would take for a token.
const traceIds = new Set(['trace_id', 'span_id', 'parent_span_id'])

/**
 * An event's contexts: the trace keeps its ids, its data loses its queries, and every other text in it
 * is redacted; any other context is redacted whole.
 */
function scrubbedContexts({ trace, ...others }: Sentry.Contexts): Sentry.Contexts {
  const kept = scrubbedValue(others)
  if (trace === undefined) return kept
  const scrubbedTrace = Object.fromEntries(
    Object.entries(trace).map(([key, value]: [string, unknown]) => [
      key,
      traceIds.has(key)
        ? value
        : key === 'data'
          ? scrubbedData(value as Readonly<Record<string, unknown>>)
          : scrubbedValue(value),
    ]),
  ) as typeof trace
  return { ...kept, trace: scrubbedTrace }
}

/**
 * An event as Sentry may keep it: no request data but its method and redacted URL, no user, and every
 * message and exception value redacted, since a defect's message can quote what a user sent (a
 * database error quotes the row it refused); so is every text in its extra data, its log entry and its
 * contexts, where the SDK puts a thrown value that is not an Error. A transaction's name, spans and
 * trace keep no query and no sensitive run either, since fetch and HTTP instrumentation name a span by
 * its full URL.
 */
export function scrubbed<E extends Sentry.Event>(event: E): E {
  const { request, contexts } = event
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
    extra: event.extra === undefined ? undefined : scrubbedValue(event.extra),
    logentry: event.logentry === undefined ? undefined : scrubbedValue(event.logentry),
    contexts: contexts === undefined ? undefined : scrubbedContexts(contexts),
  }
}

/**
 * A breadcrumb as Sentry may keep it: none from the console, which prints anything; a navigation's or
 * a fetch's URLs without their query; its message and every other text in its data redacted.
 */
export function scrubbedBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === 'console') return null
  return {
    ...breadcrumb,
    message: breadcrumb.message === undefined ? undefined : redacted(breadcrumb.message),
    data: breadcrumb.data === undefined ? undefined : scrubbedData(breadcrumb.data),
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
