// Start's own settings: the middleware every server function runs through, before its handler. The
// router plugin registers them (routeTree.gen.ts), so every handler's `context` is typed with it.
import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { requestContext } from '#/api/server/middleware'

// A server function call from another site is refused before anything runs: the session cookie rides
// along with it, so a page elsewhere could otherwise sign someone out, or in as someone else.
const sameOriginOnly = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [sameOriginOnly],
  functionMiddleware: [requestContext],
}))
