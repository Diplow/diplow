// Where the user writes to the agent: a zone of the conversation in their amber, its field in their
// serif, the send hex lit once there is something to send, and under it what the agent may do, ask
// first or apply with undo. A `/` at the start lists the commands, an `@` anywhere the Tiles, and the
// list rises from the composer's top line (`List`); the field keeps the focus and the keys, the arrows
// moving the row, Enter or Tab taking it, Escape leaving. A command and each Tile picked show marked
// in the field. While a Turn runs the field waits and send becomes Stop. Controlled: what is typed,
// what is listed and what a pick does are its user's, its state hook's on a real page. Wide, its rows
// and its list run on to the curve at their height, the send hex against it. The field's words run on
// above the hex, sitting in its corner, and beside it, a line under them left to it once they reach
// it or the field scrolls; what the field cuts at its top or its foot fades out as it crosses it. Its
// crossings (HEX-108): the Tile row the user is on is told, for the canvas to light; under the field,
// where the next Turn works; a tile carried from the canvas is offered a place, and named where it is
// let go.
import { cn } from 'cn'
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../layouts/screen/state/useAlongCurve'
import { HexMark } from '../atoms/hex'
import { footPadding, zone } from '../layouts/zone'
import { Said, weave } from '../text/words'
import { type Listing, List, optionId } from './List'

/** A stretch of the field shown marked: the command it opens with, or a Tile it points at. */
export interface Mark {
  readonly from: number
  readonly to: number
  readonly kind: 'command' | 'tile'
}

/** One of what the agent may be let do, a Mode: its id, its name on the switch, and what it means. */
interface ModeChoice {
  readonly id: string
  readonly label: string
  readonly means: string
}

interface ComposerProps {
  value: string
  /** The field changed, or its caret moved: the value and where the caret stands. */
  onChange: (value: string, caret: number) => void
  /** What the field shows marked. */
  marks?: ReadonlyArray<Mark> | undefined
  /** What the caret stands in lists, none when nothing is listed. */
  listing?: Listing | undefined
  /** A row taken, by its id. */
  onPick: (row: string) => void
  /** The list left: Escape, or the field left. */
  onLeave: () => void
  /** The Message sent, never empty. */
  onSend: () => void
  /** The field, for its user to set its caret after a pick. */
  fieldRef?: Ref<HTMLTextAreaElement> | undefined
  /** The Message on its way. */
  sending?: boolean
  /** A Turn running, and how to stop it: the field waits meanwhile. */
  running?: { stop: () => void; stopping: boolean } | undefined
  /** Nothing can be sent yet. */
  waiting?: boolean
  /** The Modes, the one on and how to switch it, its caller's from Assistant's; none before it is read. */
  mode?:
    { choices: ReadonlyArray<ModeChoice>; on: string; choose: (id: string) => void } | undefined
  /** The Tile row the user is on, by its id, as the list opens, moves and shuts; none off a Tile. */
  onPoint?: ((row: string | undefined) => void) | undefined
  /**
   * Where the next Turn works, as Assistant decides it: the Tile the Message opens with, `first`, else
   * the one centered on the canvas.
   */
  place?: { title: string; first: boolean } | undefined
  /** A tile carried from the canvas, by its title: the composer offers to name it. */
  carried?: string | undefined
  /** The tile carried, let go over the composer: its caller names it in the field. */
  onDrop?: (() => void) | undefined
  /** What the empty field invites; a reply, or a tile pointed at, unless its caller says otherwise. */
  placeholder?: string | undefined
  className?: string
}

export function Composer({
  value,
  onChange,
  marks = [],
  listing,
  onPick,
  onLeave,
  onSend,
  fieldRef,
  sending = false,
  running,
  waiting = false,
  mode,
  onPoint,
  place,
  carried,
  onDrop,
  placeholder = m.composer_placeholder(),
  className,
}: ComposerProps) {
  const list = useId()
  const { field, backdrop, end, send, room, follow } = useField(value, fieldRef)
  const rows = listing?.groups.flatMap((group) => group.rows) ?? []
  // The row the user is on, the first again whenever what was typed changes.
  const [on, setOn] = useState({ typed: '', row: undefined as string | undefined })
  const active =
    on.typed === listing?.typed && rows.some((row) => row.id === on.row) ? on.row : rows[0]?.id
  const open = listing !== undefined
  usePointing(rows.find((row) => row.id === active && open && row.kind === 'tile')?.id, onPoint)
  const drop = useDrop(carried, onDrop)
  const waits = running !== undefined || sending
  const ready = value.trim() !== '' && !waits && !waiting
  const move = (by: number) => {
    const at = rows.findIndex((row) => row.id === active)
    const next = rows[(at + by + rows.length) % rows.length]
    if (next !== undefined) setOn({ typed: listing?.typed ?? '', row: next.id })
  }
  return (
    <form
      noValidate
      aria-busy={waits}
      className={cn(
        zone,
        footPadding,
        'grid gap-2 pt-5 pb-3 transition-[background-color,box-shadow] duration-300 [--voice:var(--human)]',
        // A tile carried: the line on top turns your amber; over it, the zone lights to take it.
        carried !== undefined && 'before:bg-none before:bg-human/45',
        drop.over && 'bg-human/6 shadow-[0_-10px_28px_-18px_var(--human)] before:bg-human',
        className,
      )}
      {...drop.handlers}
      onSubmit={(event) => {
        event.preventDefault()
        // Only the Stop submits while a Turn runs, and once.
        if (running !== undefined) {
          if (!running.stopping) running.stop()
        } else if (ready) onSend()
      }}
    >
      {open && (
        <List
          id={list}
          listing={listing}
          active={active}
          onHover={(row) => {
            setOn({ typed: listing.typed, row })
          }}
          onPick={onPick}
        />
      )}
      <div ref={toCurve} className={cn(runsToCurve, 'relative')}>
        <div className={cn('relative', room, waits && 'opacity-45')}>
          <Backdrop ref={backdrop} value={value} marks={marks} end={end} />
          <textarea
            ref={field}
            rows={1}
            value={value}
            readOnly={waits}
            disabled={waiting}
            aria-label={m.composer_label()}
            placeholder={placeholder}
            enterKeyHint="send"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={list}
            aria-activedescendant={
              open && active !== undefined ? optionId(list, active) : undefined
            }
            className="relative block field-sizing-content max-h-30 min-h-[1.55em] w-full resize-none overflow-y-auto bg-transparent pb-1.5 font-human text-prose font-light break-words text-transparent caret-human outline-none [scrollbar-width:none] placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={(event) => {
              onChange(event.target.value, event.target.selectionStart)
            }}
            onSelect={(event) => {
              const { value: now, selectionStart } = event.currentTarget
              if (now === value) onChange(now, selectionStart)
            }}
            onScroll={follow}
            onBlur={() => {
              if (open) onLeave()
            }}
            onKeyDown={(event) => {
              // A key confirming an input method's composition is the composition's.
              if (event.nativeEvent.isComposing) return
              const taken = (() => {
                if (open && event.key === 'Escape') onLeave()
                else if (open && rows.length > 0 && event.key === 'ArrowDown') move(1)
                else if (open && rows.length > 0 && event.key === 'ArrowUp') move(-1)
                else if (
                  open &&
                  active !== undefined &&
                  (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))
                )
                  onPick(active)
                // Enter sends what is ready, never a Stop: that is the button's alone.
                else if (event.key === 'Enter' && !event.shiftKey) {
                  if (ready) event.currentTarget.form?.requestSubmit()
                } else return false
                return true
              })()
              if (taken) event.preventDefault()
            }}
          />
        </div>
        <SendButton
          ref={send}
          ready={ready}
          running={running}
          sending={sending}
          waiting={waiting}
        />
      </div>
      <Dropping carried={carried} over={drop.over} named={drop.named} />
      {(mode !== undefined || place !== undefined) && (
        <div
          ref={toCurve}
          className={cn(runsToCurve, 'flex flex-wrap items-center justify-between gap-x-4 gap-y-1')}
        >
          {mode !== undefined && <ModeSwitch {...mode} />}
          {place !== undefined && <Place {...place} />}
        </div>
      )}
    </form>
  )
}

/** How far the field's words keep from the send hex, in px. */
const besideSend = 16

/** How far the words cut at the field's top or foot fade out as they cross it, at most, in px. */
const fade = 24

/**
 * The field and what is drawn under it, kept together as it is written, scrolled and resized: its
 * room for the send hex in its corner, a line under it, once its last line reaches the hex, or the
 * line above its tip, which rises into that line's foot, or once it scrolls, so no line it shows
 * passes under the hex, measured before it shows; until then its words run on above the hex and
 * beside it. And the words it cuts at its top or its foot fading out as they cross it (`follow`).
 * With the refs it measures by: the field, its caller's too, what is drawn under it, where its words
 * end, and the hex.
 */
function useField(value: string, fieldRef: Ref<HTMLTextAreaElement> | undefined) {
  const own = useRef<HTMLTextAreaElement>(null)
  const field = useCallback(
    (element: HTMLTextAreaElement | null) => {
      own.current = element
      if (typeof fieldRef === 'function') return fieldRef(element)
      if (fieldRef !== null && fieldRef !== undefined) fieldRef.current = element
      return undefined
    },
    [fieldRef],
  )
  const backdrop = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLSpanElement>(null)
  const send = useRef<HTMLButtonElement>(null)
  const [makes, setMakes] = useState(false)
  const follow = () => {
    if (own.current !== null && backdrop.current !== null) cut(own.current, backdrop.current)
  }
  const measure = useEffectEvent(() => {
    if (own.current === null || backdrop.current === null) return
    if (end.current === null || send.current === null) return
    const last = end.current.getBoundingClientRect()
    const hex = send.current.getBoundingClientRect()
    // The line above the last, by its pieces: where it ends against the hex's tip, at its middle.
    const line = parseFloat(getComputedStyle(backdrop.current).lineHeight)
    const words = document.createRange()
    words.selectNodeContents(backdrop.current)
    const above = Array.from(words.getClientRects()).filter(
      (piece) => Math.abs(last.bottom - line - piece.bottom) < line / 2,
    )
    const tip = hex.left + hex.width / 2 - besideSend / 2
    const scrolls = own.current.scrollHeight > own.current.clientHeight + 1
    setMakes(
      scrolls || last.left > hex.left - besideSend || above.some((piece) => piece.right > tip),
    )
    follow()
  })
  useLayoutEffect(() => {
    measure()
  }, [value])
  useEffect(() => {
    if (backdrop.current === null) return
    const resized = new ResizeObserver(() => {
      measure()
    })
    resized.observe(backdrop.current)
    return () => {
      resized.disconnect()
    }
  }, [])
  const room = makes && 'mb-[calc(--spacing(1.5)+var(--text-prose)*var(--text-prose--line-height))]'
  return { field, backdrop, end, send, room, follow }
}

/** The field's text, drawn under it with what is marked, since a textarea marks nothing. */
function Backdrop({
  ref,
  ...text
}: {
  ref: Ref<HTMLDivElement>
  value: string
  marks: ReadonlyArray<Mark>
  end: Ref<HTMLSpanElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden pb-1.5 font-human text-prose font-light break-words whitespace-pre-wrap text-foreground [mask-image:linear-gradient(to_bottom,transparent,black_var(--cut-top,0px),black_calc(100%-var(--cut-foot,0px)),transparent)]"
    >
      <FieldText {...text} />
    </div>
  )
}

/**
 * What is drawn under the field scrolled with it, the words it cuts at its top or its foot fading out
 * as they cross it, as far as they are scrolled past it, up to `fade`.
 */
function cut(field: HTMLElement, drawn: HTMLElement) {
  drawn.scrollTop = field.scrollTop
  const below = field.scrollHeight - field.clientHeight - field.scrollTop
  drawn.style.setProperty('--cut-top', `${String(Math.min(field.scrollTop, fade))}px`)
  drawn.style.setProperty('--cut-foot', `${String(Math.max(0, Math.min(below, fade)))}px`)
}

/**
 * A tile carried over the page: where to let it go, lit while it is over the composer; and, for a
 * screen reader, the tile last named by a drop.
 */
function Dropping({ carried, over, named }: { carried?: string; over: boolean; named?: string }) {
  return (
    <>
      {carried === undefined ? null : (
        <p className={cn('text-xs font-light', over ? 'text-human' : 'text-muted-foreground')}>
          {m.composer_drop_here({ title: carried })}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {named === undefined ? '' : m.composer_dropped({ title: named })}
      </p>
    </>
  )
}

/**
 * Tells its caller the Tile row the user is on whenever it changes, and nothing once the composer
 * goes, so the canvas never stays lit for a list no longer there.
 */
function usePointing(row: string | undefined, onPoint: ComposerProps['onPoint']) {
  const point = useEffectEvent((pointed: string | undefined) => {
    onPoint?.(pointed)
  })
  useEffect(() => {
    point(row)
  }, [row])
  useEffect(
    () => () => {
      point(undefined)
    },
    [],
  )
}

/**
 * A tile carried from the canvas over the composer, and let go there: whether the pointer is over it
 * meanwhile, the handlers that follow it, and the tile last named, which a screen reader hears.
 */
function useDrop(carried: string | undefined, onDrop: ComposerProps['onDrop']) {
  const [over, setOver] = useState(false)
  const [named, setNamed] = useState<string>()
  return {
    over: over && carried !== undefined,
    named,
    handlers: {
      onPointerMove: () => {
        if (carried !== undefined && !over) setOver(true)
      },
      onPointerLeave: () => {
        setOver(false)
      },
      onPointerUp: () => {
        setOver(false)
        if (carried === undefined || onDrop === undefined) return
        onDrop()
        setNamed(carried)
      },
    },
  }
}

/** Where the next Turn works, quietly, beside what the agent may do: neutral, since it says here. */
function Place({ title, first }: { title: string; first: boolean }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 font-mono text-[0.65625rem] text-muted-foreground">
      <HexMark className="size-2 text-foreground/40" />
      <span className="min-w-0 truncate">
        <Said
          words={weave(first ? m.composer_place_first : m.composer_place, {
            title: { name: title },
          })}
        />
      </span>
    </p>
  )
}

/**
 * The field's value, each mark in its look, so the field and what is drawn under it agree, and `end`
 * where its words end.
 */
function FieldText({
  value,
  marks,
  end,
}: {
  value: string
  marks: ReadonlyArray<Mark>
  end: Ref<HTMLSpanElement>
}) {
  const sorted = [...marks].sort((a, b) => a.from - b.from)
  const parts: ReactNode[] = []
  let at = 0
  for (const mark of sorted) {
    if (mark.from < at) continue
    parts.push(value.slice(at, mark.from))
    parts.push(
      <span
        key={mark.from}
        className={
          mark.kind === 'command'
            ? 'text-human'
            : 'underline decoration-foreground/25 decoration-1 underline-offset-3'
        }
      >
        {value.slice(mark.from, mark.to)}
      </span>,
    )
    at = mark.to
  }
  parts.push(value.slice(at), <span key="end" ref={end} />)
  // A space after the text, so a last line break still takes its line.
  parts.push(' ')
  return parts
}

/**
 * Send, a hex in the user's amber once there is something to send; Stop while a Turn runs. It sits in
 * the field's corner, the words running on above it.
 */
function SendButton({
  ref,
  ready,
  running,
  sending,
  waiting,
}: {
  ref: Ref<HTMLButtonElement>
  ready: boolean
  running: ComposerProps['running']
  sending: boolean
  waiting: boolean
}) {
  const stops = running !== undefined
  return (
    <button
      ref={ref}
      type="submit"
      aria-label={stops ? m.composer_stop() : m.composer_send()}
      disabled={waiting || sending || running?.stopping === true}
      className={cn(
        'group/send absolute right-0 -bottom-0.5 h-10.5 w-9.5 outline-none disabled:cursor-not-allowed pointer-coarse:h-12 pointer-coarse:w-11',
        stops ? 'text-foreground' : ready || sending ? 'text-human' : 'text-muted-foreground',
      )}
    >
      <svg viewBox="-19 -21 38 42" className="size-full overflow-visible" aria-hidden>
        <polygon
          points="0,-21 18.19,-10.5 18.19,10.5 0,21 -18.19,10.5 -18.19,-10.5"
          vectorEffect="non-scaling-stroke"
          className={cn(
            'stroke-1 motion-safe:transition-[stroke,fill] motion-safe:duration-300 group-focus-visible/send:stroke-ring group-focus-visible/send:stroke-2',
            stops
              ? 'fill-none stroke-muted-foreground'
              : ready || sending
                ? 'fill-human/12 stroke-human drop-shadow-[0_0_8px_color-mix(in_oklab,var(--human)_55%,transparent)]'
                : 'fill-none stroke-input',
            sending && 'motion-safe:animate-breathe',
          )}
        />
        {stops ? (
          <rect x={-4} y={-4} width={8} height={8} className="fill-current" />
        ) : (
          <path d="M0 6V-6M-5 -1l5-5 5 5" strokeWidth={1.3} className="fill-none stroke-current" />
        )}
      </svg>
    </button>
  )
}

/** What the agent may do, under the field, the Mode on in the agent's violet. */
function ModeSwitch({ choices, on, choose }: NonNullable<ComposerProps['mode']>) {
  const means = useId()
  return (
    <div
      role="group"
      aria-label={m.composer_mode_label()}
      aria-describedby={means}
      className="flex items-center gap-3 font-mono text-[0.65625rem] text-muted-foreground"
    >
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-pressed={choice.id === on}
          className="outline-none hover:text-foreground focus-visible:underline focus-visible:underline-offset-4 aria-pressed:text-agent pointer-coarse:min-h-11"
          onClick={() => {
            if (choice.id !== on) choose(choice.id)
          }}
        >
          {choice.label}
        </button>
      ))}
      <span id={means} className="sr-only">
        {choices.find((choice) => choice.id === on)?.means}
      </span>
    </div>
  )
}
