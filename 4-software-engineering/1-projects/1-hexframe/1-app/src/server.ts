import handler from '@tanstack/react-start/server-entry'

import { observedEntry } from '#/api/report/observability/server'
import { paraglideMiddleware } from '#/paraglide/server'

// Sentry starts here, before the first request, and traces each one (src/api/report/observability/).
export default observedEntry({
  fetch(request: Request): Promise<Response> {
    // The router already de-localizes the URL (router.tsx), so it gets the original request, not Paraglide's.
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
})
