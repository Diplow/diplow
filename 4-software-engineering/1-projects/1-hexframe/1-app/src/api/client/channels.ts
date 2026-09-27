// The channels, carried out: each failure goes where the channel table (../errors/channel.ts) sends it,
// so a feature writes no error handling. Reads and writes are wired in the QueryClient, a form's submit
// in `submitWrite`; ReadBoundary shows what belongs in the nearest boundary.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { localizeHref } from '#/paraglide/runtime'
import { toast } from '#/ui/feedback/Toaster'

import { channelFor, type Call } from '../errors/channel'
import type { Failure, Outcome } from '../errors/failure'
import { messageFor } from '../errors/messages'
import { asCallFailed, settle, type CallFailed } from './calls'

let signingIn = false

// One redirect, however many calls fail at once, carrying where the user was. HEX-18 builds the page.
// On the server there is no window to move: a read made while rendering a page is IAM's to guard,
// with a route's `beforeLoad` redirect, before anything is rendered.
function signIn() {
  if (signingIn || typeof window === 'undefined') return
  signingIn = true
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(localizeHref(`/sign-in?redirect=${encodeURIComponent(here)}`))
}

// Until Sentry is wired (HEX-19), a report is the browser's console, with the request id to trace it.
function report({ failure, scope, requestId }: CallFailed) {
  console.error(`${scope} failed: ${failure._tag} (${failure.kind})`, { requestId })
}

/**
 * Carries out the channels that show nothing in place: the sign-in redirect, the report and the toast.
 * The boundary's states and a form's fields are shown where they belong, by ReadBoundary and
 * `submitWrite`.
 */
function raise(failed: CallFailed, call: Call) {
  const channel = channelFor(call, failed.failure.kind)
  if (channel === 'sign-in') signIn()
  else if (channel === 'report') report(failed)
  else if (channel === 'toast') toast.error(messageFor(failed.failure, failed.scope))
}

/** Whether a read's failure shows in the nearest boundary, which is where the query throws it. */
function showsInBoundary(error: unknown, scope: string) {
  const channel = channelFor('read', asCallFailed(error, scope).failure.kind)
  return channel === 'forbidden' || channel === 'error-state'
}

/**
 * The client's QueryClient, one per router: every read's and write's failure goes to its channel. A
 * query that did not come from `read` counts as a read, and its scope is its key's first part.
 */
export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        raise(asCallFailed(error, String(query.queryKey[0])), query.meta?.call ?? 'read')
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        raise(asCallFailed(error, 'write'), 'write')
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

interface SubmitWrite<I, A, E extends Failure> {
  scope: string
  call: (input: I) => Promise<Outcome<A, E>>
  onSaved: (value: A) => void
}

/**
 * A form's submit that writes, as the form's `validators.onSubmitAsync`: an `Invalid` failure shows on
 * the fields it names, any other goes to its channel and keeps the submit from counting as done.
 */
export function submitWrite<I, A, E extends Failure>({
  scope,
  call,
  onSaved,
}: SubmitWrite<I, A, E>) {
  return async ({ value }: { value: I }) => {
    try {
      onSaved(await settle(scope, call(value)))
      return undefined
    } catch (error) {
      const failed = asCallFailed(error, scope)
      const { failure } = failed
      const message = messageFor(failure, scope)
      if (failure.kind === 'Invalid' && channelFor('submit', failure.kind) === 'fields') {
        return { fields: Object.fromEntries(failure.fields.map((field) => [field, message])) }
      }
      raise(failed, 'submit')
      return { form: message }
    }
  }
}
