// The chat on home: the Account's own Conversation, read a day at a time, today first and each earlier
// day holding an Entry as the reader asks for it, and the input, whose Message the route posts after
// the navigation it follows, saying so when the Account may not use the Assistant. While a Turn runs,
// as the route's poll last saw it, the input waits, and the agent's step shows beside a Stop. The input
// offers the Account's Tiles to `@`, from the System the page holds, and a Message's link hands its
// Tile to the route to center. The Mode, as the poll last saw it, shows beside the input, switched
// through `useSetMode`, the one switched to shown while the switch is on its way; an open Proposal is
// accepted or discarded where it stands. Shown inside a ReadBoundary, which a failed read lands in.
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
import { Skeleton } from '#/front/ui/feedback/skeleton'

import { mentionablesOf } from './composer/mention'
import { Conversation } from './Conversation'
import { dayOf } from './timeline/timeline'

interface ChatProps {
  /** A Message the user sent, trimmed and never empty; none while nothing can be sent yet. */
  onSend: ((text: string) => void) | undefined
  /** The Turn running, as the page's poll last saw it. */
  turn: LiveTurn | undefined
  /** The Conversation's Mode, as the page's poll last saw it; none before its first answer. */
  mode: Mode | undefined
  /** Centers the canvas on a Tile a Message links. */
  onCenter: (tile: string) => void
  className?: string
}

export function Chat({ onSend, turn, mode, onCenter, className }: ChatProps) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  const { data: system } = useSystem()
  const root = system?.root
  const tiles = useMemo(
    () => (root === undefined ? [] : mentionablesOf(root, m.system_untitled())),
    [root],
  )
  const { data: available } = useAssistantAvailable()
  const { mutate: stop, isPending: stopping } = useStopTurn()
  const switching = useSetMode()
  const accepting = useAcceptProposal()
  const discarding = useDiscardProposal()
  const undoing = useUndo()
  if (data === undefined) return <Skeleton className={className} />
  // The Mode switched to shows while the switch is on its way, then the poll says it.
  const shownMode = switching.isPending ? switching.variables : mode
  const now = new Date()
  // The pages come today first; the timeline reads oldest first.
  const days = data.pages.map(({ day, entries, titles }) =>
    dayOf({ date: day.date, entries, titles }, now),
  )
  return (
    <Conversation
      days={days.toReversed()}
      onSend={(text) => onSend?.(text)}
      tiles={tiles}
      onCenter={onCenter}
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
