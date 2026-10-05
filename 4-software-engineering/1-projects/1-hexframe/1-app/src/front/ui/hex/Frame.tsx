// A Frame is a Tile together with a ring of its members: here, the ground of a hex opened into a
// ring, drawn under it, the empty Directions of a ring, and a ring that overflows, shown as a list.
// The ground takes no click; the Tiles drawn on top do, and so does an empty Direction when the
// caller says what it is for.
import { m } from '#/paraglide/messages'

import { textBox } from './geometry/geometry'
import type { CanvasHex } from './geometry/shape'
import { buttonKeys } from './keys'
import { HexShape, polygonPoints, strokeWidth } from './look'

type Of<Kind extends CanvasHex['kind']> = Extract<CanvasHex, { kind: Kind }>

/** The ground of a hex opened into a ring: its Children's, its Branches' or Leaves', or its Context's, dashed. */
export function Frame({ hex }: { hex: Of<'ground'> }) {
  return (
    <g aria-hidden>
      <HexShape hex={hex} />
    </g>
  )
}

interface EmptySlotProps {
  hex: Of<'empty'>
  /** What a click on the slot does, and its name for a screen reader; without it, the slot is inert. */
  action?: { label: string; onSelect: () => void } | undefined
}

/** A Direction of a ring that holds no Tile yet: a button, with a plus, when it has an action. */
export function EmptySlot({ hex, action }: EmptySlotProps) {
  if (action === undefined) {
    return (
      <g aria-hidden>
        <HexShape hex={hex} />
      </g>
    )
  }
  const { label, onSelect } = action
  const { center, radius } = hex.hex
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
      <HexShape hex={hex} />
      <polygon
        points={polygonPoints(hex.hex)}
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

/**
 * A Tile whose ring has a member that found no Direction: its title, then the names of that ring as
 * a list, which scrolls when it runs past the hex.
 */
export function ListHex({ hex }: { hex: Of<'list'> }) {
  const box = textBox(hex.hex)
  return (
    <g role="group" aria-label={m.hex_list_label({ title: hex.tile.title })}>
      <HexShape hex={hex} />
      <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
        <div className="flex h-full flex-col gap-1 overflow-y-auto text-center text-xs text-card-foreground">
          <span className="font-semibold">{hex.tile.title}</span>
          <ul>
            {hex.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </foreignObject>
    </g>
  )
}
