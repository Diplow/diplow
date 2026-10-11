// What happens between the two voices, one line each on a thread of small hexes, coloured by who
// acted: amber for the user, violet for the agent, hollow for a Key from outside, faint for hexframe
// itself. A navigation, a change, the agent's step under way, a Turn's end. The tool in faint mono, the
// time at the end. A run of reads folds into one line, open on a click; what changes something stays
// out.
import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'

import { m } from '#/paraglide/messages'

import { HexMark } from '../atoms/hex'
import { Said, type Words } from '../text/words'
import { Time } from './time'

/** Who acted: the user, the agent, a Key from outside, or hexframe itself, a limit or a failure. */
type Who = 'you' | 'agent' | 'key' | 'app'

/** One thing that happened, said in a sentence that names who did it, but the agent's. */
export interface Happened {
  who: Who
  words: Words
  /** What follows it, quieter: how many gestures a navigation merged. */
  detail?: string | undefined
  /** The tool the agent called, as it is named. */
  tool?: string | undefined
  at: Date
  /** Under way, the agent's live step; or failed. */
  state?: 'running' | 'failed' | undefined
}

/** A run of reads, folded into one line that says what they read. */
export interface Folded {
  summary: string
  events: readonly Happened[]
}

const marks: Record<Who, { hollow: boolean; className: string }> = {
  you: { hollow: false, className: 'text-human' },
  agent: { hollow: false, className: 'text-agent' },
  key: { hollow: true, className: 'fill-card text-faint' },
  app: { hollow: false, className: 'text-faint' },
}

const thread =
  'relative grid gap-2.5 pl-6 before:absolute before:inset-y-2 before:left-[3px] before:w-px before:bg-border'

export function Events({ lines }: { lines: ReadonlyArray<Happened | Folded> }) {
  return (
    <ul
      className={cn(
        thread,
        'font-sans text-[0.8125rem] leading-snug font-light text-muted-foreground',
      )}
    >
      {lines.map((line, index) =>
        // The lines of one thread, never reordered: their place is their key.
        'summary' in line ? <Fold key={index} folded={line} /> : <Line key={index} event={line} />,
      )}
    </ul>
  )
}

function Line({ event }: { event: Happened }) {
  const { who, words, detail, tool, at, state } = event
  const mark = marks[who]
  return (
    <li
      className={cn(
        'relative flex items-baseline gap-2.5',
        state === 'failed' && 'text-destructive',
      )}
    >
      <HexMark
        hollow={state === undefined && mark.hollow}
        className={cn(
          'absolute top-[.3em] -left-6 size-2',
          state === undefined && mark.className,
          state === 'running' && 'text-agent [animation-duration:1.4s] motion-safe:animate-breathe',
          state === 'failed' && 'text-destructive',
        )}
      />
      <span className="min-w-0 wrap-anywhere">
        {who === 'agent' && <span className="sr-only">{m.chat_event_by_agent()} </span>}
        <Said words={words} voice={who === 'you' ? 'human' : 'agent'} />
        {detail !== undefined && <span className="text-faint"> · {detail}</span>}
        {state === 'running' && <span className="sr-only"> ({m.chat_event_running()})</span>}
        {state === 'failed' && <span className="sr-only"> ({m.chat_event_failed()})</span>}
      </span>
      {tool !== undefined && (
        <span className="hidden font-mono text-[0.71875rem] text-faint sm:inline">{tool}</span>
      )}
      <Time at={at} />
    </li>
  )
}

function Fold({ folded }: { folded: Folded }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <li className="relative">
      <HexMark className="absolute top-[.3em] -left-6 size-2 text-agent" />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-2 font-mono text-xs text-muted-foreground outline-offset-2 transition-colors hover:text-foreground focus-visible:outline pointer-coarse:min-h-11"
        onClick={() => {
          setOpen(!open)
        }}
      >
        <span className="sr-only">{m.chat_event_by_agent()} </span>
        {folded.summary}
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-300 ease-glide motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </button>
      <ul id={id} hidden={!open} className={cn(thread, 'mt-2.5')}>
        {folded.events.map((event, index) => (
          <Line key={index} event={event} />
        ))}
      </ul>
    </li>
  )
}
