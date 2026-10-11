import { cn } from 'cn'
import { HoverCard as Card } from 'radix-ui'
import { useId, useState, type ReactElement } from 'react'

interface HoverCardProps {
  /** The tile it tells of; it must take a ref, focus and an `aria-describedby`, as a button does. */
  children: ReactElement
  /** Its kind and place, in a few words: "branch, east of Projects". */
  place: string
  title: string
  /** Its preview, in full where the tile cuts it. */
  description?: string
  /** One more line, in the colour of what it says: a clash, the agent at work, a Reference. */
  note?: { text: string; tone?: 'warning' | 'agent' | 'context' }
  /** While its menu is open, or the tile is not offered (a move, a pick), no card. */
  disabled?: boolean
}

const noteTones = {
  warning: 'text-warning',
  agent: 'text-agent',
  context: 'text-context',
} as const

/**
 * What a tile cuts short, in full, beside it: after a moment under the pointer, at once on keyboard
 * focus. A finger can't hover, so under one it never opens: the long press opens the tile's menu,
 * whose header says the same.
 */
export function HoverCard({
  children,
  place,
  title,
  description,
  note,
  disabled = false,
}: HoverCardProps) {
  const [open, setOpen] = useState(false)
  const describedBy = useId()
  return (
    <>
      <Card.Root open={open && !disabled} onOpenChange={setOpen} openDelay={420} closeDelay={80}>
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
            setOpen(false)
          }}
        >
          {children}
        </Card.Trigger>
        <Card.Portal>
          <Card.Content
            side="right"
            align="center"
            sideOffset={10}
            collisionPadding={12}
            // The card is for the eye: what it says, a screen reader hears from the tile itself.
            aria-hidden="true"
            className="z-50 w-[16.875rem] bg-popover px-4 pt-[0.8125rem] pb-3.5 text-popover-foreground shadow-lift before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-input before:to-input/30 before:content-[''] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 motion-reduce:animate-none pointer-coarse:hidden"
          >
            <Says place={place} title={title} description={description} note={note} />
          </Card.Content>
        </Card.Portal>
      </Card.Root>
      <span id={describedBy} className="sr-only">
        {said([place, description, note?.text])}
      </span>
    </>
  )
}

function Says({ place, title, description, note }: Omit<HoverCardProps, 'children' | 'disabled'>) {
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
      {note !== undefined && (
        <div
          className={cn(
            'mt-2 font-mono text-[0.6875rem] leading-snug',
            note.tone === undefined ? 'text-faint' : noteTones[note.tone],
          )}
        >
          {note.text}
        </div>
      )}
    </>
  )
}

/** What the card says, as one description: its lines, each ended once. */
const said = (lines: readonly (string | undefined)[]) =>
  lines
    .flatMap((line) => (line === undefined || line === '' ? [] : [line]))
    .map((line) => line.replace(/[.\s]+$/, ''))
    .join('. ')
