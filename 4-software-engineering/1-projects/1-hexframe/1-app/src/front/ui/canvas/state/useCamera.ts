// The canvas's camera: when the center changes, the drawing flies from the last view to the next
// instead of swapping, so going into a child zooms in, going to a parent zooms out, and a Tile
// reached with nothing of it drawn before fades in (`ui/CLAUDE.md`, principle 6); and when the center
// stays but opens from alone or folds back, the scale changes as evenly, its hex carried from where it
// was drawn to where it is, nothing left beneath. It plays the shape
// of one world where a Tile's ring lies inside its hex: the next drawing starts where its center was
// drawn, or would open, in the last one, and comes to rest; the last one, drawn still beneath it,
// flies the opposite way as it fades. Both move together, one camera, for `--duration-camera`, and
// `--duration-camera-level` more per level crossed, up to two, easing as `--ease-camera`; with
// reduced motion the view lands at once. Off a flight the drawing's group has no transform, so what
// measures it in the canvas's units, a drag, reads it as drawn. What is pure here is tested beside it.
import { useLayoutEffect, useRef, useState } from 'react'

import { canvasSize, heartShare, type CanvasHex } from '../geometry/shape'
import type { Point } from '../geometry/geometry'
import { easingOf, movingFor } from '../../motion'
import { pathTo, type TileNode } from '../view/tiles'

/**
 * Where a Tile's own tile stands, or would: its hex when it is drawn opened, at the heart of its
 * ring, else the heart its hex would hold, were it opened in place.
 */
interface Heart {
  center: Point
  radius: number
}

/**
 * A drawing of the canvas: its center's id, the ids from the root down to it, its hexes, and the
 * Tiles around them, the one the center stands in and those beside it (`surroundingsOf`).
 */
export interface Drawing {
  center: string
  path: readonly string[]
  hexes: readonly CanvasHex[]
  around?: readonly CanvasHex[]
}

/**
 * How the last drawing lies in the next: the place of the last one (`from`) that the next one draws
 * at `to`, the levels crossed between their centers, and whether the next center was drawn in the
 * last, so it flies from where it was, and the next drawing needs no fading in.
 */
export interface Course {
  from: Heart
  to: Heart
  levels: number
  arrived: boolean
}

/** A drawn hex standing for the Tile of this id, never a Reference to it. */
function drawnAt(hexes: readonly CanvasHex[], id: string) {
  return hexes.find(
    (hex) =>
      (hex.kind === 'tile' || hex.kind === 'list') &&
      hex.tile.id === id &&
      hex.tile.reference === undefined,
  )
}

/** Whether a drawn hex is a Tile opened into its ring: the center with a ring, or a Branch's heart. */
const isOpened = (hex: CanvasHex) =>
  hex.kind === 'tile' && (hex.role === 'hub' || (hex.role === 'center' && hex.alone !== true))

/**
 * The heart of the Tile a drawn hex stands for, `levels` generations down from it: the center's, as one
 * world draws it (`heart`), and the Tile it stands in, drawn around it, its own hex, as it is drawn
 * centered and opened.
 */
function heartOf(hex: CanvasHex | undefined, levels = 0): Heart {
  if (hex === undefined) {
    return { center: { x: canvasSize.width / 2, y: canvasSize.height / 2 }, radius: 100 }
  }
  const heart = hex.kind === 'tile' ? hex.heart : undefined
  const share = isOpened(hex) || (hex.kind === 'tile' && hex.role === 'above') ? 1 : heartShare
  const radius = heart === undefined ? hex.hex.radius * share : heart.radius
  return { center: hex.hex.center, radius: radius * heartShare ** levels }
}

/** Every hex a drawing holds, the Tiles around it included. */
const allOf = (drawing: Drawing) => [...drawing.hexes, ...(drawing.around ?? [])]

/** Each Tile above the center, the nearest first, with the levels between it and the center. */
function above(path: readonly string[]): [string, number][] {
  return path
    .slice(0, -1)
    .map((id, at): [string, number] => [id, path.length - 1 - at])
    .reverse()
}

/**
 * How the last drawing lies in the next, from what both draw: the next center where the last drew
 * it; else the last center where the next draws it; else the nearest Tile above one center that the
 * other drawing holds, the center that deep inside it; else nothing in common, the next center that
 * many levels below or above the last, at the same place.
 */
export function courseOf(last: Drawing, next: Drawing): Course {
  const levels = Math.abs(next.path.length - last.path.length)
  const leaving = drawnAt(last.hexes, last.center)
  const arriving = drawnAt(next.hexes, next.center)
  const was = drawnAt(allOf(last), next.center)
  if (was !== undefined) return { from: heartOf(was), to: heartOf(arriving), levels, arrived: true }
  const is = drawnAt(allOf(next), last.center)
  if (is !== undefined) return { from: heartOf(leaving), to: heartOf(is), levels, arrived: false }
  for (const [id, below] of above(next.path)) {
    const ancestor = drawnAt(allOf(last), id)
    if (ancestor !== undefined) {
      return { from: heartOf(ancestor, below), to: heartOf(arriving), levels, arrived: false }
    }
  }
  for (const [id, below] of above(last.path)) {
    const ancestor = drawnAt(allOf(next), id)
    if (ancestor !== undefined) {
      return { from: heartOf(leaving), to: heartOf(ancestor, below), levels, arrived: false }
    }
  }
  const to = heartOf(arriving)
  const deeper = next.path.length - last.path.length
  return {
    from: heartOf(leaving),
    to: { ...to, radius: to.radius / heartShare ** deeper },
    levels,
    arrived: false,
  }
}

/**
 * Where the center is framed: the hex it opens into, its ground, while a ring shows inside it, its
 * Context, its own hex drawn smaller at that ground's heart; else its own hex.
 */
const framedAt = (hexes: readonly CanvasHex[], center: string) =>
  hexes.find((hex) => hex.kind === 'ground' && hex.key === `ground:${center}`)?.hex ??
  drawnAt(hexes, center)?.hex

/**
 * How the drawing moves where the center stays but its own frame changes, opened from alone, large,
 * or folded back into it: its hex from where it was drawn to where it is, as one Tile the two
 * drawings share; none where it stands as it stood, a ring shown or hidden inside it included, which
 * moves the center alone, the ring around it staying where it is.
 */
export function reframingOf(
  last: readonly CanvasHex[],
  next: readonly CanvasHex[],
  center: string,
): Course | undefined {
  const was = framedAt(last, center)
  const is = framedAt(next, center)
  if (was === undefined || is === undefined) return undefined
  const moved = Math.hypot(is.center.x - was.center.x, is.center.y - was.center.y)
  if (moved < 1e-6 && Math.abs(is.radius - was.radius) < 1e-6) return undefined
  return { from: was, to: is, levels: 0, arrived: true }
}

/** A scale about the canvas's origin, then a move: a point `p` drawn at `scale × p + (x, y)`. */
export interface Placing {
  scale: number
  x: number
  y: number
}

/**
 * Where each drawing stands as the camera is `e` of the way, 0 to 1, eased: the next one from the
 * last's place to its own, its scale changing evenly (geometrically) while the place it shares with
 * the last travels a straight line at an even pace; the last one with it, as the camera carries both.
 */
export function placingAt(course: Course, e: number): { next: Placing; last: Placing } {
  const { from, to } = course
  const scale = (from.radius / to.radius) ** (1 - e)
  const at = {
    x: from.center.x + (to.center.x - from.center.x) * e,
    y: from.center.y + (to.center.y - from.center.y) * e,
  }
  const carried = (scale * to.radius) / from.radius
  return {
    next: { scale, x: at.x - scale * to.center.x, y: at.y - scale * to.center.y },
    last: { scale: carried, x: at.x - carried * from.center.x, y: at.y - carried * from.center.y },
  }
}

/** How many steps a flight is drawn in, the browser drawing the line between two. */
const steps = 24

const matrix = ({ scale, x, y }: Placing) =>
  `matrix(${String(scale)}, 0, 0, ${String(scale)}, ${String(x)}, ${String(y)})`

/**
 * A flight's keyframes for one drawing, by the camera's eased progress: the next one coming to rest,
 * fading in where nothing of it was drawn before; the last one flying out as it fades.
 */
export function keyframesOf(course: Course, drawing: 'next' | 'last'): Keyframe[] {
  return Array.from({ length: steps + 1 }, (_, step) => {
    const e = step / steps
    const placing = placingAt(course, e)[drawing]
    const opacity = drawing === 'last' ? 1 - e : course.arrived ? 1 : e
    return { offset: e, transform: matrix(placing), opacity }
  })
}

/** How long a flight crossing this many levels lasts: none with reduced motion. */
export function flightFor(levels: number): number {
  const pan = movingFor('--duration-camera')
  if (pan === 0) return 0
  return pan + movingFor('--duration-camera-level') * Math.min(levels, 2)
}

/**
 * What of the last drawing is drawn still beneath the next during a flight: all of it, but, where
 * the next center flies from where it was, the Tiles the next drawing draws too, which fly with it,
 * and the next center's own hex, which gives way to its ground where it arrives opened. The Tiles
 * around the next drawing stay in it, above those it draws there, which they cover as they fade.
 */
export function stillOf(last: Drawing, next: Drawing, course: Course): CanvasHex[] {
  if (!course.arrived) return [...last.hexes]
  const drawn = new Set(
    next.hexes.flatMap((hex) =>
      hex.kind === 'tile' && hex.tile.reference === undefined ? [hex.tile.id] : [],
    ),
  )
  const arriving = drawnAt(next.hexes, next.center)
  const opened = arriving !== undefined && isOpened(arriving)
  return last.hexes.flatMap((hex): CanvasHex[] => {
    if (hex.kind !== 'tile' && hex.kind !== 'list') return [hex]
    if (hex.tile.reference !== undefined || !drawn.has(hex.tile.id)) return [hex]
    if (hex.tile.id !== next.center || !opened || isOpened(hex)) return []
    const { key, generation } = hex
    return [{ kind: 'ground', key: `ground:${key}`, hex: hex.hex, generation, ring: 'children' }]
  })
}

/**
 * A flight under way: its course, how long it lasts, the last drawing as it is drawn still, and the
 * course of the Tiles around the drawing (`around`): the drawing's, as the center changes; from the
 * center's last whole hex to its next, as its own hex opens or folds; none where they stay.
 */
interface Flight {
  course: Course
  duration: number
  still: CanvasHex[]
  around: Course | undefined
}

interface CameraInput {
  system: TileNode
  /** The centered Tile's id. */
  center: string
  hexes: readonly CanvasHex[]
  /** The Tiles around the drawing, the one the center stands in and those beside it. */
  around?: readonly CanvasHex[]
}

/**
 * The camera over the canvas's drawing: the group to draw it in (`drawing`), the one to draw the
 * Tiles around it in (`around`), beneath, and, while a flight is under way, the last drawing to draw
 * still between them (`still`), in its own group (`last`), which nothing can reach. A flight starts
 * as the center changes, the Tiles around flying with the drawing, or its own hex as it opens or
 * folds, the Tiles around staying where they are, before the next view is painted.
 */
export function useCamera({ system, center, hexes, around = [] }: CameraInput) {
  const drawing = useRef<SVGGElement>(null)
  const surrounding = useRef<SVGGElement>(null)
  const last = useRef<SVGGElement>(null)
  const [flight, setFlight] = useState<Flight>()
  // The drawing last painted, with the System it was drawn from, to tell where its center stood.
  const painted = useRef<{
    system: TileNode
    center: string
    hexes: readonly CanvasHex[]
    around: readonly CanvasHex[]
  }>(undefined)
  useLayoutEffect(() => {
    const before = painted.current
    painted.current = { system, center, hexes, around }
    if (before === undefined) return
    if (before.center === center) {
      const course = reframingOf(before.hexes, hexes, center)
      const duration = course === undefined ? 0 : flightFor(0)
      if (course !== undefined && duration > 0) {
        setFlight({ course, duration, still: [], around: wholeCourseOf(before.hexes, hexes) })
      }
      return
    }
    const lastDrawing = { ...before, path: idsTo(before.system, before.center) }
    const nextDrawing = { center, hexes, around, path: idsTo(system, center) }
    const course = courseOf(lastDrawing, nextDrawing)
    const duration = flightFor(course.levels)
    setFlight(
      duration === 0
        ? undefined
        : { course, duration, still: stillOf(lastDrawing, nextDrawing, course), around: course },
    )
  })
  useLayoutEffect(() => {
    if (flight === undefined) return
    const easing = easingOf(drawing.current)
    const flying = [
      play(drawing.current, keyframesOf(flight.course, 'next'), {
        duration: flight.duration,
        easing,
      }),
      flight.around &&
        play(surrounding.current, keyframesOf(flight.around, 'next'), {
          duration: flight.duration,
          easing,
        }),
      play(last.current, keyframesOf(flight.course, 'last'), {
        duration: flight.duration,
        easing,
        fill: 'forwards',
      }),
    ]
    const landing = setTimeout(() => {
      setFlight(undefined)
    }, flight.duration)
    return () => {
      clearTimeout(landing)
      for (const animation of flying) animation?.cancel()
    }
  }, [flight])
  return { drawing, around: surrounding, last, still: flight?.still }
}

/** The center's heart, as a drawing draws it. */
const heartIn = (hexes: readonly CanvasHex[]) =>
  hexes.flatMap((hex) => (hex.kind === 'tile' && hex.role === 'center' && hex.heart) || [])[0]

/**
 * How the Tiles around a drawing move as the center's own hex opens or folds: from its last heart
 * to its next, the whole hex they stand around with it; none where it stays as it was.
 */
export function wholeCourseOf(
  last: readonly CanvasHex[],
  next: readonly CanvasHex[],
): Course | undefined {
  const was = heartIn(last)
  const is = heartIn(next)
  if (was === undefined || is === undefined || Math.abs(was.radius - is.radius) < 1e-6) {
    return undefined
  }
  return { from: was, to: is, levels: 0, arrived: true }
}

/** The ids from the System's root down to this Tile. */
const idsTo = (system: TileNode, id: string) => pathTo(system, id).map((tile) => tile.id)

/** Plays keyframes on an element where the page animates one; none off a browser. */
function play(element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (element === null || typeof element.animate !== 'function') return undefined
  return element.animate(keyframes, options)
}
