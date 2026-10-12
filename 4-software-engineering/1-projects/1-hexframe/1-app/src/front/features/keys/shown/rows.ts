// A Key as the key widget's row shows it: its name, how its secret starts, the day it was made and
// when it was last used, in the reader's language, and a light while it was used within the hour.
// Pure: the clock and the language are its caller's.
import { m } from '#/paraglide/messages'
import type { KeyRow } from '#/front/ui/chat/widgets/keys/KeyWidget'

import type { AccountKey } from '#/front/client/iam/keys'

const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

/** The day a date falls on, its year only when it is not this one's. */
function dayOf(date: Date, now: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(date)
}

/** How long ago a date was, as a reader says it: minutes, hours, days, then the day itself. */
function agoOf(date: Date, now: Date, locale: string) {
  const since = now.getTime() - date.getTime()
  const relative = new Intl.RelativeTimeFormat(locale, { style: 'short' })
  if (since < hour) return relative.format(-Math.max(1, Math.floor(since / minute)), 'minute')
  if (since < day) return relative.format(-Math.floor(since / hour), 'hour')
  if (since < 30 * day) return relative.format(-Math.floor(since / day), 'day')
  return dayOf(date, now, locale)
}

/** One of the Account's Keys as its row shows it, at `now`, in `locale`. */
export function rowOf(key: AccountKey, now: Date, locale: string): KeyRow {
  const { lastUsedAt } = key
  return {
    id: key.id,
    name: key.name,
    start: key.start,
    made: dayOf(key.createdAt, now, locale),
    used:
      lastUsedAt === null
        ? m.widget_key_never_used()
        : m.widget_key_used({ when: agoOf(lastUsedAt, now, locale) }),
    live: lastUsedAt !== null && now.getTime() - lastUsedAt.getTime() < hour,
  }
}
