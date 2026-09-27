// Start's own settings: the middleware every server function runs through, before its handler.
import { createStart } from '@tanstack/react-start'

import { requestContext } from '#/api/server/middleware'

export const startInstance = createStart(() => ({ functionMiddleware: [requestContext] }))

// Registered so every handler's `context` is typed with what the middleware adds.
declare module '@tanstack/react-start' {
  interface Register {
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
