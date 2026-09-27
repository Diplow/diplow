import handler from '@tanstack/react-start/server-entry'

import { paraglideMiddleware } from '#/paraglide/server'

export default {
  fetch(request: Request): Promise<Response> {
    // The router already de-localizes the URL (router.tsx), so it gets the original request, not Paraglide's.
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
}
