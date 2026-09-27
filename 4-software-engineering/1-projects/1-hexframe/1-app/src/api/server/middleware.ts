// Start's middleware stays promise-based: it puts what it knows about the request on Start's
// `context`, and the helper (./run.ts) hands it to the program as Effect services. src/start.ts runs it
// before every server function. IAM's Session joins the request id here once IAM is built.
import { createMiddleware } from '@tanstack/react-start'

import type { StartContext } from './run'

export const requestContext = createMiddleware({ type: 'function' }).server(({ next }) => {
  const context: StartContext = { requestId: crypto.randomUUID() }
  return next({ context })
})
