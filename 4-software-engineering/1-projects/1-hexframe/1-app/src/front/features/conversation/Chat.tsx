// The chat on home, in the screen's two slots. `ChatTimeline`, the Account's own Conversation, read a
// day at a time, today first and each earlier day holding an Entry as the reader asks for it, a
// Message's link handing its Tile to the route to center, an open Proposal accepted or discarded where
// it stands, and what was applied undone. `ChatComposer`, the input, whose Message the route posts
// after the navigation it follows, saying so when the Account may not use the Assistant. While a Turn
// runs, as the route's poll last saw it, the input waits, and the agent's step shows beside a Stop. The
// input offers the Account's Tiles to `@`, from the System the page holds. The Mode, as the poll last
// saw it, shows beside the input, switched through `useSetMode`, the one switched to shown while the
// switch is on its way. Each is shown inside a ReadBoundary, which a failed read lands in.
import { useMemo } from 'react'

import type { Mode } from '#/domains/assistant/entities'
import {
  useAcceptProposal,
  useAssistantAvailable,
  useConversation,
  useDiscardProposal,
  useSetMode,
  useStopTurn,
  useUndo,
} from '#/front/client/assistant/conversation'
import type { LiveTurn } from '#/front/client/assistant/follow'
import { useSystem } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/atoms/skeleton'

import { mentionablesOf } from './composer/mention'
import { ConversationFoot, Timeline } from './Conversation'
import { dayOf } from './timeline/timeline'

interface ChatTimelineProps {
  /** Centers the canvas on a Tile a Message links. */
  onCenter: (tile: string) => void
  className?: string
}

export function ChatTimeline({ onCenter, className }: ChatTimelineProps) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  const accepting = useAcceptProposal()
  const discarding = useDiscardProposal()
  const undoing = useUndo()
  if (data === undefined) return <Skeleton className="h-40" />
  const now = new Date()
  // The pages come today first; the timeline reads oldest first.
  const days = data.pages.map(({ day, entries, titles }) =>
    dayOf({ date: day.date, entries, titles }, now),
  )
  return (
    <Timeline
      days={days.toReversed()}
      onCenter={onCenter}
      earlier={
        hasNextPage
          ? {
              show: () => {
                void fetchNextPage()
              },
              pending: isFetchingNextPage,
            }
          : undefined
      }
      decide={{
        accept: (proposal) => {
          accepting.mutate(proposal)
        },
        discard: (proposal) => {
          discarding.mutate(proposal)
        },
        undo: (applied) => {
          undoing.mutate(applied)
        },
        pending: accepting.isPending || discarding.isPending || undoing.isPending,
      }}
      className={className}
    />
  )
}

interface ChatComposerProps {
  /** A Message the user sent, trimmed and never empty; none while nothing can be sent yet. */
  onSend: ((text: string) => void) | undefined
  /** The Turn running, as the page's poll last saw it. */
  turn: LiveTurn | undefined
  /** The Conversation's Mode, as the page's poll last saw it; none before its first answer. */
  mode: Mode | undefined
}

export function ChatComposer({ onSend, turn, mode }: ChatComposerProps) {
  // The System read without throwing: a failed read shows on the canvas, and the chat stays up.
  const { data: system } = useSystem({ throwing: false })
  const root = system?.root
  const tiles = useMemo(
    () => (root === undefined ? [] : mentionablesOf(root, m.system_untitled())),
    [root],
  )
  const { data: available } = useAssistantAvailable()
  const { mutate: stop, isPending: stopping } = useStopTurn()
  const switching = useSetMode()
  // The Mode switched to shows while the switch is on its way, then the poll says it.
  const shownMode = switching.isPending ? switching.variables : mode
  return (
    <ConversationFoot
      onSend={(text) => onSend?.(text)}
      tiles={tiles}
      // Until it is read, or when reading it failed, the composer says nothing either way.
      unavailable={available === false}
      running={
        turn === undefined
          ? undefined
          : {
              step: turn.step,
              stop: () => {
                stop()
              },
              stopping,
            }
      }
      waiting={onSend === undefined}
      mode={
        shownMode === undefined
          ? undefined
          : {
              mode: shownMode,
              choose: (chosen) => {
                switching.mutate(chosen)
              },
            }
      }
    />
  )
}
