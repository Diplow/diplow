// A Frame is a Tile together with its Children: here, the hex behind its hub and its ring, and the
// empty slots of that ring. Neither takes a click; the Tiles drawn on top do.
import type { Placement } from './geometry/layout'
import { HexShape } from './look'

type Of<Kind extends Placement['kind']> = Extract<Placement, { kind: Kind }>

/** The backdrop of a Frame: its Children's ring, or the Context's, dashed, inside the center. */
export function Frame({ placement }: { placement: Of<'frame'> }) {
  return (
    <g aria-hidden>
      <HexShape placement={placement} />
    </g>
  )
}

/** A Direction of a Frame that holds no Tile yet. */
export function EmptySlot({ placement }: { placement: Of<'empty'> }) {
  return (
    <g aria-hidden>
      <HexShape placement={placement} />
    </g>
  )
}
