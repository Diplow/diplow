// How the client calls a server function run by the helper: the outcome is settled into the value, or
// thrown as a CallFailed holding the failure decoded back into its tagged class. A feature builds its
// reads and writes with `read` and `write` and handles no error: the channels do (./channels.ts).
import { mutationOptions, queryOptions, type QueryKey } from '@tanstack/react-query'

import { Unexpected, decodeFailure, type Failure, type Outcome } from '../errors/failure'

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

/** The mutation options of a write, for `useMutation`. */
export function write<I, A, E extends Failure>(
  scope: string,
  call: (input: I) => Promise<Outcome<A, E>>,
) {
  return mutationOptions({ mutationFn: (input: I) => settle(scope, call(input)) })
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: CallFailed
    queryMeta: { call: 'read' | 'frame' }
  }
}
