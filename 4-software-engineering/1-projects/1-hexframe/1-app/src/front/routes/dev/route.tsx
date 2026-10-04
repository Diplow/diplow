// Every /dev page's layout, and its one guard: served by `pnpm dev` and on Vercel previews, a 404 in
// production (vite.config.ts). A page added under dev/ is guarded by being there.
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/dev')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!__DEV_PAGES__) throw notFound()
  },
})
