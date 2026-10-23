// The places a tile stands in, drawn by their light as tiles are (HEX-104's proposal, on the canvas
// since HEX-106): a free slot, with a plus only where a click adds a tile; where nothing can be
// added, a dotted place and no plus; where tiles will be while they load, a sweep of light; and the
// ground a hex gives way to when it opens in place, faint, or teal and dashed under the center's
// Context.
import type { ReactNode } from 'react'
import { Slot as Handed } from 'radix-ui'

import type { Hex } from '../geometry/geometry'
import { buttonKeys, type Action, type Hand } from '../keys'
import { points, Sweep, tint } from './light'
import { movedAs, useFoldGivenUp } from './settle'
import type { TileMotion } from './Tile'

interface SlotProps {
  hex: Hex
  /** What a click on the slot does, and its name for a screen reader; without it, nothing can be added. */
  action?: Action | undefined
  /**
   * A tile could be added here, though not from where it is drawn, around the center or in the last
   * drawing as the camera moves on: its plus, taking no click.
   */
  offers?: boolean
  /** Tiles will be here once they load. */
  loading?: boolean
  /** What its menu hands it, where a free slot has one. */
  hand?: Hand
  /**
   * Where it is, said to a screen reader beside its name, since six free slots around one tile share
   * the name a click there gives them: "free, north-west".
   */
  place?: string
}

/** A Direction that holds no tile: free, with a plus where a click adds one, dotted where none can. */
export function Slot({ hex, action, loading = false, hand, place, offers = false }: SlotProps) {
  if (loading) {
    return (
      <g aria-hidden>
        <polygon points={points(hex)} style={{ fill: 'var(--tile-fade)' }} />
        <Sweep hex={hex} />
      </g>
    )
  }
  if (action === undefined) {
    return (
      <g aria-hidden>
        {offers ? (
          <Free hex={hex} />
        ) : (
          <polygon
            points={points(hex)}
            fill="none"
            strokeDasharray="1 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-border"
          />
        )}
      </g>
    )
  }
  const { label, onSelect } = action
  return (
    <Handed.Root {...hand}>
      <g
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-description={place}
        className="group cursor-pointer outline-none"
        onClick={onSelect}
        {...buttonKeys({ onEnter: onSelect, onSpace: onSelect })}
      >
        <Free hex={hex} />
      </g>
    </Handed.Root>
  )
}

/** A free slot a tile could be added to: dashed, its plus at its heart, lit under the hand. */
function Free({ hex }: { hex: Hex }) {
  const { center, radius } = hex
  const arm = Math.min(radius * 0.12, 9)
  return (
    <>
      <polygon
        points={points(hex)}
        strokeDasharray="2 5"
        vectorEffect="non-scaling-stroke"
        className="fill-transparent stroke-border transition-colors group-hover:fill-foreground/4 group-hover:stroke-input group-focus-visible:fill-foreground/4 group-focus-visible:stroke-ring group-focus-visible:[stroke-dasharray:none]"
      />
      <path
        d={`M${String(center.x - arm)},${String(center.y)}h${String(2 * arm)}M${String(center.x)},${String(center.y - arm)}v${String(2 * arm)}`}
        strokeWidth={1.25}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-faint transition-colors group-hover:stroke-muted-foreground group-focus-visible:stroke-muted-foreground"
      />
    </>
  )
}

/**
 * The ground of a hex opened into a ring: what its light gave way to, under the Branch at its heart
 * and its six; the center's Context, teal and dashed.
 */
export function Ground({ hex, context = false }: { hex: Hex; context?: boolean }) {
  return (
    <g aria-hidden>
      <polygon
        points={points(hex)}
        strokeDasharray={context ? '3 4' : undefined}
        vectorEffect="non-scaling-stroke"
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
        style={
          context
            ? { fill: tint('context', 7), stroke: tint('context', 35) }
            : { fill: tint('foreground', 3), stroke: 'none' }
        }
      />
    </g>
  )
}

/**
 * A free slot, or anything drawn beside the tiles of a ring, blooming out of its parent's heart or
 * folding back into it with them, a fold given up playing back to rest.
 */
export function Moved({
  motion,
  children,
}: {
  motion: TileMotion | undefined
  children: ReactNode
}) {
  const { className, style } = movedAs(motion)
  const moved = useFoldGivenUp(motion?.way === 'fold')
  return (
    <g ref={moved} className={className} style={style}>
      {children}
    </g>
  )
}
