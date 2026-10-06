// The channels, carried out: each failure goes where the channel table (src/api/errors/channel.ts) sends it,
// so a feature writes no error handling. Reads and writes, a form's included, are wired in the
// QueryClient, and a form shows its write's refusal through `submitMutation`; `submitWrite` is a form's
// submit kept out of every cache, for a secret; ReadBoundary shows what belongs in the nearest boundary.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { deLocalizeHref, localizeHref } from '#/paraglide/runtime'
import { toast } from '#/front/ui/feedback/Toaster'
import { channelFor, type Call } from '#/api/errors/channel'
import type { Failure, Outcome } from '#/api/errors/failure'
import { messageFor } from '#/api/errors/messages'
import { forget, reportError } from '#/api/observability/client'

import { CallFailed, asCallFailed, settle } from './calls'

let signingIn = false

// One redirect, however many calls fail at once, carrying where the user was, without its language
// prefix, as the router's own redirect (./iam/guard.ts) carries it, and untying this device from the
// Account whose Session ended, as that guard does. On the server there is no window to move: a read
// made while rendering a page is guarded by the route's `beforeLoad`, `signedInOnly`.
function signIn() {
  if (signingIn || typeof window === 'undefined') return
  signingIn = true
  forget()
  const here = deLocalizeHref(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
  window.location.assign(localizeHref(`/sign-in?redirect=${encodeURIComponent(here)}`))
}

/**
 * Carries out the channels that show nothing in place: the sign-in redirect and the toast. The
 * boundary's states and a form's fields are shown where they belong, by ReadBoundary and the form's
 * submit (`submitMutation`, `submitWrite`). The report is the server's: it logged every failure it sent, with the request id,
 * so the client reports only a call that never reached it.
 */
function raise(failed: CallFailed, call: Call) {
  const { failure, scope } = failed
  if (failed.requestId === undefined) {
    reportError(failed, { scope, kind: failure.kind, code: failure._tag })
  }
  const channel = channelFor(call, failure.kind)
  if (channel === 'sign-in') signIn()
  else if (channel === 'toast') toast.error(messageFor(failure, scope))
}

/**
 * What ReadBoundary does with what it caught: a bug thrown while rendering is reported, since nothing
 * else saw it. A read's failure, a CallFailed, went to its channel already, through the QueryCache.
 */
export function caught(error: unknown) {
  if (!(error instanceof CallFailed)) reportError(error, { scope: 'render' })
}

/** Whether a read's failure shows in the nearest boundary, which is where the query throws it. */
function showsInBoundary(error: unknown, scope: string) {
  const channel = channelFor('read', asCallFailed(error, scope).failure.kind)
  return channel === 'forbidden' || channel === 'error-state'
}

/**
 * The client's QueryClient, one per router: every read's and write's failure goes to its channel. A
 * query that did not come from `read` counts as a read, a mutation that did not come from `write` as a
 * write, and the scope of either is its key's first part.
 */
export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        raise(asCallFailed(error, String(query.queryKey[0])), query.meta?.call ?? 'read')
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        const [scope] = mutation.options.mutationKey ?? []
        raise(
          asCallFailed(error, typeof scope === 'string' ? scope : 'write'),
          mutation.meta?.call ?? 'write',
        )
      },
    }),
    defaultOptions: {
      queries: {
        // The server answered; asking again would get the same answer. The boundary offers a retry.
        retry: false,
        throwOnError: (error, query) =>
          query.meta?.call !== 'frame' && showsInBoundary(error, String(query.queryKey[0])),
      },
    },
  })
}

/**
 * A submit's outcome: its value, or the `Invalid` failure among those its call lists, which the
 * channel table shows on the form's fields.
 */
export type Submitted<A, E extends Failure> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly failure: Extract<E, { kind: 'Invalid' }> }

/**
 * Settles a submit: its value, or its `Invalid` failure, for the form to show. Any other failure is
 * thrown, a CallFailed, for the mutation that made the call to carry to its channel, through the
 * QueryClient.
 */
export async function settleSubmit<A, E extends Failure>(
  scope: string,
  call: Promise<Outcome<A, E>>,
): Promise<Submitted<A, E>> {
  try {
    return { ok: true, value: await settle(scope, call) }
  } catch (error) {
    const failed = asCallFailed(error, scope)
    const { failure } = failed
    if (failure.kind === 'Invalid' && channelFor('submit', failure.kind) === 'fields') {
      // The wire's failure is one the call lists, as `settle`'s value is the call's.
      return { ok: false, failure: failure as Extract<E, { kind: 'Invalid' }> }
    }
    throw failed
  }
}

/** What a form shows of its write's failure, for TanStack Form: on the fields, or on the form. */
export type FormErrors = { fields: Record<string, string> } | { form: string }

/**
 * What a form shows of the failure its write met, which its channel has carried out already: an
 * `Invalid` refusal's message on each field it names; any other's on the form, which keeps the submit
 * from counting as done.
 */
function shownOnForm({ failure, scope }: CallFailed): FormErrors {
  const message = messageFor(failure, scope)
  if (failure.kind === 'Invalid' && channelFor('submit', failure.kind) === 'fields') {
    return { fields: Object.fromEntries(failure.fields.map((field) => [field, message])) }
  }
  return { form: message }
}

interface SubmitMutation<V, A> {
  /** The scope of the write, the one its mutation is keyed by, for a failure that names none. */
  scope: string
  /** Sends the form's value through the write's mutation, `mutateAsync`, as a `submit` (`write`). */
  mutate: (value: V) => Promise<A>
  onSaved: (value: A) => void
}

/**
 * A form's submit through a mutation, as the form's `validators.onSubmitAsync`: the QueryClient carries
 * its failure to its channel, as any write's, and the form shows the mutation's error, an `Invalid`
 * one on the fields it names.
 */
export function submitMutation<V, A>({ scope, mutate, onSaved }: SubmitMutation<V, A>) {
  return async ({ value }: { value: V }): Promise<FormErrors | undefined> => {
    try {
      onSaved(await mutate(value))
      return undefined
    } catch (error) {
      return shownOnForm(asCallFailed(error, scope))
    }
  }
}

interface SubmitWrite<I, A, E extends Failure> {
  scope: string
  call: (input: I) => Promise<Outcome<A, E>>
  onSaved: (value: A) => void
}

/**
 * A form's submit that writes outside every cache, as the form's `validators.onSubmitAsync`, for a
 * write whose input or answer is a secret no cache may keep: a password, a Key's secret. An `Invalid`
 * failure shows on the fields it names, any other goes to its channel and keeps the submit from
 * counting as done.
 */
export function submitWrite<I, A, E extends Failure>({
  scope,
  call,
  onSaved,
}: SubmitWrite<I, A, E>) {
  return async ({ value }: { value: I }): Promise<FormErrors | undefined> => {
    try {
      onSaved(await settle(scope, call(value)))
      return undefined
    } catch (error) {
      const failed = asCallFailed(error, scope)
      raise(failed, 'submit')
      return shownOnForm(failed)
    }
  }
}
