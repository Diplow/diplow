// Start's middleware stays promise-based: it puts what it knows about the request on Start's
// `context`, and the helper (./run.ts) hands it to the program as Effect services. src/start.ts runs it
// before every server function. IAM's Session joins the request id here once IAM is built.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import type { StartContext } from './run'

/**
 * The platform's `waitUntil`, which Nitro puts on the request: Vercel's on Vercel, srvx's own under
 * `pnpm dev`. Where there is none, the work still runs; nothing keeps the function up for it.
 */
function waitUntilOf(request: Request): StartContext['waitUntil'] {
  return (promise) => {
    if ('waitUntil' in request && typeof request.waitUntil === 'function') {
      request.waitUntil(promise)
    }
  }
}

export const requestContext = createMiddleware({ type: 'function' }).server(({ next }) => {
  const context: StartContext = {
    requestId: crypto.randomUUID(),
    waitUntil: waitUntilOf(getRequest()),
  }
  return next({ context })
})
