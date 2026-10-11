// A System as home shows it, on fixtures: the canvas with the breadcrumb above it, and the
// Conversation beside it, its composer offering the fixture's Tiles to `@` beside the Mode's switch, a
// Message's link centering the canvas, and its open Proposal accepted or discarded in the page alone.
// The view lives in the search params, as on /dev/hex.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { Conversation } from '#/front/features/conversation/Conversation'
import { conversationFixture, fixtureMentionables } from '#/front/features/conversation/fixtures'
import { splitByDay } from '#/front/features/conversation/timeline/timeline'
import { type Entry, type Fate, type Mode, undoneEntry } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { ulysse } from '#/front/ui/canvas/fixtures'
import { centerOn, readCanvasView, type CanvasView } from '#/front/ui/canvas/view/view'

export const Route = createFileRoute('/dev/system')({
  validateSearch: readCanvasView,
  // Days and times are the reader's own; a server in another time zone would draw other ones.
  ssr: false,
  component: SystemPage,
})

function SystemPage() {
  const view = Route.useSearch()
  const navigate = Route.useNavigate()
  // The fixture stands in for what the server will know; what the user sends is kept for the page.
  const [fixture] = useState(() => conversationFixture(new Date()))
  const [entries, setEntries] = useState(fixture.entries)
  const [tiles] = useState(fixtureMentionables)
  const [mode, setMode] = useState<Mode>('ask')
  const onViewChange = (next: CanvasView) => {
    void navigate({ search: next })
  }
  const onSend = (text: string) => {
    const sent: Entry = {
      _tag: 'Message',
      id: crypto.randomUUID(),
      at: new Date(),
      author: 'user',
      text,
    }
    setEntries((before) => [...before, sent])
  }
  // The page decides a Proposal for itself: no server keeps the fixture's.
  const decided = (fate: Fate) => (proposal: string) => {
    setEntries((before) =>
      before.map((entry) =>
        entry._tag === 'Proposal' && entry.proposal === proposal ? { ...entry, fate } : entry,
      ),
    )
  }
  // And undoes what was applied for itself, the Entry saying so (Assistant's `undoneEntry`).
  const undo = (applied: string) => {
    setEntries((before) =>
      before.map((entry) => {
        const offers =
          (entry._tag === 'Proposal' && entry.proposal === applied) ||
          (entry._tag === 'TurnApplied' && entry.turn === applied)
        return offers ? { ...entry, ...undoneEntry(entry) } : entry
      }),
    )
  }
  return (
    <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4.25rem)] lg:grid-cols-[minmax(0,1fr)_24rem]">
      <h1 className="sr-only">{m.dev_system_title()}</h1>
      <div className="grid min-h-0 content-start gap-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:content-stretch">
        <Breadcrumb system={ulysse} view={view} onViewChange={onViewChange} />
        <Canvas
          system={ulysse}
          view={view}
          onViewChange={onViewChange}
          className="h-full max-h-[80dvh] w-full lg:max-h-none"
        />
      </div>
      <Conversation
        days={splitByDay(entries, new Date(), fixture.titles)}
        onSend={onSend}
        tiles={tiles}
        onCenter={(tile) => {
          onViewChange(centerOn(ulysse, tile))
        }}
        mode={{ mode, choose: setMode }}
        decide={{
          accept: decided('accepted'),
          discard: decided('discarded'),
          undo,
          pending: false,
        }}
        className="h-[32rem] lg:h-auto lg:min-h-0"
      />
    </main>
  )
}
