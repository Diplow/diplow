// How the client calls a server function run by the helper: the outcome is settled into the value, or
// thrown as a CallFailed holding the failure decoded back into its tagged class. A feature builds its
// reads and writes with `read` and `write` and handles no error: the channels do (./channels.ts).
import { mutationOptions, queryOptions, type QueryKey } from '@tanstack/react-query'

import type { Call } from '#/api/report/errors/channel'
import { Unexpected, decodeFailure, type Failure, type Outcome } from '#/api/report/errors/failure'

/** A call that failed: its failure decoded, the scope it was made in, and the request id if any. */
export class CallFailed extends Error {
  readonly failure: Failure
  readonly scope: string
  /** Absent when the call never reached the helper: the network, or Start itself, failed. */
  readonly requestId: string | undefined

  /** `cause`: what the call threw instead of an outcome, kept for Sentry. */
  constructor(failure: Failure, scope: string, requestId?: string, cause?: unknown) {
    super(`${scope} failed: ${failure._tag}`, { cause })
    this.name = 'CallFailed'
    this.failure = failure
    this.scope = scope
    this.requestId = requestId
  }
}

/**
 * A refusal the client foresaw, deciding as Mapping would on the System it holds, before sending: the
 * call was never made, so the server logged nothing and there is nothing to report.
 */
export class Foreseen extends CallFailed {
  constructor(failure: Failure, scope: string) {
    super(failure, scope)
    this.name = 'Foreseen'
  }
}

/** Any error a call threw, as a CallFailed: what is not one already is `Unexpected`. */
export function asCallFailed(error: unknown, scope: string): CallFailed {
  return error instanceof CallFailed
    ? error
    : new CallFailed(new Unexpected(), scope, undefined, error)
}

/**
 * Awaits a server function's outcome: its value, or a CallFailed. `scope` names the server function,
 * and narrows the message table's entries.
 */
export async function settle<A, E extends Failure>(
  scope: string,
  call: Promise<Outcome<A, E>>,
): Promise<A> {
  let outcome: unknown
  try {
    outcome = await call
  } catch (error) {
    throw asCallFailed(error, scope)
  }
  // The type says Outcome; what came over the wire is only checked here.
  if (!isOutcome(outcome)) throw new CallFailed(new Unexpected(), scope)
  if (outcome.ok) return outcome.value as A
  const requestId = typeof outcome.requestId === 'string' ? outcome.requestId : undefined
  throw new CallFailed(decodeFailure(outcome.failure), scope, requestId)
}

type Received = { ok: true; value: unknown } | { ok: false; failure?: unknown; requestId?: unknown }

function isOutcome(value: unknown): value is Received {
  return (
    typeof value === 'object' && value !== null && 'ok' in value && typeof value.ok === 'boolean'
  )
}

interface ReadOptions<A, E extends Failure> {
  scope: string
  key: QueryKey
  call: () => Promise<Outcome<A, E>>
  /** A read that frames every page: its failure is reported, and nothing shows on screen. */
  frame?: boolean
}

/** The query options of a read, for `useQuery`: keyed by its scope, its mode, then `key`. */
export function read<A, E extends Failure>({ scope, key, call, frame = false }: ReadOptions<A, E>) {
  return queryOptions({
    // The mode is in the key: the same call as a read and as a frame read are two queries.
    queryKey: [scope, frame ? 'frame' : 'read', ...key],
    queryFn: () => settle(scope, call()),
    meta: { call: frame ? 'frame' : 'read' },
  })
}

/**
 * The call a write is, which picks where its failure goes: a `write`, or a form's `submit`, whose
 * `Invalid` refusal shows on the form's fields.
 */
export type WriteCall = Extract<Call, 'write' | 'submit'>

interface WriteOptions {
  /** `submit` for the write a form sends; `write` when absent. */
  as?: WriteCall
  /**
   * The queue the write waits its turn in: the writes of one queue run one after another, in the
   * order they were made, each once the one before it settled, refused or not.
   */
  queue?: string
}

/**
 * What places a write among the others, for `useMutation`: keyed by its scope, its call in its meta,
 * so the QueryClient sends its failure to its channel and `useMutationState` finds it, and in its
 * queue, if any. `write` builds every write on it; a write whose function `write` can't build, an
 * import's, spreads it beside its own.
 */
export function writing(scope: string, { as = 'write', queue }: WriteOptions = {}) {
  return {
    mutationKey: [scope],
    meta: { call: as },
    ...(queue !== undefined && { scope: { id: queue } }),
  }
}

/** The mutation options of a write, for `useMutation`, placed by `writing`. */
export function write<I, A, E extends Failure>(
  scope: string,
  call: (input: I) => Promise<Outcome<A, E>>,
  options: WriteOptions = {},
) {
  return mutationOptions({
    ...writing(scope, options),
    mutationFn: (input: I) => settle(scope, call(input)),
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: CallFailed
    queryMeta: { call: 'read' | 'frame' }
    mutationMeta: { call: WriteCall }
  }
}
