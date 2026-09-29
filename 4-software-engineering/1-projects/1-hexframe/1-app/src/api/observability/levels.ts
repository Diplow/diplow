// The verbosity levels (STACK.md, Observability), shared by both sides and pure: what each level logs,
// the level each environment logs at, and how a PostHog feature flag raises it for one user.
import { Option, Schema } from 'effect'

/** How much is logged: `high` the least, `low` the most. */
export const Verbosity = Schema.Literals(['high', 'medium', 'low'])
export type Verbosity = typeof Verbosity.Type

/** Where the app runs, as vite.config.ts sets `__ENVIRONMENT__`. */
export type Environment = typeof __ENVIRONMENT__

/**
 * What gets logged, each at the least verbose level that logs it. A log line names its topic; a level
 * logs its own topics and those of every level above it.
 */
const topics = {
  /** A page visit. */
  page: 'high',
  /** An action click or a shortcut. */
  action: 'high',
  /** A server function call. */
  call: 'high',
  error: 'high',
  /** A domain service call. */
  domain: 'medium',
  /** A state hook's action. */
  state: 'medium',
  /** A message on either bus. */
  bus: 'medium',
  info: 'low',
  /** A repository or database call. */
  repository: 'low',
  /** A component render: logged in development only, whatever the level. */
  render: 'low',
} as const satisfies Record<string, Verbosity>

export type Topic = keyof typeof topics

/** Whether a value, a log line's `topic` annotation, names a topic. */
export function isTopic(value: unknown): value is Topic {
  return typeof value === 'string' && Object.hasOwn(topics, value)
}

const order: ReadonlyArray<Verbosity> = ['high', 'medium', 'low']

/** The level each environment logs at, unless a user's flag raises it. */
const byEnvironment: Record<Environment, Verbosity> = {
  production: 'high',
  preview: 'medium',
  development: 'low',
}

/** Whether a topic is logged at a verbosity, in an environment. */
export function logs(
  verbosity: Verbosity,
  topic: Topic,
  environment: Environment = __ENVIRONMENT__,
) {
  if (topic === 'render' && environment !== 'development') return false
  return order.indexOf(topics[topic]) <= order.indexOf(verbosity)
}

const decodeFlag = Schema.decodeUnknownOption(Verbosity)

/**
 * The verbosity one user is logged at: the environment's, raised by the `verbosity` feature flag when
 * PostHog serves them one. A flag can only raise it: a user flagged `high` in a preview still logs at
 * `medium`. A flag value that is not a level is ignored.
 */
export function verbosityFor(flag: unknown, environment: Environment = __ENVIRONMENT__) {
  const base = byEnvironment[environment]
  return Option.match(decodeFlag(flag), {
    onNone: () => base,
    onSome: (raised) => (order.indexOf(raised) > order.indexOf(base) ? raised : base),
  })
}

/** The PostHog feature flag that raises one user's verbosity: a multivariate flag, `high`, `medium` or `low`. */
export const verbosityFlag = 'verbosity'
