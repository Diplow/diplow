// hexframe's one screen: the Canvas behind, the Chat in front of it, and the canvas's corner. Wide, the
// chat is a column on the left cut along one curve, which is its scrollbar, and the canvas fills the
// screen behind it, its center off to the right, its tiles running on under the conversation's veil.
// Below Tailwind's `sm`, measured on the screen itself, so a specimen on /design-system folds as a phone
// does, one side is in front: the chat, the canvas showing through at its top, or the canvas, the
// chat's composer kept at its foot. A handle at the seam moves between them, by a tap, a drag, or the
// keyboard; which side is in front is the caller's, as the canvas's view is. A crossing that brings the
// canvas forward is the caller's too: a hand on the canvas meanwhile takes it, the focus the chat lost
// comes back with it, and what it showed is said to a screen reader (HEX-108).
import { cn } from 'cn'
import {
  useEffect,
  useLayoutEffect,
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

import { focusHeld, focusLost, giveFocusBack } from '../../focus'
import { cutAlongCurve, reach } from './curve'
import { keptAtFoot } from './state/latest'
import { Scrollbar } from './Scrollbar'

/** A side of the screen; on a phone, the one in front. */
export type Side = 'chat' | 'canvas'

/**
 * What a crossing showed, said to a screen reader, and how many were said: the same words said again
 * are heard again.
 */
export interface Said {
  readonly words: string
  readonly count: number
}

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
  /** The seam turned it, or, on a phone, a hand took the canvas in front: it stays. */
  onFrontChange: (front: Side) => void
  /** What the last crossing showed on the other side, said to a screen reader, each time anew. */
  said?: Said | undefined
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

/** How far the curve bows past the chat's edge, which the chat's column has to hold. */
const bulge = `${String(reach)}px`

/** What the chat's column holds past the bulge, as `--screen-margin`, so the curve's line isn't cut. */
const margin = '0.375rem'

/**
 * How far the chat's foot keeps its content in from the column's right, as `--screen-clear`: back
 * inside the chat's width, past the 1.125rem to the edge, the bulge and the column's margin, with the
 * margin again to spare, so nothing reaches the curve. A slot's ground runs on under it to the cut.
 * The foot hands it to what sits there as `--screen-foot-inset`, wide only, which the Composer and the
 * sign-in widget add to their own padding, so no caller pads them again.
 */
const clear =
  'calc(var(--screen-edge) - var(--screen-chat) + var(--screen-bulge) + 2 * var(--screen-margin))'

/**
 * The seam above the composer while the canvas is in front, as `--screen-seam`: on a phone the canvas
 * ends above it, whichever side is in front, so it never moves as the screen turns.
 */
const seam = '2.75rem'

/** Where the canvas's corner sits, in from the screen's top right: here, on Help and on its specimens. */
export const cornerPlace = 'absolute top-[1.375rem] right-[1.375rem]'

export function Screen({
  canvas,
  corner,
  messages,
  composer,
  front,
  onFrontChange,
  said,
  className,
}: ScreenProps) {
  const screen = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLDivElement>(null)
  const chat = useRef<HTMLElement>(null)
  useLatestShown(scroller, content, foot)
  useComposerHeight(screen, foot)
  const chatInFront = front === 'chat'
  // A move made from a seam hands the focus to the seam on the other side, once the screen has
  // turned, so the keyboard can go back rather than lose the seam that went away. Should the caller
  // keep the side as it was, that seam is missing or inert, and the focus stays where it is.
  const toCanvas = useRef<HTMLButtonElement>(null)
  const toChat = useRef<HTMLButtonElement>(null)
  const phone = usePhone(screen, toCanvas)
  // Only a phone's chat goes inert behind the canvas; a wide one keeps its focus as it is.
  useFocusKept(chat, !phone || chatInFront)
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
        {
          '--screen-chat': chatWidth,
          '--screen-edge': edge,
          '--screen-bulge': bulge,
          '--screen-margin': margin,
          '--screen-clear': clear,
          '--screen-seam': seam,
          '--screen-cut': cut,
        } as CSSProperties
      }
    >
      {/* The chat comes first, so the keyboard reaches the conversation and the composer first. */}
      <Veil chatInFront={chatInFront} />
      <section
        ref={chat}
        aria-label={m.screen_chat()}
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex flex-col',
          '@wide:pointer-events-auto @wide:right-auto @wide:w-[calc(var(--screen-edge)+var(--screen-bulge)+var(--screen-margin))] @wide:[clip-path:var(--screen-cut)]',
        )}
      >
        <div
          inert={phone && !chatInFront}
          className={cn(
            'flex min-h-0 flex-1 flex-col duration-(--duration-fold) ease-glide motion-reduce:transition-none',
            // Visible at once when it comes back, so the seam can take the focus; hidden once faded.
            chatInFront
              ? 'pointer-events-auto transition-[opacity,translate]'
              : 'invisible translate-y-6 opacity-0 transition-[opacity,translate,visibility] @wide:visible @wide:translate-y-0 @wide:opacity-100',
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
          <Messages scroller={scroller} content={content}>
            {messages}
          </Messages>
        </div>
        <div className="pointer-events-auto flex-none">
          {!chatInFront && (
            <Handle
              ref={toChat}
              label={m.screen_show_chat()}
              towards="up"
              onMove={move('chat')}
              className="h-(--screen-seam) items-center bg-linear-to-b from-transparent to-background/70"
            />
          )}
          {/* Wide, its zone runs on to the cut and keeps its content clear of the curve itself. */}
          <div ref={foot} className="@wide:[--screen-foot-inset:var(--screen-clear)]">
            {composer}
          </div>
        </div>
      </section>
      <Scrollbar screen={screen} scroller={scroller} content={content} />
      <div className={cn(cornerPlace, 'z-30', chatInFront && '@max-wide:hidden')}>{corner}</div>
      <section
        aria-label={m.screen_canvas()}
        inert={phone && chatInFront}
        className="absolute inset-0 z-0 flex @max-wide:bottom-[calc(var(--screen-composer,0px)+var(--screen-seam))] @wide:left-(--screen-edge)"
        // On a phone, a hand on the canvas a crossing brought forward takes it: it stays in front.
        {...(phone &&
          !chatInFront && {
            onPointerDownCapture: () => {
              onFrontChange('canvas')
            },
            onKeyDownCapture: () => {
              onFrontChange('canvas')
            },
          })}
      >
        {canvas}
      </section>
      <p aria-live="polite" className="sr-only">
        {/* Drawn anew for each saying, so the same words said again are heard again. */}
        {said === undefined ? null : <span key={said.count}>{said.words}</span>}
      </p>
    </div>
  )
}

/**
 * The focus the chat held when the canvas came forward over it, given back with it: the chat went
 * inert and the focus with it, so a crossing that gives the chat back leaves the keyboard where it
 * was. Read as the chat goes inert, before the browser lets the focus go: a chat that held none gets
 * none back. A focus that went elsewhere meanwhile, the seam's or the canvas's, stays.
 */
function useFocusKept(chat: RefObject<HTMLElement | null>, chatShown: boolean) {
  const kept = useRef<HTMLElement | SVGElement | null>(null)
  useLayoutEffect(() => {
    if (chatShown) return
    const held = focusHeld()
    kept.current = held !== null && chat.current?.contains(held) === true ? held : null
  }, [chat, chatShown])
  useEffect(() => {
    if (chatShown && focusLost()) giveFocusBack(kept.current, { preventScroll: true })
    if (chatShown) kept.current = null
  }, [chatShown])
}

/** How close to its foot the conversation still reads as at its foot, in px. */
const atFoot = 2

/**
 * The conversation opens at its foot, the latest last, and stays there as it grows, its lines read
 * after the screen is drawn included, and as it shrinks, the foot below it growing, while the reader
 * hasn't left it. The reader leaves it by scrolling up, or by acting in a conversation too short to
 * scroll, asking for an earlier day included: what they act on stays where it is. Writing at the
 * chat's foot brings it back, so what they send shows.
 */
function useLatestShown(
  scroller: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  foot: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const messages = scroller.current
    const lines = content.current
    const composer = foot.current
    if (messages === null || lines === null || composer === null) return undefined
    let pinned = true
    const toFoot = () => {
      messages.scrollTop = messages.scrollHeight
    }
    const atItsFoot = () =>
      messages.scrollHeight - messages.scrollTop - messages.clientHeight <= atFoot
    const onScroll = () => {
      pinned = keptAtFoot({ kind: 'scrolled', atFoot: atItsFoot() })
    }
    const onAct = () => {
      const scrolls = messages.scrollHeight > messages.clientHeight
      pinned = keptAtFoot({ kind: 'acted', atFoot: atItsFoot(), scrolls })
    }
    const onWrite = () => {
      pinned = keptAtFoot({ kind: 'wrote' })
    }
    const resized = new ResizeObserver(() => {
      if (pinned) toFoot()
    })
    toFoot()
    messages.addEventListener('scroll', onScroll, { passive: true })
    messages.addEventListener('pointerdown', onAct, { capture: true, passive: true })
    messages.addEventListener('keydown', onAct, { capture: true, passive: true })
    composer.addEventListener('pointerdown', onWrite, { capture: true, passive: true })
    composer.addEventListener('keydown', onWrite, { capture: true, passive: true })
    resized.observe(lines)
    resized.observe(messages)
    return () => {
      messages.removeEventListener('scroll', onScroll)
      messages.removeEventListener('pointerdown', onAct, { capture: true })
      messages.removeEventListener('keydown', onAct, { capture: true })
      composer.removeEventListener('pointerdown', onWrite, { capture: true })
      composer.removeEventListener('keydown', onWrite, { capture: true })
      resized.disconnect()
    }
  }, [scroller, content, foot])
}

/**
 * The composer's height, as `--screen-composer` on the screen: on a phone the canvas ends above it and
 * the seam, so what the canvas holds at its foot is never under the composer kept there, nor the seam. Wide, the composer sits in
 * the chat's column and the canvas runs to the screen's foot.
 */
function useComposerHeight(
  screen: RefObject<HTMLElement | null>,
  composer: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const element = screen.current
    const zone = composer.current
    if (element === null || zone === null) return undefined
    const resized = new ResizeObserver(() => {
      element.style.setProperty('--screen-composer', `${String(zone.offsetHeight)}px`)
    })
    resized.observe(zone)
    return () => {
      resized.disconnect()
    }
  }, [screen, composer])
}

/**
 * Whether the screen is a phone's, once it is measured. The stylesheet decides, with `@wide:`, and
 * shows the seam on a phone alone, so the seam's display is the answer, and the width it turns at is
 * written once, as `--container-wide`.
 */
function usePhone(screen: RefObject<HTMLElement | null>, seam: RefObject<HTMLElement | null>) {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const element = screen.current
    if (element === null) return undefined
    const resized = new ResizeObserver(() => {
      if (seam.current !== null) setPhone(getComputedStyle(seam.current).display !== 'none')
    })
    resized.observe(element)
    return () => {
      resized.disconnect()
    }
  }, [screen, seam])
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
        '@wide:right-auto @wide:w-[calc(var(--screen-chat)+10.625rem)] @wide:bg-linear-to-r @wide:from-background/90 @wide:via-background/75 @wide:via-62% @wide:to-transparent @wide:opacity-100 @wide:[mask-image:radial-gradient(ellipse_100%_125%_at_0%_50%,black_66%,transparent_92%)]',
        chatInFront ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

/** hexframe's mark, amber as the human's, and its name, at the chat's head, and the deck's. */
export function Brand() {
  return (
    <div className="flex flex-none items-center gap-2.5 px-5 pt-2 text-foreground @wide:px-9 @wide:pt-7">
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
 * that stays whatever the slot holds, so the scrollbar sees it grow. How far its lines keep from the
 * chat's sides it hands down as `--chat-left` and `--chat-right`, so a widget runs on to them.
 */
function Messages({
  scroller,
  content,
  children,
}: {
  scroller: RefObject<HTMLDivElement | null>
  content: RefObject<HTMLDivElement | null>
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
        'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-6 pb-7 outline-none [mask-image:linear-gradient(transparent,black_1.75rem)] focus-visible:ring-1 focus-visible:ring-human/60 focus-visible:ring-inset',
        // How far its lines keep from the chat's sides, which a widget runs on past, the curve its edge.
        '[--chat-left:1.25rem] [--chat-right:1.25rem] pr-(--chat-right) pl-(--chat-left)',
        '@wide:[--chat-left:2.25rem] @wide:[--chat-right:6.25rem] @wide:[scrollbar-width:none] @wide:[&::-webkit-scrollbar]:hidden',
      )}
    >
      <div ref={content} className="mt-auto">
        {children}
      </div>
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
 * pointer's click after it, so a drag moves once, and a drag the other way not at all; Enter and
 * Space always move. Hidden on a wide screen, which shows both.
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
        'group/handle flex w-full flex-none touch-none justify-center pb-2 outline-none @wide:hidden',
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
      onClick={(event) => {
        // A click after a drag is the drag's own, and swallowed. A keyboard's click, `detail` 0,
        // always moves, should a touch browser have sent no click to clear the drag.
        const afterDrag = dragging.current && event.detail !== 0
        dragging.current = false
        if (!afterDrag) onMove()
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
