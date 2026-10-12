// A tile carried off the canvas (HEX-110): dragged past where its caller says the canvas ends, the page
// carries it, for the composer to name, its caller told as it goes off and once it comes back, is let
// go, its move stops or the canvas goes. `useMove` runs it beside the drag it follows.
import { useEffect, useRef, useState, type RefObject } from 'react'

import type { Point } from '../../geometry/geometry'

/** What the caller says of a carry: where the canvas ends, and who is told of the tile carried. */
export interface CarryInput {
  /**
   * Whether a point of the page is off the canvas, where a tile dragged there is carried. Without it,
   * a tile is never carried.
   */
  offCanvas?: ((client: Point) => boolean) | undefined
  /** The tile carried off the canvas, by its id, as it goes off; none once it comes back or is let go. */
  onCarry?: ((id: string | undefined) => void) | undefined
}

/** A Tile carried off the canvas, as its caller hands it on: by its id, and its title. */
export interface CarriedTile {
  id: string
  title: string
}

/** A tile carried off the canvas: which, and where the pointer is on the page. */
export interface Carry {
  id: string
  at: Point
}

/** The carry of a drag, its caller's latest read from `latest`, as a drag reads it between renders. */
export function useCarry(latest: RefObject<CarryInput>) {
  const [carried, setCarried] = useState<Carry>()
  // The tile carried, told its caller as it went off.
  const carrying = useRef<string>(undefined)
  useEffect(
    () => () => {
      // Gone while a tile is carried: the page carries it no more.
      if (carrying.current !== undefined) latest.current.onCarry?.(undefined)
    },
    [latest],
  )
  /** The carry over, the tile back over the canvas or let go: the page carries nothing more. */
  const end = () => {
    setCarried(undefined)
    if (carrying.current === undefined) return
    carrying.current = undefined
    latest.current.onCarry?.(undefined)
  }
  return {
    carried,
    /** Whether the pointer, at this point of the page, is off the canvas. */
    off: (client: Point) => latest.current.offCanvas?.(client) === true,
    /** The tile `id` carried, the pointer at this point of the page. */
    carry: (id: string, client: Point) => {
      setCarried({ id, at: client })
      if (carrying.current === id) return
      carrying.current = id
      latest.current.onCarry?.(id)
    },
    end,
  }
}
