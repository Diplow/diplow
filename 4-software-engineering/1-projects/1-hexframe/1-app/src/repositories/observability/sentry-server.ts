// Sentry on the server, behind the observability seam: the server entry traced, and the ErrorTracker
// the runtime reports through. Server only: the SDK's browser build has no `wrapFetchWithSentry`.
import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'
import { Context, Layer } from 'effect'

import { captureError } from './sentry'

interface ServerEntry {
  fetch: (request: Request) => Promise<Response>
}

/** The server entry, each request a trace once Sentry is started. */
export function traced(entry: ServerEntry): ServerEntry {
  const wrapped = wrapFetchWithSentry(entry)
  return { fetch: async (request) => wrapped.fetch(request) }
}

/** Sentry, as the server's runtime sees it: where an error goes, and the id of the event it made. */
export class ErrorTracker extends Context.Service<
  ErrorTracker,
  { readonly capture: typeof captureError }
>()('hexframe/ErrorTracker') {}

/** The ErrorTracker over Sentry's SDK: nothing is sent, and no id comes back, while Sentry is off. */
export const errorTracker = Layer.succeed(ErrorTracker, { capture: captureError })
