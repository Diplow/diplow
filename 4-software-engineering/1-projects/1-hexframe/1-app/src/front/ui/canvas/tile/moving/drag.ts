// A tile dragged across the canvas (HEX-105's proposal): under a mouse or a pen, never a finger,
// whose drag pans; past a few units from where it was pressed, so a press that stays put is a click;
// let go where it lands, or cancelled. Its units are the canvas's, which `unitsIn` reads off its <svg>.
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

import type { Point } from '../../geometry/geometry'

/** A drag under way: how far it went from where it started, in the canvas's units, and where it is. */
export interface Dragged {
  offset: Point
  at: Point
}

interface DragHandlers {
  /** Once it has gone past a few units: a press that stays put is a click. */
  onStart: () => void
  onMove?: (dragged: Dragged) => void
  /** Let go, where it was; or cancelled, nowhere. */
  onDrop: (dragged: Dragged | undefined) => void
}

/** A point on the screen in the canvas's units, or none while it isn't drawn. */
export type Units = (client: Point) => Point | undefined

/** How far a press goes, in the canvas's units, before it is a drag rather than a click. */
const threshold = 6

/** The canvas's units, as its <svg> scales them on screen now. */
export function unitsIn(svg: RefObject<SVGSVGElement | null>): Units {
  return ({ x, y }) => {
    const toUnits = svg.current?.getScreenCTM()?.inverse()
    if (toUnits === undefined) return undefined
    const { x: ux, y: uy } = new DOMPoint(x, y).matrixTransform(toUnits)
    return { x: ux, y: uy }
  }
}

/**
 * A drag let go fires a click on the tile it carried, which would open it or go in: the click that
 * follows at once is taken before anything hears it.
 */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
  }
  addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => {
    removeEventListener('click', swallow, { capture: true })
  })
}

/**
 * `press` starts a drag from a pointer going down on a tile, a mouse's main button or a pen; the drag
 * is the hook's state until it is let go, and its listeners go with it, or with the hook. `cancel`
 * drops it where it is, landing nowhere: the move it served has stopped.
 */
export function useDrag(units: Units) {
  const [dragged, setDragged] = useState<Dragged>()
  const stop = useRef<() => void>(undefined)
  useEffect(
    () => () => {
      stop.current?.()
    },
    [],
  )
  const press = (event: PointerEvent, handlers: DragHandlers) => {
    if (event.pointerType === 'touch' || event.button !== 0) return
    const start = units({ x: event.clientX, y: event.clientY })
    if (start === undefined) return
    stop.current?.()
    let current: Dragged | undefined
    const move = (next: globalThis.PointerEvent) => {
      const at = units({ x: next.clientX, y: next.clientY })
      if (at === undefined) return
      const offset = { x: at.x - start.x, y: at.y - start.y }
      if (current === undefined && Math.hypot(offset.x, offset.y) <= threshold) return
      if (current === undefined) handlers.onStart()
      current = { offset, at }
      setDragged(current)
      handlers.onMove?.(current)
    }
    const end = (cancelled: boolean) => () => {
      stop.current?.()
      if (current === undefined) return
      setDragged(undefined)
      if (!cancelled) swallowNextClick()
      handlers.onDrop(cancelled ? undefined : current)
    }
    const up = end(false)
    const cancel = end(true)
    stop.current = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', cancel)
      stop.current = undefined
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', cancel)
  }
  const cancel = () => {
    stop.current?.()
    setDragged(undefined)
  }
  return { dragged, press, cancel }
}
