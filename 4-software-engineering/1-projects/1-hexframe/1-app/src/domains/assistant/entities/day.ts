// A day of the Conversation, as its reader lives it: a date of their calendar, and how far their clock
// stands from UTC that day. The Conversation is one continuous timeline, split by day only when it is
// read: a day spans from its reader's midnight to the next. Pure.
import { Schema } from 'effect'

/** A date as `2026-10-10` reads it: a real day of the calendar, `2026-02-30` refused. */
const LocalDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.makeFilter((date: string) => dateAt(new Date(`${date}T00:00:00Z`), 0) === date),
)

/** How many minutes a clock stands ahead of UTC, from UTC−14 to UTC+14, the widest time zones. */
const Offset = Schema.Int.check(Schema.isBetween({ minimum: -14 * 60, maximum: 14 * 60 }))

/**
 * A day, as its reader asks for it: its date in their calendar, and their clock's offset from UTC that
 * day, in minutes ahead of it (UTC+2 is 120).
 */
export const Day = Schema.Struct({ date: LocalDate, offset: Offset })

export type Day = typeof Day.Type

const minute = 60_000

/** The date a clock `offset` minutes ahead of UTC shows at an instant. */
function dateAt(at: Date, offset: number): string {
  const shown = new Date(at.getTime() + offset * minute)
  return Number.isNaN(shown.getTime()) ? '' : shown.toISOString().slice(0, 10)
}

/** The day a clock `offset` minutes ahead of UTC shows at an instant. */
export const dayAt = (at: Date, offset: number): Day => ({ date: dateAt(at, offset), offset })

/** The instants a day spans: from its reader's midnight, included, to the next, excluded. */
export function spanOf({ date, offset }: Day): { readonly from: Date; readonly to: Date } {
  const midnight = Date.parse(`${date}T00:00:00Z`) - offset * minute
  return { from: new Date(midnight), to: new Date(midnight + 24 * 60 * minute) }
}
