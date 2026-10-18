// The one helper every server function hands its Effect program to. Start's middleware puts the
// request's context on Start's `context`; the helper provides it as Effect services, runs the program
// on the one ManagedRuntime, and returns the value or the failure, encoded. Nothing else calls `run*`:
// eslint.config.ts says no.
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Option, Schema } from 'effect'

import {
  CurrentKey,
  CurrentSession,
  keyProven,
  proven,
  type KeyProof,
  type Session,
} from '#/domains/iam/iam'
import {
  Anthropic,
  layer as anthropicLayer,
  hasKey,
} from '#/repositories/agent/anthropic/anthropic'
import { layer as blaxelLayer, hasCredentials } from '#/repositories/agent/sandbox/blaxel'
import { Sandbox } from '#/repositories/agent/sandbox/sandbox'
import { Allowlist, layer as allowlistLayer } from '#/repositories/auth/allowlist'
import { Auth, HttpExchange, layer as authLayer } from '#/repositories/auth/auth'
import { Applied, layer as appliedLayer } from '#/repositories/database/conversations/applied'
import {
  Conversations,
  layer as conversationsLayer,
} from '#/repositories/database/conversations/conversations'
import { Proposals, layer as proposalsLayer } from '#/repositories/database/conversations/proposals'
import { Turns, layer as turnsLayer } from '#/repositories/database/conversations/turns'
import { type Database, layer as databaseLayer } from '#/repositories/database/database'
import {
  Organizations,
  layer as organizationsLayer,
} from '#/repositories/database/organizations/organizations'
import { Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'
import { TurnKeys, layer as turnKeysLayer } from '#/repositories/database/turn-keys/turn-keys'
import { Zip, layer as zipLayer } from '#/repositories/zip/zip'

import { recordedInConversation, toldShared } from '../assistant/recording'
import { Failure, Unexpected, encodeFailure, type Outcome } from '../report/errors/failure'
import {
  CurrentRequestLog,
  called,
  failedUnexpectedly,
  flushed,
  observability,
  requestLog,
  sent,
  unobserved,
} from '../report/observability/server'
import { WaitUntil, serverBus, type Subscription } from './bus'

/** What Start's middleware knows about the request, as a program sees it. */
export class RequestContext extends Context.Service<
  RequestContext,
  { readonly requestId: string }
>()('hexframe/RequestContext') {}

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
 * Every Account's sandbox: on Blaxel, deployed. Under `pnpm dev` without Blaxel's credentials, and in every
 * test, whatever the shell exports (`vitest.config.ts`): a folder of this machine's per Account. A
 * build never holds that branch.
 */
const sandbox =
  import.meta.env.DEV && !hasCredentials(process.env)
    ? Layer.unwrap(
        Effect.promise(async () => (await import('#/repositories/agent/sandbox/local')).layer),
      )
    : blaxelLayer

/**
 * The model relay: to Anthropic, deployed. Under `pnpm dev` without `ANTHROPIC_API_KEY`, and in every
 * test, whatever the shell exports (`vitest.config.ts`): a fake in this process. A build never holds
 * that branch.
 */
const anthropic =
  import.meta.env.DEV && !hasKey(process.env)
    ? Layer.unwrap(
        Effect.promise(async () => (await import('#/repositories/agent/anthropic/fake')).layer),
      )
    : anthropicLayer

/**
 * What the domains use: Better Auth, the allowlist, the Turn's Keys and the Organizations, the tiles
 * repository, Zip, the conversations, Turns, Proposals and Applied repositories, the sandbox, the
 * model relay, and the database itself.
 */
type Repositories =
  | Auth
  | Allowlist
  | TurnKeys
  | Organizations
  | Database
  | Tiles
  | Zip
  | Conversations
  | Turns
  | Proposals
  | Applied
  | Sandbox
  | Anthropic

/**
 * The repositories the domains use: Better Auth, the allowlist, the Turn's Keys and the Organizations
 * for IAM, the tiles repository and Zip for Mapping, the conversations, Turns, Proposals and Applied
 * repositories, the sandbox and the model relay for Assistant; and the database itself, for the
 * transaction a program opens (`transactional`).
 */
const repositories: Layer.Layer<Repositories> = Layer.mergeAll(
  Layer.provideMerge(
    Layer.mergeAll(
      tilesLayer,
      conversationsLayer,
      turnsLayer,
      proposalsLayer,
      appliedLayer,
      turnKeysLayer,
      organizationsLayer,
    ),
    auth,
  ),
  allowlistLayer,
  zipLayer,
  sandbox,
  anthropic,
)

/**
 * Who reacts to which domain event: the API layer composes domains here, one `on(Event, reaction)`
 * per subscription. A reaction may use the repositories, which the bus is built over. Every change to
 * a System lands in the Conversation of the Account that made it, and a Tile shared in the one of
 * the Account it was shared with (`../assistant/recording.ts`).
 */
const subscriptions: ReadonlyArray<Subscription<Repositories>> = [
  recordedInConversation,
  toldShared,
]

/**
 * Every layer: the bus, built over the repositories its subscribers use, the domains' services and
 * the repositories below them, merged here as each is built, and the logger that sends to PostHog and
 * Sentry. Built once, on the first call, and shared by every request.
 */
const layer = Layer.mergeAll(
  Layer.provideMerge(serverBus(subscriptions), repositories),
  observability,
)

const runtime = ManagedRuntime.make(layer)

/**
 * The services a server function's program may use: the request's, the platform's `waitUntil`, and
 * every layer's.
 */
export type Services =
  | RequestContext
  | CurrentSession
  | CurrentKey
  | HttpExchange
  | WaitUntil
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
   * Only `/mcp` and the doors of a Turn's sandbox read the header; a server function's is always
   * none, as `middleware.ts` sets it.
   */
  readonly key: Exit.Exit<Option.Option<KeyProof>>
}

/** A request as Nitro hands it over (srvx's `ServerRequest`), with the platform's `waitUntil`. */
type PlatformRequest = Request & Pick<StartContext, 'waitUntil'>

function isPlatformRequest(request: Request): request is PlatformRequest {
  return 'waitUntil' in request && typeof request.waitUntil === 'function'
}

/**
 * The platform's `waitUntil`, which Nitro puts on the request: Vercel's on Vercel, srvx's own under
 * `pnpm dev`. Where there is none, the work still runs; nothing keeps the function up for it. Both
 * doors put it on the context they build.
 */
export function waitUntilOf(request: Request): StartContext['waitUntil'] {
  return (promise) => {
    if (isPlatformRequest(request)) request.waitUntil(promise)
  }
}

/**
 * What a door that a Key opens passes on of a request: where it was sent and its Bearer Key; never a
 * cookie. `/mcp` and the doors of a Turn's sandbox build their context on it.
 */
export function bearerOnly(request: Request): StartContext['exchange'] {
  const headers = new Headers()
  const authorization = request.headers.get('authorization')
  if (authorization !== null) headers.set('authorization', authorization)
  return { url: request.url, headers, setCookies: () => undefined }
}

/**
 * A request's body as a door reads it: its text, past the most bytes the door takes (`TooLarge`), or
 * cut off on the way (`Broken`), its client gone or its stream failed.
 */
export type ReadBody =
  | { readonly _tag: 'Read'; readonly text: string }
  | { readonly _tag: 'TooLarge' }
  | { readonly _tag: 'Broken' }

/**
 * A request's body as text, read a chunk at a time and given up past `longest` bytes without reading
 * the rest, its stream cancelled; not read at all when the length it declares is past it. A body cut
 * off on the way is `Broken`, never a rejection: a door answers it as it answers any refusal.
 */
export async function bodyOf(request: Request, longest: number): Promise<ReadBody> {
  if (Number(request.headers.get('content-length') ?? 0) > longest) return { _tag: 'TooLarge' }
  const reader = request.body?.getReader()
  if (reader === undefined) return { _tag: 'Read', text: '' }
  const chunks: Array<Uint8Array<ArrayBuffer>> = []
  let size = 0
  try {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      size += read.value.byteLength
      if (size > longest) {
        // What the client sends past it is never read, whether or not the cancel lands.
        await reader.cancel().catch(() => undefined)
        return { _tag: 'TooLarge' }
      }
      chunks.push(read.value)
    }
  } catch {
    return { _tag: 'Broken' }
  }
  return { _tag: 'Read', text: await new Blob(chunks).text() }
}

/**
 * A server function's Key: none, whatever its headers say, since a Key opens only `/mcp` and the doors
 * of a Turn's sandbox.
 */
export const noKey: StartContext['key'] = Exit.succeed(Option.none())

/**
 * The Session of a call through a door a Key opens: none, whatever its cookies say, since `/mcp` and
 * the doors of a Turn's sandbox take a Key alone.
 */
export const noSession: StartContext['session'] = Exit.succeed(Option.none())

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

/**
 * The Key a request's `Authorization: Bearer` header proves, if any, for `/mcp` and the doors of a
 * Turn's sandbox to put on their context before they read the body. Like `provenSession`, a failure to tell is kept, and `run` fails with it.
 */
export function provenKey(
  exchange: HttpExchange['Service'],
): Promise<Exit.Exit<Option.Option<KeyProof>>> {
  return runtime.runPromiseExit(keyProven.pipe(Effect.provideService(HttpExchange, exchange)))
}
