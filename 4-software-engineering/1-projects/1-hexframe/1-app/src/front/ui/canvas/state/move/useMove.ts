// A tile on the move, from its start to its landing (HEX-105's proposal, from components.html's
// #moving): dragged under a mouse or a pen, or started by its caller, its menu's "Somewhere else…" or
// a link; stopped by Escape or Stop; let go over a place that takes it, gliding there for
// `--duration-glide` before its caller sends the landing; refused, flaring where it went, then gliding
// back. Dragged off the canvas, where its caller says the canvas ends, the tile is carried: it lands
// on no place there, the page carrying it for the composer to name, and let go off the canvas it
// settles back home, the move ending (HEX-110). Which tile moves is the caller's, the URL's on home,
// and so is what a landing sends: the hook holds what lasts a gesture, the drag, the place lit under
// it, the glide, the carry, and gives the focus back to the tile once it has landed or stopped.
import { useEffect, useRef, useState, type PointerEvent } from 'react'

import type { Point } from '../../geometry/geometry'
import type { TileWrite } from '../../tile/Tile'
import { useCarry, type CarryInput } from './carry'
import { useDrag, type Units } from '../../tile/moving/drag'
import { movingFor } from '../../../motion'

/** Where a tile on the move can land: a free slot, or a tile it trades places with. */
export interface Target {
  /** Unique among the places drawn: the one a drag lights. */
  key: string
  /** Its heart, in the canvas's units, which the tile glides to. */
  center: Point
  /** The tile it trades places with, which glides the other way; none for a free slot. */
  partner?: string
  /** What its caller does once the tile is there: sends the move or the swap. */
  land: () => void
}

/**
 * A landing: the tile gliding to where it goes; landed, its write sent, drawn there until its caller
 * draws it there; refused, flaring there; or gliding back.
 */
type Phase = 'glide' | 'landed' | 'refused' | 'back'

interface Landing {
  id: string
  partner?: string | undefined
  from: Point
  to: Point
  phase: Phase
}

interface MoveInput extends CarryInput {
  /** The canvas's units, where a drag is followed (`unitsIn`). */
  units: Units
  /** The tile on the move, by its id, the caller's: none while nothing moves. */
  moving: string | undefined
  /** A drag starting on a tile that isn't moving yet: the move starts with it. */
  onStart: (id: string) => void
  /** Escape or Stop: the move ends where it is. */
  onStop: () => void
  /** Where each tile is drawn now, by its id; none for a tile not drawn. */
  centerOf: (id: string) => Point | undefined
  /** Where a drag let go at `point` lands the tile `from`; none, and it goes back. */
  dropAt: (point: Point, from: string) => Target | undefined
  /** A write on a tile, on its way or refused: a landing refused glides back. Without it, none is. */
  writeOf?: (id: string) => TileWrite | undefined
}

/** How far a tile is drawn from where its caller puts it, and whether it glides there. */
export interface Shift {
  by: Point
  glides: boolean
}

/** How long a refused tile flares where it went before gliding back. */
const flare = 450

/** A frame's grace after a glide, so the landing is sent once it has ended on screen. */
const settle = 40

const still: Shift = { by: { x: 0, y: 0 }, glides: false }

/** Two points the same, to the canvas's own rounding. */
const at = (a: Point | undefined, b: Point) =>
  a !== undefined && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6

const toward = (from: Point, to: Point): Point => ({ x: to.x - from.x, y: to.y - from.y })

/**
 * Where a landing draws a tile: the one moving toward where it goes and its partner the other way,
 * while their caller still draws them where they were, gliding there or flaring there once refused;
 * back where they were as the refusal ends, gliding.
 */
function shiftIn(landing: Landing, id: string, centerOf: MoveInput['centerOf']): Shift {
  const { from, to, phase } = landing
  if (phase === 'back') return { by: { x: 0, y: 0 }, glides: true }
  const [left, goes] = id === landing.id ? [from, to] : [to, from]
  // Drawn by its caller where it went already, or elsewhere since: the landing has no say.
  if (!at(centerOf(id), left)) return still
  return { by: toward(left, goes), glides: phase === 'glide' }
}

export function useMove(input: MoveInput) {
  const { moving, units } = input
  const drag = useDrag(units)
  const [dragging, setDragging] = useState<string>()
  const [over, setOver] = useState<string>()
  const [landing, setLanding] = useState<Landing>()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Each tile's element, by its id, to give it the focus back once it has landed or stopped.
  const tiles = useRef(new Map<string, Element>())
  // Whether the landing's write was seen on its way, so its end, no longer on its way, is seen too.
  const sent = useRef(false)
  // A drop that came before the caller put the move it started in place, the URL's on home: where it
  // was let go, or nowhere, let go off the canvas, which ends the move once it is in place.
  const [held, setHeld] = useState<{ id: string; at: Point | undefined }>()
  // The caller's latest, which a drag or a timer reads once the render it began in is gone.
  const latest = useRef(input)
  useEffect(() => {
    latest.current = input
  })
  const carry = useCarry(latest)
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const after = (ms: number, then: () => void) => {
    timers.current.push(setTimeout(then, ms))
  }

  const focus = (id: string | undefined) => {
    const element = id === undefined ? undefined : tiles.current.get(id)
    const target = element?.matches('[tabindex]') ? element : element?.querySelector('[tabindex]')
    if (target instanceof HTMLElement || target instanceof SVGElement) target.focus()
  }

  /** The tile `id` lands on `target`: it glides there, then its caller sends the landing. */
  const land = (target: Target, id = latest.current.moving) => {
    if (id === undefined || landing?.phase === 'glide') return
    const from = latest.current.centerOf(id)
    setOver(undefined)
    if (from === undefined) {
      // Moved out of sight, the canvas centered elsewhere: nothing to glide.
      target.land()
      return
    }
    sent.current = false
    setLanding({ id, partner: target.partner, from, to: target.center, phase: 'glide' })
    after(movingFor('--duration-glide') + settle, () => {
      target.land()
      setLanding((current) => current && { ...current, phase: 'landed' })
      requestAnimationFrame(() => {
        focus(id)
      })
    })
  }

  const stop = () => {
    const id = latest.current.moving
    if (landing?.phase === 'glide' || id === undefined) return
    // A tile dragged when the move stops goes back, and its drop lands nowhere.
    drag.cancel()
    setDragging(undefined)
    setOver(undefined)
    carry.end()
    latest.current.onStop()
    requestAnimationFrame(() => {
      focus(id)
    })
  }

  useStopOnEscape(moving !== undefined, stop)

  /** A drag let go where it is, landing on the place under it; off the canvas, its move ending. */
  const release = (id: string, point: Point | undefined) => {
    if (point === undefined) {
      latest.current.onStop()
      return
    }
    const target = latest.current.dropAt(point, id)
    if (target !== undefined) land(target, id)
  }

  // A drop held for its move lands once the move is in place, and nowhere once another moves.
  useEffect(() => {
    if (held === undefined || moving === undefined) return
    setHeld(undefined)
    if (moving === held.id) release(held.id, held.at)
  })

  // A landing's write, once sent: refused, the tile flares where it went, then glides back; settled,
  // the landing is over.
  const write = landing && input.writeOf?.(landing.id)
  useEffect(() => {
    if (landing?.phase !== 'landed') return
    if (write === 'pending') {
      sent.current = true
      return
    }
    if (write === 'refused') {
      if (!at(latest.current.centerOf(landing.id), landing.from)) {
        setLanding(undefined)
        return
      }
      setLanding({ ...landing, phase: 'refused' })
      after(flare, () => {
        setLanding((current) => current && { ...current, phase: 'back' })
      })
      after(flare + movingFor('--duration-glide') + settle, () => {
        setLanding(undefined)
      })
      return
    }
    if (sent.current) setLanding(undefined)
  }, [landing, write])

  /** A pointer going down on a tile: under a mouse or a pen, a drag that moves it. */
  const press = (id: string, event: PointerEvent) => {
    const now = latest.current.moving
    if (landing?.phase === 'glide' || (now !== undefined && now !== id)) return
    drag.press(event, {
      onStart: () => {
        setDragging(id)
        if (latest.current.moving !== id) latest.current.onStart(id)
      },
      // Off the canvas, carried by the page; over it, over a place again.
      onMove: ({ at: point, client }) => {
        if (carry.off(client)) carry.carry(id, client)
        else carry.end()
        setOver(carry.off(client) ? undefined : latest.current.dropAt(point, id)?.key)
      },
      onDrop: (released) => {
        setDragging(undefined)
        setOver(undefined)
        carry.end()
        if (released === undefined) return
        // Let go off the canvas: it lands nowhere, settling back home, and its move ends.
        const point = carry.off(released.client) ? undefined : released.at
        if (latest.current.moving === id) release(id, point)
        else setHeld({ id, at: point })
      },
    })
  }

  return {
    /** The tile dragged, by its id, while a drag is under way. */
    dragging: drag.dragged === undefined ? undefined : dragging,
    /** The place a drag is over, which takes the tile, by its key. */
    over,
    /** Where a landing stands, or none: none other starts while its tile glides. */
    landing: landing?.phase,
    /** The tile carried off the canvas, and where the pointer is on the page; none while none is. */
    carried: carry.carried,
    press,
    land,
    stop,
    /** How far a tile is drawn from its place: following a drag, or a landing. */
    shiftOf: (id: string): Shift => {
      // Carried off the canvas, the tile stays home there, the page carrying it.
      if (drag.dragged !== undefined && id === dragging && carry.carried?.id !== id) {
        return { by: drag.dragged.offset, glides: false }
      }
      if (landing === undefined || (id !== landing.id && id !== landing.partner)) return still
      return shiftIn(landing, id, input.centerOf)
    },
    /** Where the tile of this id is drawn, so the focus comes back to it. */
    tileRef: (id: string) => (element: Element | null) => {
      if (element) tiles.current.set(id, element)
      else tiles.current.delete(id)
    },
  }
}

/** Escape stops the move while one is under way, wherever the focus is, but in a menu or a dialog. */
function useStopOnEscape(moving: boolean, stop: () => void) {
  useEffect(() => {
    if (!moving) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"]')) return
      event.stopPropagation()
      event.preventDefault()
      stop()
    }
    addEventListener('keydown', onKey, { capture: true })
    return () => {
      removeEventListener('keydown', onKey, { capture: true })
    }
  })
}
