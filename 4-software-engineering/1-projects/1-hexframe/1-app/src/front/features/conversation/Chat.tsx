// The chat on home, in the screen's two slots. `ChatTimeline`, the Account's own Conversation, read a
// day at a time, today first and each earlier day holding an Entry as the reader asks for it, a Tile
// named handing its Tile to the route to center, an open Proposal accepted or discarded where it
// stands, and what was applied undone; after it, the user's Messages still on their way, or refused
// with a retry, and the agent's step while a Turn runs, as the route's poll last saw it. `ChatComposer`,
// the composer, whose Message the route posts after the navigation it follows, saying so when the
// Account may not use the Assistant; its commands switch the Mode, undo what the agent last applied, or
// go to another language. While a Turn runs, the field waits and send becomes Stop. It offers the
// Account's Tiles to `@`, from the System the page holds. The Mode, as the poll last saw it, shows under
// the field, switched through `useSetMode`, the one switched to shown while the switch is on its way.
// Each is shown inside a ReadBoundary, which a failed read lands in.
import { type ComponentProps, useMemo } from 'react'

import type { Mode } from '#/domains/assistant/entities'
import {
  type Sent,
  useAcceptProposal,
  useAssistantAvailable,
  useConversation,
  useDiscardProposal,
  useMessagesOnTheirWay,
  useSetMode,
  useStopTurn,
  useUndo,
  useUndoing,
} from '#/front/client/assistant/conversation'
import type { LiveTurn } from '#/front/client/assistant/follow'
import { useSystem } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/atoms/skeleton'

import { mentionablesOf } from './composer/mention'
import { ConversationFoot, Timeline } from './Conversation'
import { dayOf, latestUndoable } from './timeline/timeline'

/** The Account's Tiles the chat names and offers to `@`, from the System the page holds. */
function useTiles() {
  // Read without throwing: a failed read shows on the canvas, and the chat stays up.
  const { data } = useSystem({ throwing: false })
  const root = data?.root
  return useMemo(
    () => (root === undefined ? undefined : mentionablesOf(root, m.system_untitled())),
    [root],
  )
}

/** The Entries of the days read so far, oldest first; none before today is read. */
function useEntries() {
  const { data } = useConversation()
  // The pages come today first, each day oldest first.
  return data?.pages.toReversed().flatMap(({ entries }) => entries)
}

interface ChatTimelineProps {
  /** Centers the canvas on a Tile named. */
  onCenter: (tile: string) => void
  /** What a Tile named says in its card, and its card open or shut, which the canvas lights. */
  pointing: ComponentProps<typeof Timeline>['pointing']
  /** The Turn running, as the page's poll last saw it. */
  turn: LiveTurn | undefined
  /** Posts a refused Message again, after the navigation it follows. */
  resend: (sent: Sent) => void
}

export function ChatTimeline({ onCenter, pointing, turn, resend }: ChatTimelineProps) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  const accepting = useAcceptProposal()
  const discarding = useDiscardProposal()
  const undoing = useUndo()
  // An Undo asked for by `/undo` too.
  const undoPending = useUndoing()
  const tiles = useTiles()
  const system = useMemo(
    () => (tiles === undefined ? undefined : new Map(tiles.map(({ id, title }) => [id, title]))),
    [tiles],
  )
  const { messages, forget } = useMessagesOnTheirWay()
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
      pointing={pointing}
      system={system}
      sending={messages.map(({ id, sent, refused }) => ({
        id,
        text: sent.text,
        refused,
        retry: () => {
          forget(id)
          resend(sent)
        },
      }))}
      turn={turn}
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
        pending: accepting.isPending || discarding.isPending || undoPending,
      }}
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
  /** The `@` list's row the user is on, a Tile's by its id, or none: the canvas lights it. */
  onPoint: (row: string | undefined) => void
}

export function ChatComposer({ onSend, turn, mode, onPoint }: ChatComposerProps) {
  const tiles = useTiles()
  const entries = useEntries()
  const { data: available } = useAssistantAvailable()
  const { mutate: stop, isPending: stopping } = useStopTurn()
  const switching = useSetMode()
  const { mutate: undo } = useUndo()
  // An Undo asked for from a receipt too: `/undo` waits for it.
  const undoing = useUndoing()
  const { messages } = useMessagesOnTheirWay()
  // The Mode switched to shows while the switch is on its way, then the poll says it.
  const shownMode = switching.isPending ? switching.variables : mode
  const undoable = entries === undefined ? undefined : latestUndoable(entries)
  return (
    <ConversationFoot
      onSend={(text) => onSend?.(text)}
      onUndo={
        undoable === undefined || undoing
          ? undefined
          : () => {
              undo(undoable)
            }
      }
      tiles={tiles ?? []}
      // Until it is read, or when reading it failed, the composer says nothing either way.
      unavailable={available === false}
      running={
        turn === undefined
          ? undefined
          : {
              stop: () => {
                stop()
              },
              stopping,
            }
      }
      onPoint={onPoint}
      sending={messages.some(({ refused }) => !refused)}
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
