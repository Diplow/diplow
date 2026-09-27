import { createFileRoute } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/')({ component: Hello })

function Hello() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{m.hello_title()}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{m.hello_body()}</p>
    </main>
  )
}
