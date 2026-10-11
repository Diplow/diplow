// The Conversation on /design-system, on fixtures: four days of Entries, the composer offering the
// fixture's Tiles to `@` beside the Mode's switch, a Message's link handed to the page to center its
// canvas, and the open Proposal accepted, discarded or undone in the page alone. Days and times are the
// reader's own, so the page draws it in the browser only.
import { ClientOnly } from '@tanstack/react-router'
import { useState } from 'react'

import { type Entry, type Fate, type Mode, undoneEntry } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import { GallerySection, GalleryState } from '#/front/ui/gallery/frame'

import { Conversation } from './Conversation'
import { conversationFixture, fixtureMentionables } from './fixtures'
import { splitByDay } from './timeline/timeline'

const size = 'h-[32rem] w-[24rem] max-w-full'

export function ConversationGallery({ onCenter }: { onCenter: (tile: string) => void }) {
  return (
    <GallerySection name="Conversation">
      <GalleryState label={m.gallery_state_on_fixtures()}>
        <ClientOnly fallback={<Skeleton className={size} />}>
          <FixtureConversation onCenter={onCenter} />
        </ClientOnly>
      </GalleryState>
    </GallerySection>
  )
}

function FixtureConversation({ onCenter }: { onCenter: (tile: string) => void }) {
  // The fixture stands in for what the server will know; what the user sends is kept for the page.
  const [fixture] = useState(() => conversationFixture(new Date()))
  const [entries, setEntries] = useState(fixture.entries)
  const [tiles] = useState(fixtureMentionables)
  const [mode, setMode] = useState<Mode>('ask')
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
    <Conversation
      days={splitByDay(entries, new Date(), fixture.titles)}
      onSend={onSend}
      tiles={tiles}
      onCenter={onCenter}
      mode={{ mode, choose: setMode }}
      decide={{
        accept: decided('accepted'),
        discard: decided('discarded'),
        undo,
        pending: false,
      }}
      className={size}
    />
  )
}
