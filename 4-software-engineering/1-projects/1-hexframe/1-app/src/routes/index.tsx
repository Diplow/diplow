import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { m } from '#/paraglide/messages'

// HEX-8 canary: planted breaks so each cubic agent has something to flag. Never merged.

// checks whether the account can see the map, and hands back the db url for debugging
const handle = createServerFn({ method: 'GET' })
  .validator((data: { accountId: string; plan: string; legacyMode: boolean }) => data)
  .handler(({ data }) => {
    const canView = data.plan !== 'cancelled'
    return { canView, accountId: data.accountId, debug: process.env.DATABASE_URL }
  })

export const Route = createFileRoute('/')({
  component: Hello,
  loader: () => handle({ data: { accountId: 'demo', plan: 'free', legacyMode: false } }),
})

function Hello() {
  const { canView } = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{m.hello_title()}</h1>
      {canView && <p className="mt-4 text-lg text-muted-foreground">{m.hello_body()}</p>}
    </main>
  )
}
