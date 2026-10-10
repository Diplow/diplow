// The Conversation as the timeline shows it: Assistant's Entries (`domains/assistant/entities`), a
// day of the reader's calendar at a time, with the Titles of the Tiles its navigations went to. Home
// reads it a day at a time (`useConversation`); /dev/system splits its fixtures by day. Pure; the
// components render it.
import type { Entry } from '#/domains/assistant/entities'

/** The Titles of the Tiles a day's navigations went to, by id: a Tile deleted since has none. */
export type Titles = Readonly<Record<string, string>>

/** One day of the Conversation, its Entries oldest first. */
export interface Day {
  /** The day's date in the reader's calendar, `2026-09-27`: unique in the timeline. */
  key: string
  /** The day's local midnight. */
  date: Date
  /** Set when the day is today or yesterday, which read better than a date. */
  relative?: 'today' | 'yesterday'
  entries: readonly Entry[]
  titles: Titles
}

/** A day of the reader's calendar, `2026-09-27`, holding these Entries, as the timeline shows it. */
export function dayOf(
  { date, entries, titles }: { date: string; entries: readonly Entry[]; titles: Titles },
  now: Date,
): Day {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const midnight = new Date(year, month - 1, day)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const relative =
    date === dayKey(now) ? 'today' : date === dayKey(yesterday) ? 'yesterday' : undefined
  return { key: date, date: midnight, ...(relative && { relative }), entries, titles }
}

/** Entries split by the reader's local day, oldest day and oldest Entry first, all sharing `titles`. */
export function splitByDay(entries: readonly Entry[], now: Date, titles: Titles = {}): Day[] {
  const days: Array<{ date: string; entries: Entry[] }> = []
  for (const entry of entries.toSorted((a, b) => a.at.getTime() - b.at.getTime())) {
    const date = dayKey(entry.at)
    const last = days.at(-1)
    if (last?.date === date) last.entries.push(entry)
    else days.push({ date, entries: [entry] })
  }
  return days.map((day) => dayOf({ ...day, titles }, now))
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Splits a text into what a reader sees as characters, as Mapping counts a Tile's. */
const graphemes = new Intl.Segmenter()

/**
 * The start of a text too long to show whole, cut at a word and ended with an ellipsis, or
 * `undefined` when it fits within `limit` characters and there is nothing to hide. Characters are
 * graphemes, so an emoji, even one joined from several (👩‍👩‍👧), is never cut in half.
 */
export function excerpt(text: string, limit: number): string | undefined {
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment)
  if (characters.length <= limit) return undefined
  const cut = characters.slice(0, limit)
  const lastSpace = cut.findLastIndex((character) => /\s/.test(character))
  // A word longer than half the limit is cut through rather than dropped whole.
  const words = lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut
  return `${words.join('').replace(/[\s,;:.]+$/, '')}…`
}
