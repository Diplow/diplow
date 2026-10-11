// The Account's Conversation on the client, over Assistant's server functions
// (src/api/assistant/assistant.ts): read a day at a time in the reader's calendar, today first, then
// each earlier day holding an Entry as the reader scrolls back, one query; a Message posted, from the
// view it was sent from, which starts a Turn; the Turn running stopped; a merged navigation recorded;
// whether the Account may use the Assistant; and its Mode switched, its Proposal accepted or
// discarded. The writes wait their turn in the Conversation's queue, so a navigation sent before a
// Message reaches the server before it, and each reads the Conversation again once it settles, failed
// or not; a Message, a Stop, a switch and a decided Proposal poll the latest too, so the page follows
// the Turn they started or ended, the Mode now, and the System an accepted Proposal changed. Failures go to their channels (../channels.ts): a
// hook's caller handles none.
import {
  infiniteQueryOptions,
  type Mutation,
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  acceptProposal,
  assistantAvailable,
  conversationDay,
  discardProposal,
  latest,
  type MergedNavigation,
  postMessage,
  recordNavigation,
  type SentMessage,
  setMode,
  stopTurn,
  undo,
} from '#/api/assistant/assistant'
import { dayAt, type Mode } from '#/domains/assistant/entities'

import { read, settle, write } from '../calls'

/** The Conversation's read, by the server function's name: every mode of its query key starts with it. */
const dayScope = 'conversationDay'

/** The queue the Conversation's writes wait their turn in, so they reach the server in order. */
const conversationQueue = 'conversation'

/** How many minutes the reader's clock stands ahead of UTC at an instant. */
const offsetAt = (at: Date) => -at.getTimezoneOffset()

/** The date of the reader's calendar an instant falls on, `2026-10-10`, by Assistant's day split. */
const dateOf = (at: Date) => dayAt(at, offsetAt(at)).date

/**
 * A date of the reader's calendar, `2026-10-10`, today's when none is given, with their clock's
 * offsets from UTC at its midnight and at the next: what the server splits the Conversation's days
 * by, a day their clock changes spanning 23 or 25 hours. Today is the reader's own date, never one
 * the server works out from an offset, which the hour a clock goes back would get wrong.
 */
function dayOn(date?: string) {
  const now = new Date()
  const [year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate()] =
    date?.split('-').map(Number) ?? []
  const midnight = new Date(year, month - 1, day)
  return {
    date: dateOf(midnight),
    offset: offsetAt(midnight),
    nextOffset: offsetAt(new Date(year, month - 1, day + 1)),
  }
}

/** A day of the Account's Conversation, `2026-10-10` of the reader's calendar, today when none. */
const askDay = (date: string | undefined) =>
  settle(dayScope, conversationDay({ data: dayOn(date) }))

/**
 * The Account's Conversation, a day at a time: today first, then, page after page, the latest
 * earlier day of the reader's calendar holding an Entry, the empty days between skipped. A read a
 * page shows, keyed `[conversationDay, 'read']`, which every write and the page's poll read again.
 */
export const conversationRead = infiniteQueryOptions({
  queryKey: [dayScope, 'read'],
  queryFn: ({ pageParam }) => askDay(pageParam),
  initialPageParam: undefined as string | undefined,
  // The instant of the latest Entry before a day falls on the reader's date that holds it.
  getNextPageParam: ({ earlier }) => (earlier === undefined ? undefined : dateOf(earlier)),
  meta: { call: 'read' },
  // Never read again on focus, every day the page holds with it: the page polls its last Entry then,
  // and reads it again only once it is another (`./follow.ts`).
  refetchOnWindowFocus: false,
})

/**
 * The Account's Conversation, today first, each page a day: the day, its Entries oldest first, the
 * Titles of the Tiles its navigations went to, by id, and, on every page, the Entry last recorded.
 * `fetchNextPage` reads the day before the oldest one shown that holds an Entry, `hasNextPage` saying
 * whether there is one. Shown inside a ReadBoundary; signed out, it sends the user to sign in.
 */
export const useConversation = () => useInfiniteQuery(conversationRead)

/**
 * Whether the Account may use the Assistant, its Entitlement, which the composer tells the user of when
 * it is missing. A read that frames the chat: its failure is reported and leaves the Conversation up.
 */
export const useAssistantAvailable = () =>
  useQuery(
    read({
      scope: 'assistantAvailable',
      key: [],
      call: () => assistantAvailable({ data: undefined }),
      frame: true,
    }),
  )

/** The System's Version, the Conversation's last Entry and the Turn running, asked of their server function. */
export const askLatest = () => latest({ data: undefined })

/** The poll's read, by the server function's name. */
export const latestScope = 'latest'

/** The poll, read alone, which `./follow.ts` follows: a frame read, whose failure shows nothing. */
export const latestRead = read({ scope: latestScope, key: [], call: askLatest, frame: true })

/** Reads the Conversation again, every day of it the page holds. */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: [dayScope] })

/** Reads the Conversation again and polls the latest, so the page follows the Turn now. */
const followAgain = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([readAgain(client), client.refetchQueries({ queryKey: latestRead.queryKey })])

/** How many minutes the reader's clock stands ahead of UTC now: what today is to them. */
const offsetNow = () => offsetAt(new Date())

/** The write that posts a Message, by its server function's name. */
const postScope = 'postMessage'

/** A Message the user sends: its text, and the view it was sent from, its center and the Tiles on screen. */
export type Sent = Omit<typeof SentMessage.Type, 'offset'>

/**
 * Posts the user's Message, trimmed and never empty, from the view it was sent from, its center and
 * the Tiles on screen, which starts a Turn answering it when the Account may use the Assistant; then
 * reads the Conversation again and polls the latest, and stays on its way until that read has landed.
 * A feature posts through the navigation sender (`features/conversation/state/`), so the navigation it
 * follows is sent before it.
 */
export const usePostMessage = () => {
  const client = useQueryClient()
  return useMutation({
    ...write(postScope, (sent: Sent) => postMessage({ data: { ...sent, offset: offsetNow() } }), {
      queue: conversationQueue,
    }),
    onSettled: () => followAgain(client),
  })
}

/** A Message the user posted that the Conversation does not hold: on its way, or refused. */
interface OnItsWay {
  /** Its write's turn, which `forget` takes. */
  readonly id: number
  readonly sent: Sent
  readonly refused: boolean
}

/**
 * Each Message on its way read once per state of its write, so `useMutationState` finds the same
 * values while nothing changed, and the timeline does not draw again at each notification.
 */
const onItsWayByState = new WeakMap<Mutation['state'], OnItsWay>()

function onItsWayOf(mutation: Mutation): OnItsWay {
  const known = onItsWayByState.get(mutation.state)
  if (known !== undefined) return known
  const onItsWay = {
    id: mutation.mutationId,
    // The variables `usePostMessage` was called with: its write's key says so.
    sent: mutation.state.variables as Sent,
    refused: mutation.state.status === 'error',
  }
  onItsWayByState.set(mutation.state, onItsWay)
  return onItsWay
}

/**
 * The Messages the user posted that the Conversation does not hold, oldest first: each on its way
 * until the Conversation read after it has landed, or refused, its failure gone to its channel, until
 * `forget` drops it, which a retry does before posting it again, or the page forgets the write.
 */
export function useMessagesOnTheirWay() {
  const client = useQueryClient()
  const messages = useMutationState({
    filters: {
      mutationKey: [postScope],
      predicate: ({ state }) => state.status === 'pending' || state.status === 'error',
    },
    select: onItsWayOf,
  })
  const forget = (id: number) => {
    const cache = client.getMutationCache()
    const write = cache.getAll().find((mutation) => mutation.mutationId === id)
    if (write !== undefined) cache.remove(write)
  }
  return { messages, forget }
}

/**
 * Stops the Turn running, which ends it, an Entry saying so, then reads the Conversation again and
 * polls the latest.
 */
export const useStopTurn = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('stopTurn', () => stopTurn({ data: undefined }), { queue: conversationQueue }),
    onSettled: () => followAgain(client),
  })
}

/** Records where the user went, merged by the browser, then reads the Conversation again. */
export const useRecordNavigation = () => {
  const client = useQueryClient()
  return useMutation({
    ...write(
      'recordNavigation',
      (data: typeof MergedNavigation.Type) => recordNavigation({ data }),
      {
        queue: conversationQueue,
      },
    ),
    onSettled: () => readAgain(client),
  })
}

/** Switches the Conversation's Mode, then polls the latest, which says the Mode now. */
export const useSetMode = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('setMode', (mode: Mode) => setMode({ data: { mode } }), {
      queue: conversationQueue,
    }),
    onSettled: () => client.refetchQueries({ queryKey: latestRead.queryKey }),
  })
}

/**
 * Accepts the open Proposal of this id, whole, then reads the Conversation again and polls the
 * latest, so the System it changed is read again too.
 */
export const useAcceptProposal = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('acceptProposal', (proposal: string) => acceptProposal({ data: { proposal } }), {
      queue: conversationQueue,
    }),
    onSettled: () => followAgain(client),
  })
}

/** Discards the open Proposal of this id, then reads the Conversation again and polls the latest. */
export const useDiscardProposal = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('discardProposal', (proposal: string) => discardProposal({ data: { proposal } }), {
      queue: conversationQueue,
    }),
    onSettled: () => followAgain(client),
  })
}

/**
 * Undoes what a Turn applied, or an accepted Proposal, by its id, then reads the Conversation again
 * and polls the latest, so the System it put back is read again too.
 */
export const useUndo = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('undo', (applied: string) => undo({ data: { applied } }), {
      queue: conversationQueue,
    }),
    onSettled: () => followAgain(client),
  })
}
