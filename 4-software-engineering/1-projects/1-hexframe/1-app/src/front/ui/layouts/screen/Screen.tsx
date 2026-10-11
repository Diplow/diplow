// hexframe's one screen: the Canvas behind, the Chat in front of it, and the canvas's corner. Wide, the
// chat is a column on the left cut along one curve, which is its scrollbar, and the canvas fills the
// screen behind it, its center off to the right, its tiles running on under the conversation's veil.
// Below Tailwind's `sm`, measured on the screen itself, so a specimen on /design-system folds as a phone
// does, one side is in front: the chat, the canvas showing through at its top, or the canvas, the
// chat's composer kept at its foot. A handle at the seam moves between them, by a tap, a drag, or the
// keyboard; which side is in front is the caller's, as the canvas's view is.
import { cn } from 'cn'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'

import { m } from '#/paraglide/messages'

import { cutAlongCurve } from './curve'
import { Scrollbar } from './Scrollbar'

/** A side of the screen; on a phone, the one in front. */
export type Side = 'chat' | 'canvas'

interface ScreenProps {
  /** The Canvas side: the System, or Help signed out. It fills the screen, behind the chat. */
  canvas: ReactNode
  /** The canvas's corner, top right: where you are, the theme at its head. */
  corner: ReactNode
  /** The Conversation, scrolled beside the curve on a wide screen. */
  messages: ReactNode
  /** The zone at the chat's foot: the composer, or signed out, the sign-in widget's place. */
  composer: ReactNode
  /** On a phone, the side in front; a wide screen shows both. */
  front: Side
  onFrontChange: (front: Side) => void
  className?: string
}

/**
 * The chat's width, wide: about a third of the screen, kept between what a line of the conversation
 * needs and what leaves the canvas its 60%. `cqw` is the screen's own width.
 */
const chatWidth = 'clamp(22.5rem, 31cqw, 31.25rem)'

/** Where the curve leaves the top of the screen and comes back at its foot. */
const edge = 'calc(var(--screen-chat) + 1.125rem)'

const cut = cutAlongCurve('var(--screen-edge)')

export function Screen({
  canvas,
  corner,
  messages,
  composer,
  front,
  onFrontChange,
  className,
}: ScreenProps) {
  const screen = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const phone = usePhone(screen)
  // The conversation opens at its foot, the latest last.
  useEffect(() => {
    const messages = scroller.current
    if (messages !== null) messages.scrollTop = messages.scrollHeight
  }, [])
  const chatInFront = front === 'chat'
  // A move made from a seam hands the focus to the seam on the other side, once the screen has
  // turned, so the keyboard can go back rather than lose the seam that went away. Should the caller
  // keep the side as it was, that seam is missing or inert, and the focus stays where it is.
  const toCanvas = useRef<HTMLButtonElement>(null)
  const toChat = useRef<HTMLButtonElement>(null)
  const move = (to: Side) => () => {
    flushSync(() => {
      onFrontChange(to)
    })
    ;(to === 'chat' ? toCanvas : toChat).current?.focus()
  }
  return (
    <div
      ref={screen}
      className={cn('@container relative isolate overflow-hidden bg-background', className)}
      style={
        { '--screen-chat': chatWidth, '--screen-edge': edge, '--screen-cut': cut } as CSSProperties
      }
    >
      {/* The chat comes first, so the keyboard reaches the conversation and the composer first. */}
      <Veil chatInFront={chatInFront} />
      <section
        aria-label={m.screen_chat()}
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex flex-col',
          '@min-[40rem]:pointer-events-auto @min-[40rem]:right-auto @min-[40rem]:w-[calc(var(--screen-edge)+2.625rem)] @min-[40rem]:[clip-path:var(--screen-cut)]',
        )}
      >
        <div
          inert={phone && !chatInFront}
          className={cn(
            'flex min-h-0 flex-1 flex-col duration-(--duration-fold) ease-glide motion-reduce:transition-none',
            // Visible at once when it comes back, so the seam can take the focus; hidden once faded.
            chatInFront
              ? 'pointer-events-auto transition-[opacity,translate]'
              : 'invisible translate-y-6 opacity-0 transition-[opacity,translate,visibility] @min-[40rem]:visible @min-[40rem]:translate-y-0 @min-[40rem]:opacity-100',
          )}
        >
          <Handle
            ref={toCanvas}
            label={m.screen_show_canvas()}
            towards="down"
            onMove={move('canvas')}
            className="h-24 items-end"
          />
          <Brand />
          <Messages scroller={scroller}>{messages}</Messages>
        </div>
        <div className="pointer-events-auto flex-none">
          {!chatInFront && (
            <Handle
              ref={toChat}
              label={m.screen_show_chat()}
              towards="up"
              onMove={move('chat')}
              className="h-11 items-center bg-linear-to-b from-transparent to-background/70"
            />
          )}
          {composer}
        </div>
      </section>
      <Scrollbar screen={screen} scroller={scroller} />
      <div
        className={cn(
          'absolute top-[1.375rem] right-[1.375rem] z-30',
          chatInFront && '@max-[40rem]:hidden',
        )}
      >
        {corner}
      </div>
      <section
        aria-label={m.screen_canvas()}
        inert={phone && chatInFront}
        className="absolute inset-0 z-0 flex @min-[40rem]:left-(--screen-edge)"
      >
        {canvas}
      </section>
    </div>
  )
}

/** Whether the screen is a phone's, below `sm` of its own width, once it is measured. */
function usePhone(screen: RefObject<HTMLElement | null>) {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const element = screen.current
    if (element === null) return undefined
    const sm = 40 * parseFloat(getComputedStyle(document.documentElement).fontSize)
    const resized = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setPhone(entry.contentRect.width < sm)
    })
    resized.observe(element)
    return () => {
      resized.disconnect()
    }
  }, [screen])
  return phone
}

/**
 * The conversation floats over the canvas: wide, a veil fading toward the curve, so the tiles run on
 * under it; on a phone, the whole screen below a strip where the canvas shows through, while the chat
 * is in front.
 */
function Veil({ chatInFront }: { chatInFront: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-10 backdrop-blur-md transition-opacity duration-(--duration-fold) motion-reduce:transition-none',
        'bg-linear-to-b from-background/20 via-background/85 via-15% to-background/90',
        '@min-[40rem]:right-auto @min-[40rem]:w-[calc(var(--screen-chat)+10.625rem)] @min-[40rem]:bg-linear-to-r @min-[40rem]:from-background/90 @min-[40rem]:via-background/75 @min-[40rem]:via-62% @min-[40rem]:to-transparent @min-[40rem]:opacity-100 @min-[40rem]:[mask-image:radial-gradient(ellipse_100%_125%_at_0%_50%,black_66%,transparent_92%)]',
        chatInFront ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

/** hexframe's mark, amber as the human's, and its name. */
function Brand() {
  return (
    <div className="flex flex-none items-center gap-2.5 px-5 pt-2 text-foreground @min-[40rem]:px-9 @min-[40rem]:pt-7">
      <svg viewBox="-11 -12 22 24" aria-hidden className="h-[22px] w-5">
        <polygon
          points="0,-11 9.53,-5.5 9.53,5.5 0,11 -9.53,5.5 -9.53,-5.5"
          fill="none"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          className="stroke-human"
        />
      </svg>
      <span className="font-serif text-xl font-light italic">{m.screen_brand()}</span>
    </div>
  )
}

/**
 * The conversation's scroller. Wide, its own scrollbar gives way to the star on the curve; it stays
 * focusable, so the keyboard scrolls it. Its content sits at its foot, the latest last, in one element
 * that stays whatever the slot holds, so the scrollbar sees it grow.
 */
function Messages({
  scroller,
  children,
}: {
  scroller: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div
      ref={scroller}
      // A scroller the keyboard has to reach, to scroll what it holds.
      tabIndex={0}
      role="region"
      aria-label={m.screen_messages()}
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-6 pb-7 outline-none [mask-image:linear-gradient(transparent,black_1.75rem)] focus-visible:ring-1 focus-visible:ring-human/60 focus-visible:ring-inset',
        '@min-[40rem]:pr-[6.25rem] @min-[40rem]:pl-9 @min-[40rem]:[scrollbar-width:none] @min-[40rem]:[&::-webkit-scrollbar]:hidden',
      )}
    >
      <div className="mt-auto">{children}</div>
    </div>
  )
}

interface HandleProps {
  ref: Ref<HTMLButtonElement>
  label: string
  /** The way a drag goes to move: down hands the screen to the canvas, up gives it back to the chat. */
  towards: 'down' | 'up'
  onMove: () => void
  className?: string
}

/** How far a drag goes before it moves the screen, in px. */
const dragged = 24

/**
 * The seam between the sides on a phone, a button: a tap, Enter or Space moves to the other side, and
 * so does a drag past a short way in the direction it points. Any drag past that way swallows the
 * click after it, so a drag moves once, and a drag the other way not at all. Hidden on a wide
 * screen, which shows both.
 */
function Handle({ ref, label, towards, onMove, className }: HandleProps) {
  const start = useRef<number | undefined>(undefined)
  const dragging = useRef(false)
  const onPointerUp = (event: PointerEvent) => {
    if (start.current === undefined) return
    const distance = event.clientY - start.current
    start.current = undefined
    dragging.current = Math.abs(distance) > dragged
    if (dragging.current && (towards === 'down') === distance > 0) onMove()
  }
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'group/handle flex w-full flex-none touch-none justify-center pb-2 outline-none @min-[40rem]:hidden',
        className,
      )}
      onPointerDown={(event) => {
        // Held, so the drag still ends here when the finger lifts past the seam.
        event.currentTarget.setPointerCapture(event.pointerId)
        start.current = event.clientY
        dragging.current = false
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = undefined
      }}
      onClick={() => {
        if (dragging.current) {
          dragging.current = false
          return
        }
        onMove()
      }}
    >
      {/* The seam: a short curve, as every separator here is, which lights under the keyboard. */}
      <svg viewBox="0 0 48 8" aria-hidden className="h-2 w-12 overflow-visible">
        <path
          d={towards === 'down' ? 'M1 1 Q24 9 47 1' : 'M1 7 Q24 -1 47 7'}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="stroke-faint transition-colors group-hover/handle:stroke-muted-foreground group-focus-visible/handle:stroke-human"
        />
      </svg>
    </button>
  )
}
