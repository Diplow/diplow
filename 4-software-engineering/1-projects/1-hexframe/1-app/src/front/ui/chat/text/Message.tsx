// The two voices. The user's words in Newsreader, light and large, behind a fine amber line; the
// agent's in Geist Mono, smaller, in the second ink, behind a violet hex outline. While the user's are
// sending the line dims and the words wait in grey; failed, the line turns destructive with a retry.
// While the agent's are coming each word inks in from a slight blur, and a small violet hex breathes
// where the next will land. Both run on to the curve line by line, each line at its own height, and a
// click on one copies its words, as Enter does on one the keyboard reached: no tool waits beside
// them, and a click on a tile or a command it names does what that does instead. Hovered, one that
// copies lights up, its line or its hex and its ground. The agent's numbered list is a list. The
// agent's invitation to a new account's first command rises fifth of its dawn (HEX-118), and its
// telling of a tile's words, a few words a beat, then the body, comes one beat after another (HEX-120);
// once the tile's six are around it, each numbered line of the body that names one lights as it
// lands, and lights it, pointed at, as it lights when the canvas points at it, the agent saying they
// are the same six, then that yours is waiting (HEX-122).
import { cn } from 'cn'
import {
  useId,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { toast } from '../../atoms/Toaster'
import { runsToCurve, toCurve, toCurveHolding } from '../../layouts/screen/state/useAlongCurve'
import { aroundUpTo, toldUpTo, type AroundPart, type ToldPart } from '../../motion'
import { Dawn } from '../atoms/dawn'
import { HexMark } from '../atoms/hex'
import type { Voice } from './Mention'
import { blocksOf, linesOf, plainOf, Said, type Words } from './words'

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
  /**
   * It comes in fifth of a new account's dawn, once the composer has risen, rising within its own
   * line (`Dawn`): the agent's invitation to a first command (HEX-118).
   */
  dawning?: boolean
  /** Its numbered lines that name something drawn elsewhere: a tile's body's, its six (HEX-122). */
  lines?: NamingLines | undefined
}

/**
 * A numbered list's lines that name something drawn elsewhere, by the number written before each:
 * the tutorial's body's, its six on the canvas (HEX-122).
 */
export interface NamingLines {
  /** Whether the line numbered so names something; one that names nothing is a line as any other. */
  names: (line: number) => boolean
  /** Whether it is lit: what it names landing, or pointed at, here or there. */
  lit: (line: number) => boolean
  /** Hovered or focused, or left: what it names is pointed at meanwhile. */
  onPoint: (line: number, pointing: boolean) => void
  /** A click, a tap or Enter: what it names pointed at and shown, a phone bringing it forward. */
  onShow: (line: number) => void
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

function Agent({ words, state = 'done', continued = false, dawning = false, lines }: AgentProps) {
  const streaming = state === 'streaming'
  const message = (
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
      <div className="whitespace-pre-wrap wrap-anywhere">
        <span className="sr-only">{m.chat_agent_said()} </span>
        {streaming ? <Inking words={words} /> : <Blocks words={words} lines={lines} />}
        {streaming && (
          <HexMark className="ml-1 size-2 text-agent drop-shadow-[0_0_4px_var(--color-agent)] [animation-duration:1.1s] motion-safe:animate-breathe" />
        )}
      </div>
    </Copies>
  )
  return dawning ? <Dawn beat="invitation">{message}</Dawn> : message
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

/**
 * The agent's words line by line, as `Lines` draws them, a numbered list as a list, each item a line
 * of its own, its number hanging before it, the list's numbers in one column as wide as its longest,
 * an item that names something elsewhere lighting it (`NamingLine`).
 */
function Blocks({ words, lines }: { words: Words; lines: NamingLines | undefined }) {
  return blocksOf(words).map((block, index) =>
    // The blocks of one message, never reordered: their place is their key.
    'line' in block ? (
      <span key={index} ref={toCurve} className={cn(runsToCurve, 'block min-h-[1lh]')}>
        <Said words={block.line} voice="agent" />
      </span>
    ) : (
      // Its marks drawn as its numbers are, so a list keeps its role where its style removes it, each
      // item counted by the number written, as a screen reader hears it and the eye reads it.
      <ol
        key={index}
        role="list"
        className="grid list-none grid-cols-[auto_minmax(0,1fr)] gap-x-[1ch]"
      >
        {block.list.map((item, at) => (
          <li
            key={at}
            value={Number(item.number)}
            ref={toCurve}
            className={cn(runsToCurve, 'col-span-2 grid grid-cols-subgrid')}
          >
            <span aria-hidden>{item.number}.</span>
            {lines?.names(Number(item.number)) === true ? (
              <NamingLine line={Number(item.number)} lines={lines}>
                <Said words={item.words} voice="agent" />
              </NamingLine>
            ) : (
              <span>
                <Said words={item.words} voice="agent" />
              </span>
            )}
          </li>
        ))}
      </ol>
    ),
  )
}

interface NamingLineProps {
  line: number
  lines: NamingLines
  children: ReactNode
}

/**
 * A numbered line that names something drawn elsewhere, its tile on the canvas (HEX-122): lit, in the
 * first ink on a ground lit from its number, as the message's own hover lights it, while what it names
 * lands or is pointed at; hovered under a mouse or a pen, or focused, it points at it, and a click, a
 * tap or Enter shows it, which a finger, hovering nothing, has for its hover. A button, so a click
 * on it never copies the message.
 */
function NamingLine({ line, lines, children }: NamingLineProps) {
  const hint = useId()
  const lit = lines.lit(line)
  const hovering = (event: PointerEvent<HTMLElement>, pointing: boolean) => {
    if (event.pointerType !== 'touch') lines.onPoint(line, pointing)
  }
  return (
    <button
      type="button"
      aria-describedby={hint}
      className={cn(
        'relative isolate cursor-pointer text-start outline-offset-2 transition-colors duration-400 focus-visible:outline',
        "before:absolute before:-inset-y-0.5 before:-left-1 before:right-0 before:-z-10 before:bg-linear-to-r before:from-foreground/12 before:to-transparent before:opacity-0 before:transition-opacity before:duration-400 before:content-['']",
        lit && 'text-foreground before:opacity-100',
      )}
      onPointerEnter={(event) => {
        hovering(event, true)
      }}
      onPointerLeave={(event) => {
        hovering(event, false)
      }}
      onFocus={() => {
        lines.onPoint(line, true)
      }}
      onBlur={() => {
        lines.onPoint(line, false)
      }}
      onClick={() => {
        lines.onShow(line)
      }}
    >
      {children}
      <span id={hint} hidden>
        {m.chat_line_lights_hint()}
      </span>
    </button>
  )
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

/** What the agent says at each beat, a few words: the thing itself is lit, not explained. */
const toldSaid: Record<ToldPart, () => string> = {
  title: m.chat_told_title,
  preview: m.chat_told_preview,
  body: m.chat_told_body,
}

/** What the agent says once the tile's six are around it, a few words a beat. */
const aroundSaid: Record<AroundPart, () => string> = {
  same: m.chat_around_same,
  yours: m.chat_around_yours,
}

/**
 * The tile's body and its six as the same six (HEX-122), once they are around it: what the agent has
 * said of them, how many have landed, and the body's lines that name one, by their numbers.
 */
export interface ToldSix extends Omit<NamingLines, 'lit'> {
  said: AroundPart | undefined
  /** How many of the six have landed, in their order, while their landing is lit (`useAround`). */
  landed: number
  /** The line whose tile is pointed at, from its line or from the canvas; none while none is. */
  pointed: number | undefined
}

interface ToldProps {
  /** The beat reached: what the agent has told of the tile so far; nothing before the first. */
  told: ToldPart | undefined
  /** The tile's body, which comes with the last beat, in the agent's voice. */
  body: Words
  /** Its six around it, which its lines name; none before they are. */
  six?: ToldSix | undefined
}

/**
 * The agent telling a tile's words in turn, in its voice, as the canvas lights each: its few words at
 * each beat, each rising as it comes, then, with the last, the body itself, its numbered list a list
 * (HEX-120). Once its six are around it, each line naming one lights as it lands, then as it is
 * pointed at, here or on the canvas, and the agent says its few words more, a beat at a time
 * (HEX-122). A screen reader hears each as it comes. Under reduced motion each is simply there.
 */
export function Told({ told, body, six }: ToldProps) {
  const said = toldUpTo(told)
  // The live region is there before its first beat, so a screen reader hears that one too.
  return (
    <div aria-live="polite" className="grid gap-2">
      {said.map((part, index) => (
        <div key={part} className="motion-safe:animate-rise">
          <Message voice="agent" words={[toldSaid[part]()]} continued={index > 0} />
        </div>
      ))}
      {told === 'body' && (
        <div className="motion-safe:animate-rise">
          <Message voice="agent" words={body} continued lines={six && namingOf(six)} />
        </div>
      )}
      {aroundUpTo(six?.said).map((part) => (
        <div key={part} className="motion-safe:animate-rise">
          <Message voice="agent" words={[aroundSaid[part]()]} continued />
        </div>
      ))}
    </div>
  )
}

/**
 * The body's lines as its six name them: a line naming one lit once its tile, in its order, has
 * landed, while their landing is lit, or while it is pointed at.
 */
const namingOf = ({ names, onPoint, onShow, landed, pointed }: ToldSix): NamingLines => ({
  names,
  onPoint,
  onShow,
  lit: (line) => names(line) && (line <= landed || line === pointed),
})
