// The one helper every server function hands its Effect program to. Start's middleware puts the
// request's context on Start's `context`; the helper provides it as Effect services, runs the program
// on the one ManagedRuntime, and returns the value or the failure, encoded. Nothing else calls `run*`:
// eslint.config.ts says no.
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime } from 'effect'

import { Unexpected, encodeFailure, type Failure, type Outcome } from '../errors/failure'

/** What Start's middleware knows about the request, as a program sees it. */
export class RequestContext extends Context.Service<
  RequestContext,
  { readonly requestId: string }
>()('hexframe/RequestContext') {}

/**
 * Every layer: the domains' services and the repositories below them, merged here as each is built.
 * Built once, on the first call, and shared by every request.
 */
const layer = Layer.empty

const runtime = ManagedRuntime.make(layer)

/**
 * The services a server function's program may use: the request's context and, as each layer joins
 * `layer`, its services (`ManagedRuntime.ManagedRuntime.Services<typeof runtime>`).
 */
export type Services = RequestContext

/** Start's `context`, as its middleware (./middleware.ts) fills it. */
export interface StartContext {
  readonly requestId: string
}

/**
 * Runs a server function's program and returns its outcome. A failure the program declares is sent
 * encoded; a defect, an interruption or a failure outside the union becomes `Unexpected`, reported
 * with the request id and never sent as it is.
 */
export async function run<A, E extends Failure>(
  context: StartContext,
  program: Effect.Effect<A, E, Services>,
): Promise<Outcome<A, E | Unexpected>> {
  const exit = await runtime.runPromiseExit(
    program.pipe(Effect.provideService(RequestContext, { requestId: context.requestId })),
  )
  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value }
  const declared = Cause.findErrorOption(exit.cause)
  const failure: E | Unexpected =
    declared._tag === 'Some' ? declared.value : await reported(exit.cause, context)
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
