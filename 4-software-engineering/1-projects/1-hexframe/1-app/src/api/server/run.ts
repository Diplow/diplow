// The one helper every server function hands its Effect program to. Start's middleware puts the
// request's context on Start's `context`; the helper provides it as Effect services, runs the program
// on the one ManagedRuntime, and returns the value or the failure, encoded. Nothing else calls `run*`:
// eslint.config.ts says no.
import { Cause, Context, Effect, Exit, ManagedRuntime, Schema } from 'effect'

import { Failure, Unexpected, encodeFailure, type Outcome } from '../errors/failure'
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
 * Every layer: the bus, the domains' services and the repositories below them, merged here as each is
 * built. Built once, on the first call, and shared by every request.
 */
const layer = serverBus(subscriptions)

const runtime = ManagedRuntime.make(layer)

/** The services a server function's program may use: the request's context and every layer's. */
export type Services = RequestContext | ManagedRuntime.ManagedRuntime.Services<typeof runtime>

/** Start's `context`, as its middleware (./middleware.ts) fills it. */
export interface StartContext {
  readonly requestId: string
  /** The platform's: keeps the request's function up until the promise settles. */
  readonly waitUntil: (promise: Promise<unknown>) => void
}

const isFailure = Schema.is(Failure)

/**
 * The failure to send for a failed program: the one it declares, when that is all that went wrong
 * and the union knows it. A defect (even beside a declared failure), an interruption, or a value the
 * union does not know, reached through an untyped path, is reported and sent as `Unexpected`.
 */
async function failureOf<E extends Failure>(cause: Cause.Cause<E>, context: StartContext) {
  const declared = Cause.findErrorOption(cause)
  if (declared._tag === 'Some' && !Cause.hasDies(cause) && isFailure(declared.value)) {
    return declared.value
  }
  return reported(cause, context)
}

/**
 * Runs a server function's program and returns its outcome: the value, or the failure encoded with
 * the request id. Only failures in the union reach the client as they are; see `failureOf`.
 */
export async function run<A, E extends Failure>(
  context: StartContext,
  program: Effect.Effect<A, E, Services>,
): Promise<Outcome<A, E | Unexpected>> {
  const exit = await runtime.runPromiseExit(
    program.pipe(
      Effect.provideService(RequestContext, { requestId: context.requestId }),
      Effect.provideService(WaitUntil, (work) => {
        context.waitUntil(runtime.runPromise(work))
      }),
    ),
  )
  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value }
  const failure: E | Unexpected = await failureOf(exit.cause, context)
  return { ok: false, failure: encodeFailure(failure), requestId: context.requestId }
}

// Until Sentry is wired (HEX-19), the report is Effect's logger, which prints to the server's log.
async function reported(cause: Cause.Cause<unknown>, context: StartContext) {
  await runtime.runPromise(
    Effect.logError('A server function failed unexpectedly', cause).pipe(
      Effect.annotateLogs({ requestId: context.requestId }),
    ),
  )
  return new Unexpected()
}
