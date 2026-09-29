// The one helper every server function hands its Effect program to. Start's middleware puts the
// request's context on Start's `context`; the helper provides it as Effect services, runs the program
// on the one ManagedRuntime, and returns the value or the failure, encoded. Nothing else calls `run*`:
// eslint.config.ts says no.
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Option, Schema } from 'effect'

import { CurrentSession, proven, type Session } from '#/domains/iam/iam'
import { Auth, HttpExchange, layer as authLayer } from '#/repositories/auth/auth'

import { Failure, Unexpected, encodeFailure, type Outcome } from '../errors/failure'
import {
  CurrentRequestLog,
  called,
  failedUnexpectedly,
  flushed,
  observability,
  requestLog,
  sent,
} from '../observability/server'
import { WaitUntil, serverBus, type Subscription } from './bus'

/** What Start's middleware knows about the request, as a program sees it. */
export class RequestContext extends Context.Service<
  RequestContext,
  { readonly requestId: string }
>()('hexframe/RequestContext') {}

/**
 * Who reacts to which domain event: the API layer composes domains here, one `on(Event, reaction)`
 * per subscription, as the domains that publish and react are built.
 */
const subscriptions: ReadonlyArray<Subscription<never>> = []

/**
 * The repositories, deployed: Better Auth over Postgres, from DATABASE_URL and BETTER_AUTH_SECRET.
 * Under `pnpm dev` and the tests, without DATABASE_URL: Better Auth over a fresh PGlite in memory,
 * with a secret of its own, both gone when the process stops. A build never holds that branch.
 */
const repositories: Layer.Layer<Auth> =
  import.meta.env.DEV && (process.env.DATABASE_URL ?? '') === ''
    ? Layer.unwrap(
        Effect.promise(async () => (await import('#/repositories/auth/testing')).TestAuth),
      )
    : Layer.orDie(authLayer)

/**
 * Every layer: the bus, the domains' services and the repositories below them, merged here as each is
 * built, and the logger that sends to PostHog and Sentry. Built once, on the first call, and shared
 * by every request.
 */
const layer = Layer.mergeAll(serverBus(subscriptions), repositories, observability)

const runtime = ManagedRuntime.make(layer)

/** The services a server function's program may use: the request's and every layer's. */
export type Services =
  | RequestContext
  | CurrentSession
  | HttpExchange
  | ManagedRuntime.ManagedRuntime.Services<typeof runtime>

/** Start's `context`, as its middleware (./middleware.ts) fills it. */
export interface StartContext {
  readonly requestId: string
  /** The server function called, by its name: what its log lines and its errors are scoped to. */
  readonly scope: string
  /** The platform's: keeps the request's function up until the promise settles. */
  readonly waitUntil: (promise: Promise<unknown>) => void
  /** The request's headers, and where the cookies a call sets go. */
  readonly exchange: HttpExchange['Service']
  /** The Session the request's cookie proves, if any, or how resolving it failed. */
  readonly session: Exit.Exit<Option.Option<Session>>
}

const isFailure = Schema.is(Failure)

/**
 * The failure to send for a failed program, logged: the one it declares, when that is all that went
 * wrong and the union knows it, as PostHog's `error` event. A defect (even beside a declared failure),
 * an interruption, or a value the union does not know, reached through an untyped path, goes to
 * Sentry and is sent as `Unexpected`.
 */
function failureOf<E extends Failure>(cause: Cause.Cause<E>): Effect.Effect<E | Unexpected> {
  const declared = Cause.findErrorOption(cause)
  const cleanly = !Cause.hasDies(cause) && !Cause.hasInterrupts(cause)
  if (declared._tag === 'Some' && cleanly && isFailure(declared.value)) {
    return Effect.as(sent(declared.value), declared.value)
  }
  return Effect.as(failedUnexpectedly(cause), new Unexpected())
}

/**
 * Runs a server function's program and returns its outcome: the value, or the failure encoded with
 * the request id. Only failures in the union reach the client as they are; see `failureOf`. The call
 * and its failure are logged at the request's verbosity, and PostHog's queue is flushed through
 * `waitUntil` once the outcome is known.
 */
export async function run<A, E extends Failure>(
  context: StartContext,
  program: Effect.Effect<A, E, Services>,
): Promise<Outcome<A, E | Unexpected>> {
  const log = await runtime.runPromise(requestLog(context))
  try {
    const exit = await runtime.runPromiseExit(
      Effect.flatMap(called, () => program).pipe(
        Effect.provideService(RequestContext, { requestId: context.requestId }),
        // A Session the middleware could not resolve fails the program: reported, sent as Unexpected.
        Effect.provideServiceEffect(CurrentSession, context.session),
        Effect.provideService(HttpExchange, context.exchange),
        Effect.provideService(WaitUntil, (work) => {
          context.waitUntil(runtime.runPromise(work))
        }),
        Effect.provideService(CurrentRequestLog, log),
      ),
    )
    if (Exit.isSuccess(exit)) return { ok: true, value: exit.value }
    const failure = await runtime.runPromise(
      failureOf(exit.cause).pipe(Effect.provideService(CurrentRequestLog, log)),
    )
    return { ok: false, failure: encodeFailure(failure), requestId: context.requestId }
  } finally {
    context.waitUntil(runtime.runPromise(flushed))
  }
}

/**
 * The Session a request's cookie proves, if any, for the middleware to put on Start's context before
 * any server function runs. A failure to tell (the database is down) is kept, not thrown: `run` fails
 * the program with it, so the client gets `Unexpected` with the request id, and the log gets the cause.
 */
export function provenSession(
  exchange: HttpExchange['Service'],
): Promise<Exit.Exit<Option.Option<Session>>> {
  return runtime.runPromiseExit(proven.pipe(Effect.provideService(HttpExchange, exchange)))
}
