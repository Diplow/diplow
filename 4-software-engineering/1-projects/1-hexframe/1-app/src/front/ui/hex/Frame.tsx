// A Frame is a Tile together with its Children: here, the hex behind its hub and its ring, and the
// empty slots of that ring. The Frame takes no click; the Tiles drawn on top do, and so does an empty
// slot when the caller says what it is for.
import type { Placement } from './geometry/layout'
import { buttonKeys } from './keys'
import { HexShape, polygonPoints, strokeWidth } from './look'

type Of<Kind extends Placement['kind']> = Extract<Placement, { kind: Kind }>

/** The backdrop of a Frame: its Children's ring, or the Context's, dashed, inside the center. */
export function Frame({ placement }: { placement: Of<'frame'> }) {
  return (
    <g aria-hidden>
      <HexShape placement={placement} />
    </g>
  )
}

interface EmptySlotProps {
  placement: Of<'empty'>
  /** What a click on the slot does, and its name for a screen reader; without it, the slot is inert. */
  action?: { label: string; onSelect: () => void }
}

/** A Direction of a Frame that holds no Tile yet: a button, with a plus, when it has an action. */
export function EmptySlot({ placement, action }: EmptySlotProps) {
  if (action === undefined) {
    return (
      <g aria-hidden>
        <HexShape placement={placement} />
      </g>
    )
  }
  const { label, onSelect } = action
  const { center, radius } = placement.hex
  const arm = radius * 0.18
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer outline-none"
      onClick={onSelect}
      {...buttonKeys({ onEnter: onSelect, onSpace: onSelect })}
    >
      <HexShape placement={placement} />
      <polygon
        points={polygonPoints(placement.hex)}
        className="fill-transparent stroke-transparent group-hover:fill-muted group-hover:stroke-brand group-focus-visible:stroke-ring"
        strokeWidth={strokeWidth * 2}
        strokeLinejoin="round"
      />
      <path
        d={`M${String(center.x - arm)},${String(center.y)}h${String(2 * arm)}M${String(center.x)},${String(center.y - arm)}v${String(2 * arm)}`}
        className="stroke-muted-foreground opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100"
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="round"
      />
    </g>
  )
}
