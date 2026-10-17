// What the canvas marks of the writes to the System: each Tile a write on its way changes, saving;
// each free slot an import lands in, its tiles on their way; and each Tile a write was just refused
// on, flaring for `--duration-flare` as the System puts it back. It reads the refused writes as
// `useRefusalState` does, and puts nothing back: the toast, or the form reopened, says why.
import { useState } from 'react'

import { tilesWrittenBy, type Underway } from '#/front/client/mapping/overlay/overlay'
import { useSystemRefusals } from '#/front/client/mapping/queries'
import type { EmptySlotTarget } from '#/front/ui/canvas/geometry/shape'
import { durationOf } from '#/front/ui/motion'
import type { TileWrite } from '#/front/ui/canvas/tile/Tile'

import { standsFor } from '../tree'

/** The Tiles just refused, each by the refusal it flares for, so a later one outlasts an earlier. */
type Flaring = ReadonlyMap<string, symbol>

/**
 * The writes as the canvas marks them, from `underway`, what the writes on their way change: a
 * Tile's, refused over on its way, and whether an import lands in a free slot.
 */
export function useWritesState(underway: Underway) {
  const [flaring, setFlaring] = useState<Flaring>(new Map())
  useSystemRefusals(({ operation }) => {
    const refusal = Symbol('refusal')
    const tiles = tilesWrittenBy(operation)
    setFlaring((before) => new Map([...before, ...tiles.map((id) => [id, refusal] as const)]))
    setTimeout(() => {
      setFlaring((before) => new Map([...before].filter(([, which]) => which !== refusal)))
    }, durationOf('--duration-flare'))
    // Whether the page shows the refusal is for its form or its toast to say.
    return false
  })
  return {
    tile: (id: string): TileWrite | undefined => {
      if (flaring.has(id)) return 'refused'
      return underway.tiles.has(id) ? 'pending' : undefined
    },
    landing: ({ parent, ring, direction }: EmptySlotTarget) =>
      underway.slots.some((at) => at.parent === parent.id && standsFor(ring, direction, at.slot)),
  }
}
