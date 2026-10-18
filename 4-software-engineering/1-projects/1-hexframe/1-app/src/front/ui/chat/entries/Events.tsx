// What happens between the two voices, one line each on a thread of small hexes, coloured by who
// acted: amber for the user, violet for the agent, hollow for someone from outside, a Key or another
// Account sharing a tile, faint for hexframe itself. A navigation, a change, the agent's step under way, a Turn's end. The tool in faint mono, the
// time at the end, each line running on to the curve at its height. A run of reads folds into one
// line, open on a click; what changes something stays out.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import type { Voice } from '../../atoms/controls/act'
import { runsToCurve, toCurve } from '../../layouts/screen/state/useAlongCurve'
import { Fold } from '../atoms/fold'
import { HexMark } from '../atoms/hex'
import { Said, type Words } from '../text/words'
import { Time } from './time'

/**
 * Who acted: the user, the agent, someone from outside, a Key or another Account sharing a tile, or
 * hexframe itself, a limit or a failure.
 */
type Who = Exclude<Voice, 'destructive'> | 'key'

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
  human: { hollow: false, className: 'text-human' },
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
        'summary' in line ? <Run key={index} folded={line} /> : <Line key={index} event={line} />,
      )}
    </ul>
  )
}

function Line({ event }: { event: Happened }) {
  const { who, words, detail, tool, at, state } = event
  const mark = marks[who]
  return (
    <li
      ref={toCurve}
      className={cn(
        runsToCurve,
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
        <Said words={words} voice={who === 'human' ? 'human' : 'agent'} />
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

function Run({ folded }: { folded: Folded }) {
  return (
    <li className="relative">
      <HexMark className="absolute top-[.3em] -left-6 size-2 text-agent" />
      <Fold
        className="font-mono text-xs"
        label={
          <>
            <span className="sr-only">{m.chat_event_by_agent()} </span>
            {folded.summary}
          </>
        }
      >
        <ul className={cn(thread, 'mt-2.5')}>
          {folded.events.map((event, index) => (
            <Line key={index} event={event} />
          ))}
        </ul>
      </Fold>
    </li>
  )
}
