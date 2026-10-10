// The Account's Conversation on the client, over Assistant's server functions
// (src/api/assistant/assistant.ts): read a day at a time in the reader's calendar, today first, then
// each earlier day holding an Entry as the reader scrolls back, one query; a Message posted, from the
// view it was sent from, which starts a Turn; the Turn running stopped; a merged navigation recorded;
// and whether the Account may use the Assistant. The writes wait their turn in the Conversation's
// queue, so a navigation sent before a Message reaches the server before it, and each reads the
// Conversation again once it settles, failed or not; a Message and a Stop poll the latest too, so the
// page follows the Turn they started or ended. Failures go to their channels (../channels.ts): a
// hook's caller handles none.
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  assistantAvailable,
  conversationDay,
  latest,
  type MergedNavigation,
  postMessage,
  recordNavigation,
  type SentMessage,
  stopTurn,
} from '#/api/assistant/assistant'
import { dayAt } from '#/domains/assistant/entities'

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

/** The poll, read alone, which `./follow.ts` follows: a frame read, whose failure shows nothing. */
export const latestRead = read({ scope: 'latest', key: [], call: askLatest, frame: true })

/** Reads the Conversation again, every day of it the page holds. */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: [dayScope] })

/** Reads the Conversation again and polls the latest, so the page follows the Turn now. */
const followAgain = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([readAgain(client), client.refetchQueries({ queryKey: latestRead.queryKey })])

/** How many minutes the reader's clock stands ahead of UTC now: what today is to them. */
const offsetNow = () => offsetAt(new Date())

/**
 * Posts the user's Message, trimmed and never empty, from the view it was sent from, its center and
 * the Tiles on screen, which starts a Turn answering it when the Account may use the Assistant; then
 * reads the Conversation again and polls the latest. A feature posts through the navigation sender
 * (`features/conversation/state/`), so the navigation it follows is sent before it.
 */
export const usePostMessage = () => {
  const client = useQueryClient()
  return useMutation({
    ...write(
      'postMessage',
      (sent: Omit<typeof SentMessage.Type, 'offset'>) =>
        postMessage({ data: { ...sent, offset: offsetNow() } }),
      { queue: conversationQueue },
    ),
    onSettled: () => followAgain(client),
  })
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
