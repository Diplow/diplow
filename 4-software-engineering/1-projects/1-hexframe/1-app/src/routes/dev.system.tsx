// A System as the app will show it, on fixtures: the Conversation left, the canvas center, the
// breadcrumb rail right. The view lives in the search params, as on /dev/hex.
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'

import { Breadcrumb } from '#/features/breadcrumb/Breadcrumb'
import { Conversation } from '#/features/conversation/Conversation'
import { conversationFixture } from '#/features/conversation/fixtures'
import type { Entry } from '#/features/conversation/timeline'
import { m } from '#/paraglide/messages'
import { Canvas } from '#/ui/hex/Canvas'
import { ulysse } from '#/ui/hex/fixtures'
import { readCanvasView, type CanvasView } from '#/ui/hex/view/view'

export const Route = createFileRoute('/dev/system')({
  // A dev page, like /dev/ui: production answers 404 (vite.config.ts).
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!__DEV_PAGES__) throw notFound()
  },
  validateSearch: readCanvasView,
  // Days and times are the reader's own; a server in another time zone would draw other ones.
  ssr: false,
  component: SystemPage,
})

function SystemPage() {
  const view = Route.useSearch()
  const navigate = Route.useNavigate()
  // The fixture stands in for what the server will know; what the user sends is kept for the page.
  const [entries, setEntries] = useState(() => conversationFixture(new Date()))
  const onViewChange = (next: CanvasView) => {
    void navigate({ search: next })
  }
  const onSend = (text: string) => {
    const sent: Entry = {
      kind: 'message',
      id: crypto.randomUUID(),
      at: new Date(),
      author: 'user',
      text,
    }
    setEntries((before) => [...before, sent])
  }
  return (
    <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4.25rem)] lg:grid-cols-[22rem_minmax(0,1fr)_12rem]">
      <h1 className="sr-only">{m.dev_system_title()}</h1>
      <Conversation entries={entries} onSend={onSend} className="h-[32rem] lg:h-auto" />
      <Canvas
        system={ulysse}
        view={view}
        onViewChange={onViewChange}
        className="h-full max-h-[80dvh] w-full lg:max-h-none"
      />
      <Breadcrumb system={ulysse} view={view} onViewChange={onViewChange} />
    </main>
  )
}
