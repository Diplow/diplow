// What a tile's light is drawn with: its hex as a polygon, a fill fading from its top to its foot, a
// blur for a glow, and the sweep of light that says something is on its way, never a spinner. Every
// colour is a theme token, or a `color-mix` of one.
import { hexCorners, hexWidth, type Hex } from '../geometry/geometry'

/** A hex as the `points` of an SVG polygon. */
export function points(hex: Hex): string {
  return hexCorners(hex)
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
}

/** A colour at `percent` of its strength, the rest see-through. */
export function tint(token: string, percent: number): string {
  return `color-mix(in oklab, var(--${token}) ${String(percent)}%, transparent)`
}

/**
 * What a Proposal would do and isn't done yet, dashed in the agent's violet: the rim of a ghost, of a
 * tile it would edit or move, and the dash of a move's arc.
 */
export const proposedRim = { color: tint('agent', 60), dash: '4 4' }

/** A fill from `top` to `foot`, straight down, or corner to corner for the root's warm light. */
export interface Fade {
  top: string
  foot: string
  diagonal?: boolean
}

/** `rising`, a change of its colours lightens it slowly, for `--duration-sunrise`, as the root's. */
export function FadeDef({
  id,
  fade,
  rising = false,
}: {
  id: string
  fade: Fade
  rising?: boolean
}) {
  const slow = rising
    ? 'transition-[stop-color] duration-(--duration-sunrise) ease-glide motion-reduce:transition-none'
    : undefined
  return (
    <linearGradient id={id} x1="0" y1="0" x2={fade.diagonal ? 1 : 0} y2="1">
      <stop offset="0" className={slow} style={{ stopColor: fade.top }} />
      <stop offset="1" className={slow} style={{ stopColor: fade.foot }} />
    </linearGradient>
  )
}

/** A soft blur, for a light that glows behind a tile rather than fills it. */
export function BlurDef({ id }: { id: string }) {
  return (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="11" />
    </filter>
  )
}

/**
 * Light sweeping over a hex, a moment after it starts, so a write that lands at once never flickers:
 * over a tile whose write is on its way, or where tiles will be while they load. With reduced
 * motion it holds still, a sheen across the hex.
 */
export function Sweep({ hex }: { hex: Hex }) {
  const { center, radius } = hex
  const width = hexWidth(radius)
  return (
    <foreignObject
      x={center.x - width / 2}
      y={center.y - radius}
      width={width}
      height={2 * radius}
      aria-hidden
      className="pointer-events-none"
    >
      <div className="size-full animate-in delay-400 duration-500 fade-in-0 fill-mode-both [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
        <div className="size-full bg-[linear-gradient(100deg,transparent_35%,color-mix(in_oklab,var(--foreground)_11%,transparent)_50%,transparent_65%)] bg-size-[250%_100%] bg-position-[50%_0] motion-safe:animate-sweep" />
      </div>
    </foreignObject>
  )
}
