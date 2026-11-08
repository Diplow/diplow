// The page's zoom: as it comes, it grows out of the hex the center was framed by in the drawing before
// it; as it leaves, it goes back into the center's hex, before the view that leaves it is handed on,
// the drawing coming back beneath it meanwhile. For `--duration-camera`, easing as `--ease-camera`, at
// once with reduced motion.
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import type { Hex } from '../../geometry/geometry'
import type { CanvasHex } from '../../geometry/shape'
import { easingOf, movingFor } from '../../../motion'
import { pageZoomOf } from './zoom'

/**
 * The hex the center is framed by in a drawing, as the camera frames it: the hex it opens into, its
 * ground, while a ring shows inside it, its Context, else its own; none where it isn't drawn.
 */
export const framedIn = (hexes: readonly CanvasHex[], center: string): Hex | undefined =>
  hexes.find((hex) => hex.kind === 'ground' && hex.key === `ground:${center}`)?.hex ??
  hexes.find((hex) => hex.kind === 'tile' && hex.role === 'center')?.hex

/** A hex of the canvas where it stands on the screen, in px from the viewport's top left. */
function onScreen(svg: SVGSVGElement | null, hex: Hex | undefined): Hex | undefined {
  const matrix = svg?.getScreenCTM()
  if (matrix === null || matrix === undefined || hex === undefined) return undefined
  const { x, y } = hex.center
  return {
    center: {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    },
    radius: hex.radius * Math.hypot(matrix.a, matrix.b),
  }
}

/**
 * Plays the page's zoom on `page`, from or into `hex`, where it stands on the screen; none with
 * reduced motion, off a browser, or where there is no hex to zoom from.
 */
function zoom(page: HTMLElement, hex: Hex | undefined, way: 'in' | 'out') {
  const duration = movingFor('--duration-camera')
  if (hex === undefined || duration === 0 || typeof page.animate !== 'function') return undefined
  const box = page.getBoundingClientRect()
  const center = { x: hex.center.x - box.left, y: hex.center.y - box.top }
  const frames = pageZoomOf({ center, radius: hex.radius }, box)
  return page.animate(way === 'in' ? frames : [...frames].reverse(), {
    duration,
    easing: easingOf(page),
    // Gone back into the hex, it stays there until the view that leaves it takes it away.
    fill: way === 'out' ? 'forwards' : 'none',
  })
}

interface PageZoomInput {
  /** Whether the center shows as its page. */
  open: boolean
  /** The canvas's `<svg>`, whose own coordinates `framed` is in. */
  svg: RefObject<SVGSVGElement | null>
  /** The hex the center is framed by in the drawing now (`framedIn`). */
  framed: Hex | undefined
}

/**
 * The page's zoom: `page`, the ref of the page's element, which grows out of the center's hex as it
 * comes, taking the focus; `leave`, the page going back into the center's hex, then `then`, which
 * answers whether it left, the page coming back whole where it didn't; and how the drawing beneath it
 * fades (`fades`): out of reach while the page shows (`under`), faded but while the page leaves, so
 * it comes back meanwhile (`now`).
 */
export function usePageZoom({ open, svg, framed }: PageZoomInput) {
  // Where the center was framed on the screen by the last drawing drawn without the page, which the
  // page grows out of as it comes.
  const before = useRef<Hex | undefined>(undefined)
  const element = useRef<HTMLElement | null>(null)
  const playing = useRef<Animation | undefined>(undefined)
  const [leaving, setLeaving] = useState(false)
  if (!open && leaving) setLeaving(false)
  useLayoutEffect(() => {
    if (!open) before.current = onScreen(svg.current, framed)
  })
  const page = useCallback((node: HTMLElement | null) => {
    element.current = node
    if (node === null) return
    // It takes the focus as it comes, so the keyboard scrolls it, and leaves it, at once.
    node.focus({ preventScroll: true })
    playing.current = zoom(node, before.current, 'in')
    return () => {
      playing.current?.cancel()
    }
  }, [])
  const leave = (then: () => boolean) => {
    if (leaving) return
    playing.current?.cancel()
    const out = element.current && zoom(element.current, onScreen(svg.current, framed), 'out')
    if (!out) {
      then()
      return
    }
    playing.current = out
    setLeaving(true)
    out.onfinish = () => {
      if (then()) return
      out.cancel()
      setLeaving(false)
    }
  }
  return { page, leave, fades: { under: open, now: open && !leaving } }
}
