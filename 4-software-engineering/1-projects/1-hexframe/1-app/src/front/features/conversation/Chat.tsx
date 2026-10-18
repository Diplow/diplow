// The chat on home, in the screen's two slots. `ChatTimeline`, the Account's own Conversation, read a
// day at a time, today first and each earlier day holding an Entry as the reader asks for it, a Tile
// named handing its Tile to the route to center, an open Proposal accepted or discarded where it
// stands, and what was applied undone, the change a receipt at its foot says left to it; after it,
// the user's Messages still on their way, or refused with a retry, where they went that it doesn't
// hold yet, each gesture joining the navigation under way, and the agent's step while a Turn runs,
// as the route's poll last saw it. `ChatComposer`, the composer, whose Message the route posts
// after the navigation it follows, saying so when the Account may not use the Assistant, and where
// the next Turn works, the canvas's center unless the Message opens with a link, naming a Tile
// carried from the canvas or one a menu asks the agent about; its commands switch the Mode, undo
// what the agent last applied, open Help or the Keys, show the tutorial, or go to another language.
// While a Turn runs, the field waits and send becomes Stop. It offers the Account's Tiles to `@`,
// from the System the page holds, and, on a visit, the Tiles of the System visited the Account may
// run the agent at, its *@*, a Message opening with one starting its Turn there (HEX-134). The Mode, as the poll last saw it, shows under the field,
// switched through `useSetMode`, the one switched to shown while the switch is on its way; while the
// chat invites a new account's first command (`./invitation/`), `/tutorial` comes first in its list
// (HEX-118). Each is shown inside a ReadBoundary, which a failed read lands in.
import { type ComponentProps, useMemo, useState } from 'react'

import type { Entry, Mode } from '#/domains/assistant/entities'
import { systemOf } from '#/domains/mapping/entities'
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
import { useInvited } from './invitation/Invitation'
import {
  besideReceipt,
  dayOf,
  latestUndoable,
  type Receipted,
  type Went,
} from './timeline/timeline'

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

/**
 * The Tiles of the System the page visits, someone else's, that the Account may run the agent at,
 * its *@* there as Mapping showed it: what the composer offers to `@` beside the Account's own, from
 * the star and from each Tile across a gap, so a Message opening with one starts its Turn there. None
 * at home.
 */
function useVisitedTiles(star: string | undefined) {
  const { data } = useSystem({ throwing: false, ...(star !== undefined && { star }) })
  const shown = star === undefined ? undefined : data
  return useMemo(() => {
    if (shown === undefined) return []
    const { system, root, gaps, pinned, rights } = shown
    const across = Object.values(gaps).map((gap) => systemOf({ ...system, root: gap }, pinned))
    return [root, ...across]
      .flatMap((tree) => mentionablesOf(tree, m.system_untitled()))
      .filter(({ id }) => rights[id]?.includes('@') === true)
  }, [shown])
}

/** The Entries of the days read so far, oldest first; none before today is read. */
function useEntries() {
  const { data } = useConversation()
  // The pages come today first, each day oldest first.
  return data?.pages.toReversed().flatMap(({ entries }) => entries)
}

/**
 * Today's Entries beside the receipt at the conversation's foot (`besideReceipt`): those read as it
 * came, held as it renders, stay told, so what is recorded since, its change, is left to it.
 */
function useBesideReceipt(today: ReadonlyArray<Entry> | undefined, receipt: Receipted | undefined) {
  const came = receipt?.at.getTime()
  const [read, setRead] = useState(() => ({ came, before: idsOf(today) }))
  if (read.came !== came) setRead({ came, before: idsOf(today) })
  return (entries: ReadonlyArray<Entry>) => besideReceipt(entries, receipt, read.before)
}

const idsOf = (entries: ReadonlyArray<Entry> | undefined): ReadonlySet<string> =>
  new Set(entries?.map(({ id }) => id))

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
  /**
   * What the receipt at the conversation's foot says, a form's write the user sent, which the
   * timeline leaves to it while it shows; none while no receipt is there.
   */
  receipt: Receipted | undefined
  /**
   * The Tiles of the System the page visits, someone else's, by id with their Titles, which the chat
   * names as it names the Account's own, a gesture there on its way included (HEX-127).
   */
  visitedTitles?: ReadonlyMap<string, string> | undefined
}

export function ChatTimeline(props: ChatTimelineProps) {
  const { onCenter, pointing, turn, resend, underWay, receipt, visitedTitles } = props
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  // Today's page comes first, where what the receipt says is recorded.
  const beside = useBesideReceipt(data?.pages[0]?.entries, receipt)
  const accepting = useAcceptProposal()
  const discarding = useDiscardProposal()
  const undoing = useUndo()
  // An Undo asked for by `/undo` too.
  const undoPending = useUndoing()
  const tiles = useTiles()
  const system = useMemo(
    () =>
      tiles === undefined
        ? undefined
        : new Map([
            ...(visitedTitles ?? []),
            ...tiles.map(({ id, title }) => [id, title] as const),
          ]),
    [tiles, visitedTitles],
  )
  const { messages, forget } = useMessagesOnTheirWay()
  const recording = useNavigationsOnTheirWay()
  if (data === undefined) return <Skeleton className="h-40" />
  const now = new Date()
  // The pages come today first; the timeline reads oldest first.
  const days = data.pages.map(({ day, entries, titles }, index) =>
    dayOf({ date: day.date, entries: index === 0 ? beside(entries) : entries, titles }, now),
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
  /** `/tutorial`: the tutorial on the canvas. */
  onTutorial: () => void
  /** The star of the System the page visits, someone else's; none at home. */
  visiting?: string | undefined
}

export function ChatComposer(props: ChatComposerProps) {
  const { onSend, turn, mode, onPoint, center, carried, onHelp, onKeys, onTutorial } = props
  const own = useTiles()
  const visited = useVisitedTiles(props.visiting)
  const tiles = useMemo(
    () => (own === undefined ? undefined : [...own, ...visited]),
    [own, visited],
  )
  // While the chat invites it, a `/` offers `/tutorial` first.
  const invited = useInvited()
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
      onTutorial={onTutorial}
      invited={invited ? 'tutorial' : undefined}
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
