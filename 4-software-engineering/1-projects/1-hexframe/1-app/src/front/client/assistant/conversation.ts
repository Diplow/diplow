// The Account's Conversation on the client, over Assistant's server functions
// (src/api/assistant/assistant.ts): a day of it, read in the reader's calendar, one query per day; a
// Message posted; and a merged navigation recorded. The two writes wait their turn in the
// Conversation's queue, so a navigation sent before a Message reaches the server before it, and each
// reads the Conversation again once it settles, failed or not. Failures go to their channels
// (../channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  conversationDay,
  type MergedNavigation,
  postMessage,
  recordNavigation,
} from '#/api/assistant/assistant'

import { read, write } from '../calls'

/** The Conversation's read, by the server function's name: every mode of its query key starts with it. */
const dayScope = 'conversationDay'

/** The queue the Conversation's writes wait their turn in, so they reach the server in order. */
const conversationQueue = 'conversation'

/** How many minutes the reader's clock stands ahead of UTC at an instant. */
const offsetAt = (at: Date) => -at.getTimezoneOffset()

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
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${String(year)}-${pad(month)}-${pad(day)}`,
    offset: offsetAt(midnight),
    nextOffset: offsetAt(new Date(year, month - 1, day + 1)),
  }
}

/**
 * A day of the Account's Conversation, `2026-10-10` of the reader's calendar, today when no date is
 * given: the day, its Entries oldest first, and the Titles of the Tiles its navigations went to, by
 * id. Shown inside a ReadBoundary; signed out, it sends the user to sign in.
 */
export const useConversationDay = (date?: string) =>
  useQuery(
    read({
      scope: dayScope,
      key: [date ?? 'today'],
      call: () => conversationDay({ data: dayOn(date) }),
    }),
  )

/** Reads the Conversation again, every day of it the page holds. */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: [dayScope] })

/**
 * Posts the user's Message, trimmed and never empty, then reads the Conversation again. A feature posts
 * through the navigation sender (`features/conversation/state/`), so the navigation it follows is
 * sent before it.
 */
export const usePostMessage = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('postMessage', (text: string) => postMessage({ data: { text } }), {
      queue: conversationQueue,
    }),
    onSettled: () => readAgain(client),
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
