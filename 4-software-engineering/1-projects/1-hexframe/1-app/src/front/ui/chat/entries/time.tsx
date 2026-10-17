// An entry's time, in the reader's language and time zone, at the end of its line: faint, in mono. The
// server knows neither the reader's zone nor their clock, so it leaves the time out and the browser
// writes it once hydrated: a page rendered on the server never disagrees with the one in the browser.
// Where the chat is cut along its curve, each time runs on past its line's end to the curve at its own
// height, the chat's gap short of it, so the times stack up along the curve rather than in a column.
import { useHydrated } from '@tanstack/react-router'
import { useRef } from 'react'

import { getLocale } from '#/paraglide/runtime'

import { useToCurve } from '../../layouts/screen/state/useAlongCurve'

/** An entry's time, the last of its line, which its caller places (`relative`) so it finds the line. */
export function Time({ at }: { at: Date }) {
  const hydrated = useHydrated()
  const time = useRef<HTMLTimeElement>(null)
  useToCurve(time)
  return (
    <time
      ref={time}
      dateTime={at.toISOString()}
      className="ml-auto shrink-0 translate-x-[var(--to-curve,0px)] font-mono text-[0.65625rem] whitespace-nowrap text-faint"
    >
      {hydrated && new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)}
    </time>
  )
}
