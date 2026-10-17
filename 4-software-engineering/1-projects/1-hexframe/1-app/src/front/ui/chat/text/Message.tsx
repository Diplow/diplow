// The two voices. The user's words in Newsreader, light and large, behind a fine amber line; the
// agent's in Geist Mono, smaller, in the second ink, behind a violet hex outline. While the user's are
// sending the line dims and the words wait in grey; failed, the line turns destructive with a retry.
// While the agent's are coming each word inks in from a slight blur, and a small violet hex breathes
// where the next will land. Both run on to the curve line by line, each line at its own height, and a
// click on one copies its words, as Enter does on one the keyboard reached: no tool waits beside them.
// Hovered, one that copies lights up, its line or its hex and its ground.
import { cn } from 'cn'
import { useId, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { toast } from '../../atoms/Toaster'
import { runsToCurve, toCurve, toCurveHolding } from '../../layouts/screen/state/useAlongCurve'
import { HexMark } from '../atoms/hex'
import type { Voice } from './Mention'
import { linesOf, plainOf, Said, type Words } from './words'

interface HumanProps {
  voice: 'human'
  words: Words
  /** Sent, the default; on its way; or refused, with its retry. */
  state?: 'sent' | 'sending' | 'failed'
  onRetry?: () => void
}

interface AgentProps {
  voice: 'agent'
  words: Words
  /** Done, the default, or still coming, word after word. */
  state?: 'done' | 'streaming'
  /** It follows another of the agent's: the mark stays on the first of a run only. */
  continued?: boolean
}

export type MessageProps = HumanProps | AgentProps

export function Message(props: MessageProps) {
  return props.voice === 'human' ? <Human {...props} /> : <Agent {...props} />
}

function Human({ words, state = 'sent', onRetry }: HumanProps) {
  return (
    <Copies words={words} className="focus-visible:outline-human/60">
      {/* `text-prose` outside `cn`, which knows no such size, takes it for a colour and drops it. */}
      <p
        className={`text-prose ${cn(
          'border-l pl-3.5 font-human font-light whitespace-pre-wrap wrap-anywhere transition-[border-color,box-shadow,color] duration-400',
          state === 'sent' &&
            'border-human/70 text-foreground group-hover/message:border-human group-hover/message:shadow-[inset_6px_0_8px_-6px_var(--color-human)]',
          state === 'sending' && 'border-human/25 text-muted-foreground',
          state === 'failed' && 'border-destructive text-foreground',
        )}`}
      >
        <span className="sr-only">{m.chat_you_said()} </span>
        <Lines words={words} voice="human" />
        {state === 'sending' && <span className="sr-only"> ({m.chat_message_sending()})</span>}
      </p>
      {state === 'failed' && (
        <p className="flex flex-wrap items-center gap-x-3.5 pt-1.5 pl-3.5 text-xs text-destructive">
          <span>{m.chat_message_failed()}</span>
          {onRetry !== undefined && (
            <Act className="text-xs" onClick={onRetry}>
              {m.ui_retry()}
            </Act>
          )}
        </p>
      )}
    </Copies>
  )
}

function Agent({ words, state = 'done', continued = false }: AgentProps) {
  const streaming = state === 'streaming'
  return (
    <Copies
      words={words}
      copies={!streaming}
      busy={streaming}
      className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2.5 font-agent text-mono text-muted-foreground focus-visible:outline-agent/60"
    >
      <HexMark
        flat
        hollow
        className={cn(
          'mt-[.3em] size-3.5 text-agent transition-[fill,filter] duration-400 group-hover/message:fill-agent/25 group-hover/message:drop-shadow-[0_0_4px_var(--color-agent)]',
          continued && 'invisible',
        )}
      />
      <p className="whitespace-pre-wrap wrap-anywhere">
        <span className="sr-only">{m.chat_agent_said()} </span>
        {streaming ? <Inking words={words} /> : <Lines words={words} voice="agent" />}
        {streaming && (
          <HexMark className="ml-1 size-2 text-agent drop-shadow-[0_0_4px_var(--color-agent)] [animation-duration:1.1s] motion-safe:animate-breathe" />
        )}
      </p>
    </Copies>
  )
}

/** The words line by line, each line running on to the curve at its own height. */
function Lines({ words, voice }: { words: Words; voice: Voice }) {
  return linesOf(words).map((line, index) => (
    // The lines of one message, never reordered: their place is their key.
    <span key={index} ref={toCurve} className={cn(runsToCurve, 'block min-h-[1lh]')}>
      <Said words={line} voice={voice} />
    </span>
  ))
}

/** Words still coming: each inks in from a slight blur as it lands, the words before it staying put. */
function Inking({ words }: { words: Words }) {
  const ink =
    'motion-safe:animate-in motion-safe:fade-in motion-safe:blur-in-[2px] animation-duration-350'
  return words.flatMap((word, index) => {
    if (typeof word !== 'string') {
      // A tile or a name lands whole. Each piece keeps its place: what has come never moves.
      return [
        <span key={index} className={ink}>
          <Said words={[word]} voice="agent" />
        </span>,
      ]
    }
    return word.split(/(\s+)/).map((part, at) => (
      <span key={`${String(index)}-${String(at)}`} className={ink}>
        {part}
      </span>
    ))
  })
}

interface CopiesProps {
  words: Words
  /** It copies them; not while they are still coming. */
  copies?: boolean
  /** Its words are still coming. */
  busy?: boolean
  className: string
  children: ReactNode
}

/**
 * A message, running on as far as its farthest line, so it holds them all, or, while its words are
 * still coming in one run, as far as all of them may; and copying its words, each tile by its title:
 * on a click, unless the click lands on a control inside it, a tile named or a retry, or ends a
 * selection the reader made to copy that instead; and on Enter once the keyboard reached it, which a
 * screen reader is told. A toast says it copied, or that it couldn't.
 */
function Copies({ words, copies = true, busy, className, children }: CopiesProps) {
  const hint = useId()
  const copy = () => {
    // Without a secure context there is no clipboard: that fails as a refused copy does.
    void Promise.resolve(plainOf(words))
      .then((text) => navigator.clipboard.writeText(text))
      .then(
        () => toast(m.chat_copied()),
        () => toast.error(m.chat_copy_failed()),
      )
  }
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = event.target instanceof Element ? event.target.closest('button, a') : null
    if (control !== null && event.currentTarget.contains(control)) return
    if (window.getSelection()?.isCollapsed === false) return
    copy()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Enter on the message itself: a tile named inside it keeps its own.
    if (event.key !== 'Enter' || event.target !== event.currentTarget) return
    event.preventDefault()
    copy()
  }
  return (
    <div
      ref={busy === true ? toCurve : toCurveHolding}
      aria-busy={busy}
      {...(copies && { tabIndex: 0, 'aria-describedby': hint, onClick, onKeyDown })}
      className={cn(
        runsToCurve,
        copies && [
          'group/message relative isolate cursor-copy focus-visible:outline-1 focus-visible:outline-offset-4',
          // Hovered, its ground lights from its mark, fading toward the curve and softly at its ends.
          'before:absolute before:-inset-y-1 before:left-0 before:-right-2.5 before:-z-10 before:bg-linear-to-r before:from-foreground/8 before:via-foreground/5 before:via-70% before:to-transparent before:opacity-0 before:transition-opacity before:duration-400 before:[mask-image:linear-gradient(to_bottom,transparent,black_6px,black_calc(100%-6px),transparent)] hover:before:opacity-100',
        ],
        className,
      )}
    >
      {children}
      {copies && (
        <span id={hint} hidden>
          {m.chat_copy_hint()}
        </span>
      )}
    </div>
  )
}
