// The one helper every server function hands its Effect program to. Start's middleware puts the
// request's context on Start's `context`; the helper provides it as Effect services, runs the program
// on the one ManagedRuntime, and returns the value or the failure, encoded. Nothing else calls `run*`:
// eslint.config.ts says no.
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Option, Schema } from 'effect'

import { CurrentKey, CurrentSession, proven, type KeyProof, type Session } from '#/domains/iam/iam'
import { Auth, HttpExchange, layer as authLayer } from '#/repositories/auth/auth'
import { type Database, layer as databaseLayer } from '#/repositories/database/database'
import { Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { Failure, Unexpected, encodeFailure, type Outcome } from '../errors/failure'
import {
  CurrentRequestLog,
  called,
  failedUnexpectedly,
  flushed,
  observability,
  requestLog,
  sent,
  unobserved,
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
 * Better Auth and the database, deployed: Postgres from DATABASE_URL, cookies signed with
 * BETTER_AUTH_SECRET. Under `pnpm dev` and the tests, without DATABASE_URL: Better Auth over a fresh
 * PGlite in memory, with a secret of its own, both gone when the process stops; that PGlite is the
 * database too. A build never holds that branch.
 */
const auth =
  import.meta.env.DEV && (process.env.DATABASE_URL ?? '') === ''
    ? Layer.unwrap(
        Effect.promise(async () => (await import('#/repositories/auth/testing')).TestAuth),
      )
    : Layer.orDie(Layer.merge(authLayer, databaseLayer))

/**
 * The repositories the domains use: Better Auth for IAM, the tiles repository for Mapping; and the
 * database itself, for the transaction a program opens (`transactional`).
 */
const repositories: Layer.Layer<Auth | Database | Tiles> = Layer.provideMerge(tilesLayer, auth)

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
  | CurrentKey
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
  /**
   * The Key the request's `Authorization: Bearer` header proves, if any, or how resolving it failed.
   * Only `/mcp` reads the header; a server function's is always none, as `middleware.ts` sets it.
   */
  readonly key: Exit.Exit<Option.Option<KeyProof>>
}

/** A server function's Key: none, whatever its headers say, since a Key opens `/mcp` only. */
export const noKey: StartContext['key'] = Exit.succeed(Option.none())

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
 * and its failure are logged at the request's verbosity; once the work the program left pending has
 * settled, PostHog's queue is flushed through `waitUntil`.
 */
export async function run<A, E extends Failure>(
  context: StartContext,
  program: Effect.Effect<A, E, Services>,
): Promise<Outcome<A, E | Unexpected>> {
  const { requestId } = context
  const pending: Array<Promise<unknown>> = []
  const outcome = Effect.flatMap(requestLog(context), (log) =>
    Effect.flatMap(called, () =>
      // A proof that could not be resolved fails the program: reported, sent as Unexpected.
      program.pipe(
        Effect.provideServiceEffect(CurrentSession, context.session),
        Effect.provideServiceEffect(CurrentKey, context.key),
      ),
    ).pipe(
      Effect.map((value): Outcome<A, E | Unexpected> => ({ ok: true, value })),
      Effect.catchCause((cause) =>
        Effect.map(failureOf(cause), (failure) => ({
          ok: false as const,
          failure: encodeFailure(failure),
          requestId,
        })),
      ),
      Effect.provideService(CurrentRequestLog, log),
    ),
  ).pipe(
    Effect.provideService(RequestContext, { requestId }),
    Effect.provideService(HttpExchange, context.exchange),
    Effect.provideService(WaitUntil, (work) => {
      const settled = runtime.runPromise(work)
      pending.push(settled)
      context.waitUntil(settled)
    }),
  )
  const exit = await runtime.runPromiseExit(outcome)
  context.waitUntil(Promise.allSettled(pending).then(() => runtime.runPromiseExit(flushed)))
  if (Exit.isSuccess(exit)) return exit.value
  // Only the runtime itself failing (a layer that could not be built) gets here: no logger heard it.
  unobserved(exit.cause, context)
  return { ok: false, failure: encodeFailure<E | Unexpected>(new Unexpected()), requestId }
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
