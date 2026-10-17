// The canvas's journey from one System to another: going down a level is getting closer, and the
// user's root is the sun the rest turns around (`ui/CLAUDE.md`, "The direction"), so reaching another
// System is reaching another star. As the System the canvas shows changes (`at`), the one left
// recedes into the night, off one way, still drawn as it was, which nothing reaches and no screen
// reader hears, and the one reached comes close from a point of light off the other way, arriving
// as its caller draws it, for `--duration-journey` (`animate-recede`, `animate-approach`). With
// reduced motion, a cut. Within one System the camera flies instead (`state/useCamera.ts`).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from 'cn'

import { movingFor } from '../../motion'

/** The System left, as it was last drawn, while it recedes. */
export interface Leaving {
  at: string
  drawing: ReactNode
}

/**
 * The journey under way, if one is: the System left and its last drawing, from the moment `at`
 * changes until `--duration-journey` has gone by; none with reduced motion, or a page that sets no
 * duration, so the next System is simply there. A journey taken again before the last one ends
 * leaves from where the canvas then is.
 */
export function useJourney(at: string, drawing: ReactNode): Leaving | undefined {
  const [arrived, setArrived] = useState(at)
  const [leaving, setLeaving] = useState<Leaving>()
  // The drawing last painted, which the System left recedes with.
  const painted = useRef(drawing)
  if (at !== arrived) {
    setArrived(at)
    const moving = movingFor('--duration-journey') > 0
    setLeaving(moving ? { at: arrived, drawing: painted.current } : undefined)
  }
  useLayoutEffect(() => {
    painted.current = drawing
  })
  useEffect(() => {
    if (leaving === undefined) return
    const gone = setTimeout(() => {
      setLeaving(undefined)
    }, movingFor('--duration-journey'))
    return () => {
      clearTimeout(gone)
    }
  }, [leaving])
  return leaving
}

interface JourneyProps {
  /** Which System the canvas shows: a change of it is a journey. */
  at: string
  /** The canvas side, as its caller draws it for `at`. */
  children: ReactNode
  className?: string
}

/**
 * The canvas side on a journey: the System left receding beneath, the one reached coming close. Each
 * is keyed by its System, so the one left keeps what it holds as it goes, and the one reached is
 * drawn anew.
 */
export function Journey({ at, children, className }: JourneyProps) {
  const leaving = useJourney(at, children)
  return (
    <div className={cn('relative flex min-w-0 flex-1', className)}>
      {leaving && (
        <div
          key={leaving.at}
          inert
          aria-hidden
          className="pointer-events-none absolute inset-0 flex motion-safe:animate-recede"
        >
          {leaving.drawing}
        </div>
      )}
      <div
        key={at}
        className={cn('flex min-w-0 flex-1', leaving && 'motion-safe:animate-approach')}
      >
        {children}
      </div>
    </div>
  )
}
