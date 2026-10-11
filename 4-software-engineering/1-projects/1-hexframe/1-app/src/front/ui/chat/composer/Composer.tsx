// Where the user writes to the agent: a zone of the conversation in their amber, its field in their
// serif, the send hex lit once there is something to send, and under it what the agent may do, ask
// first or apply with undo. A `/` at the start lists the commands, an `@` anywhere the Tiles, and the
// list rises from the composer's top line (`List`); the field keeps the focus and the keys, the arrows
// moving the row, Enter or Tab taking it, Escape leaving. A command and each Tile picked show marked
// in the field. While a Turn runs the field waits and send becomes Stop. Controlled: what is typed,
// what is listed and what a pick does are its user's, its state hook's on a real page.
import { cn } from 'cn'
import { type ReactNode, type Ref, useId, useRef, useState } from 'react'

import { m } from '#/paraglide/messages'

import { zone } from '../layouts/zone'
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
  /** The Account may not use the Assistant: its Messages are kept, none is answered. */
  unavailable?: boolean
  /** The Modes, the one on and how to switch it, its caller's from Assistant's; none before it is read. */
  mode?:
    { choices: ReadonlyArray<ModeChoice>; on: string; choose: (id: string) => void } | undefined
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
  unavailable = false,
  mode,
  className,
}: ComposerProps) {
  const list = useId()
  const backdrop = useRef<HTMLDivElement>(null)
  const rows = listing?.groups.flatMap((group) => group.rows) ?? []
  // The row the user is on, the first again whenever what was typed changes.
  const [on, setOn] = useState({ typed: '', row: undefined as string | undefined })
  const active =
    on.typed === listing?.typed && rows.some((row) => row.id === on.row) ? on.row : rows[0]?.id
  const open = listing !== undefined
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
        'grid gap-2 px-4 pt-5 pb-3 [--voice:var(--human)] sm:pr-6 sm:pl-9',
        className,
      )}
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
      <div className="flex items-end gap-4">
        <div className={cn('relative min-w-0 flex-1', waits && 'opacity-45')}>
          {/* The field's text, drawn under it with what is marked, since a textarea marks nothing. */}
          <div
            ref={backdrop}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden pb-1.5 font-human text-prose font-light break-words whitespace-pre-wrap text-foreground"
          >
            <FieldText value={value} marks={marks} />
          </div>
          <textarea
            ref={fieldRef}
            rows={1}
            value={value}
            readOnly={waits}
            disabled={waiting}
            aria-label={m.composer_label()}
            placeholder={m.composer_placeholder()}
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
            onScroll={(event) => {
              if (backdrop.current !== null)
                backdrop.current.scrollTop = event.currentTarget.scrollTop
            }}
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
        <SendButton ready={ready} running={running} sending={sending} waiting={waiting} />
      </div>
      {unavailable ? (
        <p className="text-xs font-light text-muted-foreground">
          {m.conversation_assistant_unavailable()}
        </p>
      ) : (
        mode !== undefined && <ModeSwitch {...mode} />
      )}
    </form>
  )
}

/** The field's value, each mark in its look, so the field and what is drawn under it agree. */
function FieldText({ value, marks }: { value: string; marks: ReadonlyArray<Mark> }) {
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
  // A space after the text, so a last line break still takes its line.
  parts.push(`${value.slice(at)} `)
  return parts
}

/** Send, a hex in the user's amber once there is something to send; Stop while a Turn runs. */
function SendButton({
  ready,
  running,
  sending,
  waiting,
}: {
  ready: boolean
  running: ComposerProps['running']
  sending: boolean
  waiting: boolean
}) {
  const stops = running !== undefined
  return (
    <button
      type="submit"
      aria-label={stops ? m.composer_stop() : m.composer_send()}
      disabled={waiting || sending || running?.stopping === true}
      className={cn(
        'group/send -mb-0.5 h-10.5 w-9.5 shrink-0 outline-none disabled:cursor-not-allowed pointer-coarse:h-12 pointer-coarse:w-11',
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
