import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { makeQueryClient } from '#/front/client/channels'
import { startObservability } from '#/api/observability/client'
import { deLocalizeUrl, localizeUrl } from '#/paraglide/runtime'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  // One per router, so one per request on the server: a user's reads never reach another's page.
  const queryClient = makeQueryClient()
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  // In the browser, once: Sentry, whose traces follow the router, and PostHog. Nothing on the server.
  startObservability(router)
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
