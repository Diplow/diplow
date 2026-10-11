// The curved hairline the conversation is cut along on a wide screen, which is its scrollbar:
// a star riding the stretch of hairline beside the messages, lighting the part that shows. The star is
// drawn for the mouse and the finger; the keyboard and a screen reader scroll the messages themselves,
// which stay a focusable scroller, so the star is hidden from the accessibility tree.
import { cn } from 'cn'
import { useEffect, useId, useRef, useState, type MouseEvent, type RefObject } from 'react'

import { bow, curvePath, scrollTopAt, thumbOf, trackAlongCurve, type Track } from './curve'

interface ScrollbarProps {
  /** The screen, which the curve spans from top to foot. */
  screen: RefObject<HTMLElement | null>
  /** The messages' scroller, which the star follows and moves. */
  scroller: RefObject<HTMLElement | null>
  /** What the scroller holds, whose growth its own box doesn't show. */
  content: RefObject<HTMLElement | null>
}

/** The hairline's box: the curve's widest offset from the chat's edge, and a pixel for the line. */
const width = bow / 2 + 1

/** How long the star stays bright after the messages last moved. */
const stirFor = 900

export function Scrollbar({ screen, scroller, content }: ScrollbarProps) {
  const { track, scroll, stirred } = useMeasured(screen, scroller, content)
  // Where the pointer and the star were when the star was caught.
  const [drag, setDrag] = useState<{ pointer: number; star: number } | undefined>(undefined)
  const id = useId().replace(/[^\w-]/g, '')

  const thumb = thumbOf(track, scroll)
  const scrollTo = (top: number, smooth: boolean) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.current?.scrollTo({ top, behavior: smooth && !reduced ? 'smooth' : 'instant' })
  }
  const yOf = (event: MouseEvent) =>
    event.clientY - (screen.current?.getBoundingClientRect().top ?? 0)
  const lit = drag !== undefined || stirred
  const percent = (px: number) => (track.height === 0 ? 0 : (px / track.height) * 100)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-(--screen-edge) z-30 hidden @wide:block"
      style={{ width }}
    >
      <svg
        viewBox={`0 0 ${String(width)} 100`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--input)" stopOpacity="0" />
            <stop offset="0.42" stopColor="var(--input)" />
            <stop offset="1" stopColor="var(--input)" />
          </linearGradient>
          {thumb && (
            <linearGradient
              id={`${id}-lit`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={percent(thumb.y - thumb.size / 2)}
              y2={percent(thumb.y + thumb.size / 2)}
            >
              <stop offset="0" stopColor="var(--foreground)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--foreground)" stopOpacity="0.8" />
              <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
            </linearGradient>
          )}
        </defs>
        <path
          d={curvePath}
          fill="none"
          stroke={`url(#${id}-edge)`}
          vectorEffect="non-scaling-stroke"
        />
        {thumb && (
          <>
            <path
              d={curvePath}
              fill="none"
              stroke={`url(#${id}-lit)`}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              className={cn(
                'transition-opacity duration-500 motion-reduce:transition-none',
                lit ? 'opacity-100' : 'opacity-55',
              )}
            />
            {/* The track: a click on the hairline beside the messages scrolls them there. */}
            <path
              d={trackAlongCurve(track)}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-[stroke] cursor-pointer"
              onClick={(event) => {
                scrollTo(scrollTopAt(track, scroll, yOf(event)), true)
              }}
              onWheel={(event) => {
                scroller.current?.scrollBy({ top: event.deltaY })
              }}
            />
          </>
        )}
      </svg>
      {thumb && (
        <div
          className={cn(
            'group/star pointer-events-auto absolute -mt-[14px] -ml-[14px] size-7 touch-none pointer-coarse:-mt-[22px] pointer-coarse:-ml-[22px] pointer-coarse:size-11',
            drag ? 'cursor-grabbing' : 'cursor-grab',
          )}
          style={{
            transform: `translate(${String(thumb.x)}px, ${String(thumb.y)}px) rotate(${String(thumb.angle)}deg)`,
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            setDrag({ pointer: event.clientY, star: thumb.y })
          }}
          onPointerMove={(event) => {
            if (drag === undefined) return
            // The star follows the pointer down the track; the messages follow the star.
            const star = drag.star + event.clientY - drag.pointer
            scrollTo(scrollTopAt(track, scroll, star), false)
          }}
          onPointerUp={() => {
            setDrag(undefined)
          }}
          onPointerCancel={() => {
            setDrag(undefined)
          }}
        >
          <Star lit={lit} id={id} />
        </div>
      )}
    </div>
  )
}

/**
 * The track and the scroll, measured once laid out and again whenever the screen, the scroller or
 * what it holds changes size; and whether the messages moved a moment ago, which lights the star.
 */
function useMeasured(
  screen: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
) {
  const [track, setTrack] = useState<Track>({ height: 0, top: 0, length: 0 })
  const [scroll, setScroll] = useState({ top: 0, height: 0, client: 0 })
  const [stirred, setStirred] = useState(false)
  const stir = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const messages = scroller.current
    const frame = screen.current
    if (messages === null || frame === null) return undefined
    const measure = () => {
      const box = frame.getBoundingClientRect()
      const shown = messages.getBoundingClientRect()
      // The track keeps clear of the messages' ends, where they fade.
      setTrack({ height: box.height, top: shown.top - box.top + 12, length: shown.height - 24 })
      setScroll({
        top: messages.scrollTop,
        height: messages.scrollHeight,
        client: messages.clientHeight,
      })
    }
    const onScroll = () => {
      measure()
      setStirred(true)
      clearTimeout(stir.current)
      stir.current = setTimeout(() => {
        setStirred(false)
      }, stirFor)
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(frame)
    resized.observe(messages)
    // The messages grow as the conversation does, which the scroller's own box doesn't show.
    if (content.current !== null) resized.observe(content.current)
    messages.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      resized.disconnect()
      messages.removeEventListener('scroll', onScroll)
      clearTimeout(stir.current)
    }
  }, [screen, scroller, content])
  return { track, scroll, stirred }
}

/** A four-rayed star with a soft glow, which grows while the messages move or the star is held. */
function Star({ lit, id }: { lit: boolean; id: string }) {
  return (
    <svg
      viewBox="-14 -14 28 28"
      className={cn(
        'size-full overflow-visible transition-opacity duration-500 group-hover/star:opacity-100 motion-reduce:transition-none',
        lit ? 'opacity-100' : 'opacity-80',
      )}
    >
      <defs>
        <radialGradient id={`${id}-star`}>
          <stop offset="0" stopColor="var(--muted-foreground)" stopOpacity="0.5" />
          <stop offset="0.35" stopColor="var(--muted-foreground)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--muted-foreground)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        r={13}
        fill={`url(#${id}-star)`}
        className={cn(
          'transition-transform duration-500 group-hover/star:scale-160 motion-reduce:transition-none',
          lit && 'scale-160',
        )}
      />
      <path
        d="M0,-10 Q.8,-.8 5,0 Q.8,.8 0,10 Q-.8,.8 -5,0 Q-.8,-.8 0,-10Z"
        className="fill-foreground"
      />
      <circle r={1.5} className="fill-card dark:fill-foreground" />
    </svg>
  )
}
