// What a tile cuts short, in full, beside it: on the canvas, the tile itself (HEX-96, HEX-105); in the
// chat, a tile named (HEX-108). Shared by both sides, so it knows neither: what its trigger hands it,
// it hands on to what it wraps.
import { cn } from 'cn'
import { HoverCard as Card, Slot } from 'radix-ui'
import { useId, useRef, useState, type ComponentProps, type ReactElement } from 'react'

/**
 * What a trigger around it hands what it wraps, a menu's on a tile: its ref, its handlers and its
 * attributes, composed by Radix's `Slot`.
 */
type Hand = ComponentProps<typeof Slot.Root>

/** A line more of what it tells of, in the colour of what it says. */
export interface CardNote {
  text: string
  tone?: 'warning' | 'agent' | 'context'
}

interface HoverCardProps extends Omit<Hand, 'children' | 'title' | 'onOpenChange'> {
  /** What it tells of; it must take a ref, focus and an `aria-describedby`, as a button does. */
  children: ReactElement
  /** Its kind and place, in a few words: "branch, east of Projects". */
  place: string
  title: string
  /** Its preview, in full where the tile cuts it. */
  description?: string
  /** Lines more, each in the colour of what it says: a clash, a Reference, the agent at work. */
  notes?: readonly CardNote[]
  /** Where the tile is drawn: inside an <svg>, which takes no <span>, its words go in a <desc>. */
  within?: 'html' | 'svg'
  /** Where it opens: beside a tile, on its right; above a line of words, whose next ones stay free. */
  side?: 'right' | 'top'
  /** Kept shut while something else tells of the tile: its menu, whose header says the same. */
  shut?: boolean
  /** It opened or shut: what it tells of is pointed at meanwhile, which a crossing shows elsewhere. */
  onOpenChange?: (open: boolean) => void
}

const noteTones = {
  warning: 'text-warning',
  agent: 'text-agent',
  context: 'text-context',
} as const

/**
 * What a tile cuts short, in full, beside it: after a moment under the pointer, at once on keyboard
 * focus. A finger can't hover, so under one it never opens: the long press opens the tile's menu,
 * whose header says the same. What a trigger around it hands it, the tile's menu's, it hands the tile
 * in turn, so one tile takes both.
 */
export function HoverCard({
  children,
  place,
  title,
  description,
  notes = [],
  within = 'html',
  side = 'right',
  shut = false,
  onOpenChange,
  ...hand
}: HoverCardProps) {
  const [open, setOpenState] = useState(false)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    if (next !== open) onOpenChange?.(next)
  }
  // Pressed since the pointer came in: a click is no hover, so the card Radix would open after the
  // delay stays shut until the pointer leaves.
  const pressed = useRef(false)
  const describedBy = useId()
  return (
    <>
      <Card.Root
        open={open && !shut}
        onOpenChange={(next) => {
          if (!next || !pressed.current) setOpen(next)
        }}
        openDelay={420}
        closeDelay={80}
      >
        <Card.Trigger
          asChild
          aria-describedby={describedBy}
          onFocus={(event) => {
            // Radix opens on any focus, after the delay. From the keyboard it opens at once; a click
            // or a tap focuses too, and opens nothing.
            event.preventDefault()
            if (event.currentTarget.matches(':focus-visible')) setOpen(true)
          }}
          onPointerDown={() => {
            pressed.current = true
            setOpen(false)
          }}
          onPointerLeave={() => {
            pressed.current = false
          }}
        >
          <Slot.Root {...hand}>{children}</Slot.Root>
        </Card.Trigger>
        <Card.Portal>
          <Card.Content
            side={side}
            align={side === 'right' ? 'center' : 'start'}
            sideOffset={10}
            collisionPadding={12}
            // The card is for the eye: what it says, a screen reader hears from the tile itself. The
            // pointer goes through it, so it never holds itself open over the next tile or word.
            aria-hidden="true"
            className="risen pointer-events-none relative z-50 w-[16.875rem] px-4 pt-[0.8125rem] pb-3.5 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 motion-reduce:animate-none pointer-coarse:hidden"
          >
            <Says place={place} title={title} description={description} notes={notes} />
          </Card.Content>
        </Card.Portal>
      </Card.Root>
      {within === 'svg' ? (
        <desc id={describedBy}>{said([place, description, ...notes.map(({ text }) => text)])}</desc>
      ) : (
        <span id={describedBy} className="sr-only">
          {said([place, description, ...notes.map(({ text }) => text)])}
        </span>
      )}
    </>
  )
}

function Says({
  place,
  title,
  description,
  notes = [],
}: Omit<HoverCardProps, 'children' | 'within' | 'side' | 'shut'>) {
  return (
    <>
      <div className="font-mono text-[0.65625rem] text-faint">{place}</div>
      <div className="mt-[3px] mb-[5px] font-human text-[1.0625rem] leading-tight text-foreground">
        {title}
      </div>
      {description !== undefined && (
        <div className="text-[0.78125rem] leading-normal font-light text-muted-foreground">
          {description}
        </div>
      )}
      {notes.map((note) => (
        <div
          key={note.text}
          className={cn(
            'mt-2 font-mono text-[0.6875rem] leading-snug',
            note.tone === undefined ? 'text-faint' : noteTones[note.tone],
          )}
        >
          {note.text}
        </div>
      ))}
    </>
  )
}

/** What the card says, as one description: its lines, each ended once. */
const said = (lines: readonly (string | undefined)[]) =>
  lines
    .flatMap((line) => (line === undefined || line === '' ? [] : [line]))
    .map((line) => line.replace(/[.\s]+$/, ''))
    .join('. ')
