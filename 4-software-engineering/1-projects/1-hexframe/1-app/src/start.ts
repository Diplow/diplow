// Start's own settings: the middleware every server function runs through, before its handler. The
// router plugin registers them (routeTree.gen.ts), so every handler's `context` is typed with it.
import { createStart } from '@tanstack/react-start'

import { requestContext, sameOriginOnly } from '#/api/server/middleware'

export const startInstance = createStart(() => ({
  requestMiddleware: [sameOriginOnly],
  functionMiddleware: [requestContext],
}))
