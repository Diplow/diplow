// An entry's time, in the reader's language and time zone, at the end of its line: faint, in mono. The
// server knows neither the reader's zone nor their clock, so it leaves the time out and the browser
// writes it once hydrated: a page rendered on the server never disagrees with the one in the browser.
import { useHydrated } from '@tanstack/react-router'

import { getLocale } from '#/paraglide/runtime'

export function Time({ at }: { at: Date }) {
  const hydrated = useHydrated()
  return (
    <time
      dateTime={at.toISOString()}
      className="ml-auto shrink-0 font-mono text-[0.65625rem] whitespace-nowrap text-faint"
    >
      {hydrated && new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)}
    </time>
  )
}
