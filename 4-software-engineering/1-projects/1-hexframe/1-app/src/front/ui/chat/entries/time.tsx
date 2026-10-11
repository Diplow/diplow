// An entry's time, in the reader's language, at the end of its line: faint, in mono.
import { getLocale } from '#/paraglide/runtime'

export function Time({ at }: { at: Date }) {
  const time = new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)
  return (
    <time
      dateTime={at.toISOString()}
      className="ml-auto shrink-0 font-mono text-[0.65625rem] whitespace-nowrap text-faint"
    >
      {time}
    </time>
  )
}
