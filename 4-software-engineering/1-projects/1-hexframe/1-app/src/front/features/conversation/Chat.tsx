// The chat on home, in the screen's two slots. `ChatTimeline`, the Account's own Conversation, read a
// day at a time, today first and each earlier day holding an Entry as the reader asks for it, a Tile
// named handing its Tile to the route to center, an open Proposal accepted or discarded where it
// stands, and what was applied undone; after it, the user's Messages still on their way, or refused
// with a retry, where they went that it doesn't hold yet, each gesture joining the navigation under
// way, and the agent's step while a Turn runs, as the route's poll last saw it. `ChatComposer`,
// the composer, whose Message the route posts after the navigation it follows, saying so when the
// Account may not use the Assistant, and where the next Turn works, the canvas's center unless the
// Message opens with a link, naming a Tile carried from the canvas or one a menu asks the agent
// about; its commands switch the Mode, undo what the agent last applied, open Help or the Keys, or go
// to another language. While a Turn runs, the field waits and send becomes Stop. It offers the
// Account's Tiles to `@`, from the System the page holds. The Mode, as the poll last saw it, shows
// under the field, switched through `useSetMode`, the one switched to shown while the switch is on
// its way. Each is shown inside a ReadBoundary, which a failed read lands in.
import { type ComponentProps, useMemo } from 'react'

import type { Mode } from '#/domains/assistant/entities'
import {
  type Sent,
  useAcceptProposal,
  useAssistantAvailable,
  useConversation,
  useDiscardProposal,
  useMessagesOnTheirWay,
  useNavigationsOnTheirWay,
  useSetMode,
  useStopTurn,
  useUndo,
  useUndoing,
} from '#/front/client/assistant/conversation'
import type { LiveTurn } from '#/front/client/assistant/follow'
import { useSignOut } from '#/front/client/iam/access'
import { useSystem } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import type { CarriedTile } from '#/front/ui/canvas/state/move/carry'

import { mentionablesOf } from './composer/mention'
import { ConversationFoot, Timeline } from './Conversation'
import { dayOf, latestUndoable, type Went } from './timeline/timeline'

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
  /** Where the user went since the last navigation sent, merged, and when they last went. */
  underWay: Went | undefined
}

export function ChatTimeline({ onCenter, pointing, turn, resend, underWay }: ChatTimelineProps) {
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
  const recording = useNavigationsOnTheirWay()
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
      going={recording}
      underWay={underWay}
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
  /** The Tile centered on the canvas, where the next Turn works unless the Message names another. */
  center: string | undefined
  /** A Tile carried off the canvas, which the composer names where it is let go. */
  carried: CarriedTile | undefined
  /** `/help`: Help opened on the topic the words after it find, if any, on the canvas and in the chat. */
  onHelp: (words: string) => void
  /** `/keys`: the Account's Keys opened in the chat. */
  onKeys: () => void
}

export function ChatComposer(props: ChatComposerProps) {
  const { onSend, turn, mode, onPoint, center, carried, onHelp, onKeys } = props
  const tiles = useTiles()
  const entries = useEntries()
  const { data: available } = useAssistantAvailable()
  const { mutate: stop, isPending: stopping } = useStopTurn()
  const switching = useSetMode()
  const { mutate: undo } = useUndo()
  const { mutate: signOut } = useSignOut()
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
      onHelp={onHelp}
      onKeys={onKeys}
      onSignOut={() => {
        signOut()
      }}
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
      center={center}
      carried={carried}
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
