// The Conversation as the timeline shows it: Assistant's Entries (`domains/assistant/entities`), a
// day of the reader's calendar at a time, with the Titles of the Tiles its navigations went to, and how
// the requests to join it names stand, for an admin. Home
// reads it a day at a time (`useConversation`); /design-system splits its fixtures by day. What a
// receipt at the conversation's foot tells, the timeline leaves to it. And what the agent applied
// that `/undo` undoes, the latest that offers its Undo. Pure; the components render it.
import { dayAt, type Entry, type Navigation, offersUndo } from '#/domains/assistant/entities'
import type { JoinState } from '#/domains/iam/entities'

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
  /**
   * How the requests to join its Entries name stand now, by their ids, those of an Organization the
   * reader is an admin of alone (HEX-138); none where the page reads none.
   */
  requests?: Readonly<Record<string, JoinState>> | undefined
}

/** A day of the reader's calendar, `2026-09-27`, holding these Entries, as the timeline shows it. */
export function dayOf(
  {
    date,
    entries,
    titles,
    requests,
  }: Pick<Day, 'entries' | 'titles' | 'requests'> & { readonly date: string },
  now: Date,
): Day {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const midnight = new Date(year, month - 1, day)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const relative =
    date === dayKey(now) ? 'today' : date === dayKey(yesterday) ? 'yesterday' : undefined
  return {
    key: date,
    date: midnight,
    ...(relative && { relative }),
    entries,
    titles,
    ...(requests !== undefined && { requests }),
  }
}

/**
 * Entries split by the reader's local day, oldest day and oldest Entry first, all sharing `titles`
 * and `requests`.
 */
export function splitByDay(
  entries: readonly Entry[],
  now: Date,
  titles: Titles,
  requests?: Day['requests'],
): Day[] {
  const days: Array<{ date: string; entries: Entry[] }> = []
  for (const entry of entries.toSorted((a, b) => a.at.getTime() - b.at.getTime())) {
    const date = dayKey(entry.at)
    const last = days.at(-1)
    if (last?.date === date) last.entries.push(entry)
    else days.push({ date, entries: [entry] })
  }
  return days.map((day) => dayOf({ ...day, titles, requests }, now))
}

/** The date of the reader's calendar an instant falls on, `2026-09-27`, by Assistant's day split. */
const dayKey = (at: Date) => dayAt(at, -at.getTimezoneOffset()).date

/**
 * What a receipt at the conversation's foot tells, a form's write the user sent: its change, by its
 * Tile and its verb as Mapping names the event, and when it came, which tells one receipt from the
 * next.
 */
export interface Receipted {
  readonly tile: string
  readonly verb: string
  readonly at: Date
}

/**
 * Today's Entries beside a receipt at the conversation's foot: the change it tells, the user's of its
 * Tile by its verb, recorded since it came, is left to it, the two saying the same thing, and told
 * once it goes; what was read before it came stays, an earlier change of that Tile included.
 */
export function besideReceipt(
  today: ReadonlyArray<Entry>,
  receipt: Receipted | undefined,
  before: ReadonlySet<string>,
): ReadonlyArray<Entry> {
  if (receipt === undefined) return today
  return today.filter(
    (entry) =>
      before.has(entry.id) ||
      entry._tag !== 'Change' ||
      entry.actor._tag !== 'You' ||
      entry.tile.id !== receipt.tile ||
      entry.verb !== receipt.verb,
  )
}

/**
 * What `/undo` undoes, the agent's last change: of the Entries, oldest first, the latest accepted
 * Proposal or applied Turn that offers its Undo, by the id the Undo takes; none when nothing may be
 * undone. Someone else's change is undone from its own Entry, never by `/undo`.
 */
export function latestUndoable(entries: ReadonlyArray<Entry>): string | undefined {
  const latest = entries.findLast(
    (entry) => (entry._tag === 'Proposal' || entry._tag === 'TurnApplied') && offersUndo(entry),
  )
  if (latest?._tag === 'Proposal') return latest.proposal
  if (latest?._tag === 'TurnApplied') return latest.turn
  return undefined
}

/** Where the user went that the Conversation does not hold yet, and when they last went, in ms. */
export interface Went {
  readonly navigation: Navigation
  readonly at: number
}

/** A write on its way, by its order: its `mutationId` in the MutationCache, which numbers each write. */
interface Sequenced {
  readonly id: number
}

/** What comes after the last Entry: a Message on its way, or where the user went. */
export type Later<M, N> =
  | { readonly kind: 'message'; readonly key: string; readonly message: M }
  | { readonly kind: 'went'; readonly key: string; readonly went: N }

/**
 * What comes after the last Entry, in the order it was sent: the Messages and the navigations on their
 * way, by their writes' order, then the navigation under way, which comes last, since a Message sends
 * it first.
 */
export function laterOf<M extends Sequenced, N extends Sequenced, U>(
  messages: ReadonlyArray<M>,
  navigations: ReadonlyArray<N>,
  underWay: U | undefined,
): ReadonlyArray<Later<M, N | U>> {
  const sent: { order: number; later: Later<M, N | U> }[] = [
    ...messages.map((message) => ({
      order: message.id,
      later: { kind: 'message' as const, key: `message-${String(message.id)}`, message },
    })),
    ...navigations.map((went) => ({
      order: went.id,
      later: { kind: 'went' as const, key: `went-${String(went.id)}`, went },
    })),
  ]
  const ordered = sent.sort((a, b) => a.order - b.order).map(({ later }) => later)
  if (underWay === undefined) return ordered
  return [...ordered, { kind: 'went', key: 'under-way', went: underWay }]
}
