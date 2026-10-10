// The Account's Conversation on the client, over Assistant's server functions
// (src/api/assistant/assistant.ts): a day of it, read in the reader's calendar, one query per day; a
// Message posted; and a merged navigation recorded. The two writes wait their turn in the
// Conversation's queue, so a navigation sent before a Message reaches the server before it, and each
// reads the Conversation again once it settles, failed or not. Failures go to their channels
// (../channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { conversationDay, postMessage, recordNavigation } from '#/api/assistant/assistant'
import type { Navigation } from '#/domains/assistant/entities'

import { read, write } from '../calls'

/** The Conversation's read, by the server function's name: every mode of its query key starts with it. */
const dayScope = 'conversationDay'

/** The queue the Conversation's writes wait their turn in, so they reach the server in order. */
const conversationQueue = 'conversation'

/**
 * How many minutes the reader's clock stands ahead of UTC at their midnight of a date, `2026-10-10`,
 * or now: what the server splits the Conversation's days by.
 */
function offsetOn(date?: string): number {
  if (date === undefined) return -new Date().getTimezoneOffset()
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return -new Date(year, month - 1, day).getTimezoneOffset()
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
      call: () =>
        conversationDay({
          data: { ...(date !== undefined && { date }), offset: offsetOn(date) },
        }),
    }),
  )

/** Reads the Conversation again, every day of it the page holds. */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: [dayScope] })

/** Posts the user's Message, trimmed and never empty, then reads the Conversation again. */
export const usePostMessage = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('postMessage', (text: string) => postMessage({ data: { text } }), {
      queue: conversationQueue,
    }),
    onSettled: () => readAgain(client),
  })
}

/** What recording a merged navigation sends: it, and how long ago its last gesture was. */
export interface NavigationSent {
  readonly navigation: Navigation
  readonly sinceLast: number
}

/** Records where the user went, merged by the browser, then reads the Conversation again. */
export const useRecordNavigation = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('recordNavigation', (data: NavigationSent) => recordNavigation({ data }), {
      queue: conversationQueue,
    }),
    onSettled: () => readAgain(client),
  })
}
