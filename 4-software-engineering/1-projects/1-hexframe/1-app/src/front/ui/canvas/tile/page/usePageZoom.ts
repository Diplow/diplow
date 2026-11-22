// The page's zoom: as it comes, it grows out of the hex the center was framed by in the drawing before
// it; as it leaves, it goes back into the center's hex, before the view that leaves it is handed on,
// the drawing coming back beneath it meanwhile. Where the screen shows the hex view in the chat's hex
// widget, wide (`data-hex-widget`, HEX-142), the page fades instead, and the hex view flies: a copy
// of the widget's drawing, from the center's hex on the canvas onto the widget's as the page comes,
// back as it leaves; folded, the page fades alone. For `--duration-camera`, easing as
// `--ease-camera`, at once with reduced motion.
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import type { Hex } from '../../geometry/geometry'
import { easingOf, movingFor } from '../../../motion'
import { flightOf, pageZoomOf } from './zoom'

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

/** A hex as the drawing writes the one it frames its center by (`data-framed`), `x y radius`. */
const framedAttribute = (hex: Hex | undefined) =>
  hex && `${String(hex.center.x)} ${String(hex.center.y)} ${String(hex.radius)}`

/** The hex widget's drawing, and its center's hex where it stands on the screen. */
interface Widget {
  drawing: SVGSVGElement
  hex: Hex
}

/**
 * The hex widget beside the canvas, on its screen: its drawing, `folded` where the widget shows it
 * not, none on a phone, whose chat stands behind the canvas or before it, nor where none shows.
 */
function widgetBeside(svg: SVGSVGElement | null): Widget | 'folded' | undefined {
  const screen = svg?.closest('[data-screen]')
  if (screen === null || screen === undefined || screen.hasAttribute('data-phone')) return undefined
  const drawing = screen.querySelector<SVGSVGElement>('[data-hex-widget] svg[data-framed]')
  const [x = NaN, y = NaN, radius = NaN] = (drawing?.dataset.framed ?? '').split(' ').map(Number)
  if (drawing === null || Number.isNaN(x + y + radius)) return undefined
  // A browser that can't tell, before Safari 17.4, flies it whatever its fold.
  if ('checkVisibility' in drawing && !drawing.checkVisibility({ opacityProperty: true })) {
    return 'folded'
  }
  const hex = onScreen(drawing, { center: { x, y }, radius })
  return hex && { drawing, hex }
}

/**
 * The hex view flying, `in` from `hex` on the canvas onto the widget's, `out` from the widget's onto
 * it, fading as it lands: a copy of the widget's drawing, over the whole screen, the widget's own
 * hidden meanwhile.
 */
function fly(widget: Widget, hex: Hex, way: 'in' | 'out', timing: KeyframeAnimationOptions) {
  const screen = widget.drawing.closest('[data-screen]')
  if (screen === null) return []
  const flying = widget.drawing.cloneNode(true) as SVGSVGElement
  const box = widget.drawing.getBoundingClientRect()
  const ground = screen.getBoundingClientRect()
  flying.removeAttribute('data-framed')
  flying.setAttribute('aria-hidden', 'true')
  Object.assign(flying.style, {
    position: 'absolute',
    left: `${String(box.left - ground.left)}px`,
    top: `${String(box.top - ground.top)}px`,
    width: `${String(box.width)}px`,
    height: `${String(box.height)}px`,
    transformOrigin: '0 0',
    pointerEvents: 'none',
    zIndex: '40',
  })
  screen.append(flying)
  const local = ({ center, radius }: Hex) => ({
    center: { x: center.x - box.left, y: center.y - box.top },
    radius,
  })
  const [from, rest] = flightOf(local(hex), local(widget.hex))
  const frames =
    way === 'in'
      ? [from, rest]
      : [
          { ...rest, opacity: 1 },
          { ...from, opacity: 0 },
        ]
  const flight = flying.animate(frames, timing)
  flight.onfinish = flight.oncancel = () => {
    flying.remove()
  }
  return [flight, widget.drawing.animate([{ opacity: 0 }, { opacity: 0 }], timing)]
}

/**
 * Plays the page's coming or going on `page`: its zoom, from or into `hex`, where it stands on the
 * screen, or, beside the hex widget, its fade and the hex view's flight (`flies`); none with reduced
 * motion, off a browser, or where there is no hex to zoom from. The page's own animation first.
 */
function play(
  page: HTMLElement,
  svg: SVGSVGElement | null,
  hex: Hex | undefined,
  way: 'in' | 'out',
) {
  const duration = movingFor('--duration-camera')
  if (duration === 0 || typeof page.animate !== 'function') return { played: [], flies: false }
  const timing = { duration, easing: easingOf(page) }
  // Gone, it stays so until the view that leaves it takes it away.
  const fill = way === 'out' ? 'forwards' : 'none'
  const widget = widgetBeside(svg)
  if (widget === undefined) {
    if (hex === undefined) return { played: [], flies: false }
    const box = page.getBoundingClientRect()
    const center = { x: hex.center.x - box.left, y: hex.center.y - box.top }
    const frames = pageZoomOf({ center, radius: hex.radius }, box)
    const zoom = page.animate(way === 'in' ? frames : [...frames].reverse(), { ...timing, fill })
    return { played: [zoom], flies: false }
  }
  const fades = page.animate([{ opacity: 0 }, { opacity: 1 }], {
    ...timing,
    direction: way === 'in' ? 'normal' : 'reverse',
    fill,
  })
  if (widget === 'folded' || hex === undefined) return { played: [fades], flies: false }
  return { played: [fades, ...fly(widget, hex, way, timing)], flies: true }
}

interface PageZoomInput {
  /** Whether the center shows as its page. */
  open: boolean
  /** The canvas's `<svg>`, whose own coordinates `framed` is in. */
  svg: RefObject<SVGSVGElement | null>
  /** The hex the center is framed by in the drawing now (`framedIn`, `geometry/shape.ts`). */
  framed: Hex | undefined
}

/**
 * The page's zoom: `page`, the ref of the page's element, which grows out of the center's hex as it
 * comes, or fades in as the hex view flies into the chat, taking the focus; `leave`, the page going
 * back into the center's hex, or fading as the hex view flies back, then `then`, which answers
 * whether it left, the page coming back whole where it didn't; how the drawing beneath it fades
 * (`fades`): out of reach while the page shows (`under`), faded but while the page leaves, so it
 * comes back meanwhile (`now`), gone at once as the hex view flies off it (`cut`); and `framed`, the
 * hex the drawing frames its center by as its `data-framed` writes it, which a page's flight on
 * another canvas finds it by.
 */
export function usePageZoom({ open, svg, framed }: PageZoomInput) {
  // Where the center was framed on the screen by the last drawing drawn without the page, which the
  // page grows out of as it comes.
  const before = useRef<Hex | undefined>(undefined)
  const element = useRef<HTMLElement | null>(null)
  const playing = useRef<Animation[]>([])
  const [leaving, setLeaving] = useState(false)
  const [flown, setFlown] = useState(false)
  if (!open && leaving) setLeaving(false)
  if (!open && flown) setFlown(false)
  useLayoutEffect(() => {
    if (!open) before.current = onScreen(svg.current, framed)
  })
  const stop = () => {
    for (const animation of playing.current) animation.cancel()
  }
  const page = useCallback(
    (node: HTMLElement | null) => {
      element.current = node
      if (node === null) return
      // It takes the focus as it comes, so the keyboard scrolls it, and leaves it, at once.
      node.focus({ preventScroll: true })
      const coming = play(node, svg.current, before.current, 'in')
      playing.current = coming.played
      setFlown(coming.flies)
      return () => {
        for (const animation of playing.current) animation.cancel()
      }
    },
    [svg],
  )
  const leave = (then: () => boolean) => {
    if (leaving) return
    stop()
    const going =
      element.current && play(element.current, svg.current, onScreen(svg.current, framed), 'out')
    const [out] = going?.played ?? []
    if (going === null || out === undefined) {
      then()
      return
    }
    playing.current = going.played
    setFlown(false)
    setLeaving(true)
    out.onfinish = () => {
      if (then()) return
      stop()
      setLeaving(false)
    }
  }
  return {
    page,
    leave,
    fades: { under: open, now: open && !leaving, cut: flown },
    framed: framedAttribute(framed),
  }
}
