// The Conversation as the timeline shows it: Assistant's Entries (`domains/assistant/entities`), a
// day of the reader's calendar at a time, with the Titles of the Tiles its navigations went to. Home
// reads it a day at a time (`useConversation`); /design-system splits its fixtures by day. And what
// the agent applied that `/undo` undoes, the latest that offers its Undo. Pure; the components render
// it.
import { dayAt, type Entry, offersUndo } from '#/domains/assistant/entities'

/**
 * The Titles of the Tiles a day names by their id alone, those its navigations went to and its
 * Messages link, by id, as the System holds them now: a Tile deleted since has none.
 */
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
export function splitByDay(entries: readonly Entry[], now: Date, titles: Titles): Day[] {
  const days: Array<{ date: string; entries: Entry[] }> = []
  for (const entry of entries.toSorted((a, b) => a.at.getTime() - b.at.getTime())) {
    const date = dayKey(entry.at)
    const last = days.at(-1)
    if (last?.date === date) last.entries.push(entry)
    else days.push({ date, entries: [entry] })
  }
  return days.map((day) => dayOf({ ...day, titles }, now))
}

/** The date of the reader's calendar an instant falls on, `2026-09-27`, by Assistant's day split. */
const dayKey = (at: Date) => dayAt(at, -at.getTimezoneOffset()).date

/**
 * What `/undo` undoes: of the Entries, oldest first, the latest that offers its Undo, an accepted
 * Proposal or an applied Turn, by the id the Undo takes; none when nothing may be undone.
 */
export function latestUndoable(entries: ReadonlyArray<Entry>): string | undefined {
  const latest = entries.findLast(offersUndo)
  if (latest?._tag === 'Proposal') return latest.proposal
  if (latest?._tag === 'TurnApplied') return latest.turn
  return undefined
}

/** A write on its way, by its turn: its `mutationId` in the MutationCache, which numbers every write. */
interface Turned {
  readonly id: number
}

/** What comes after the last Entry: a Message on its way, or where the user went. */
export type Later<M, N> =
  | { readonly kind: 'message'; readonly key: string; readonly message: M }
  | { readonly kind: 'went'; readonly key: string; readonly went: N }

/**
 * What comes after the last Entry, in the order it was sent: the Messages and the navigations on their
 * way, by their writes' turns, then the navigation under way, which comes last, since a Message sends
 * it first.
 */
export function laterOf<M extends Turned, N extends Turned, U>(
  messages: ReadonlyArray<M>,
  navigations: ReadonlyArray<N>,
  underWay: U | undefined,
): ReadonlyArray<Later<M, N | U>> {
  const sent: { turn: number; later: Later<M, N | U> }[] = [
    ...messages.map((message) => ({
      turn: message.id,
      later: { kind: 'message' as const, key: `message-${String(message.id)}`, message },
    })),
    ...navigations.map((went) => ({
      turn: went.id,
      later: { kind: 'went' as const, key: `went-${String(went.id)}`, went },
    })),
  ]
  const ordered = sent.sort((a, b) => a.turn - b.turn).map(({ later }) => later)
  if (underWay === undefined) return ordered
  return [...ordered, { kind: 'went', key: 'under-way', went: underWay }]
}
