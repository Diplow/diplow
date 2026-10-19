// What a tile's light is drawn with: its hex as a polygon, a fill fading from its top to its foot, a
// blur for a glow, the sweep of light that says something is on its way, never a spinner, and a
// star's light waiting at the canvas's edge, on the side the star stands. Every colour is a theme
// token, or a `color-mix` of one.
import { useId } from 'react'

import { hexCorners, hexWidth, type Hex, type Point } from '../geometry/geometry'
import type { SunLight } from '../view/tiles'

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

/**
 * `rising`, a change of its colours lightens it slowly, for `--duration-sunrise`, as the root's, a
 * stagger of the dawn after it changed (`--stagger-dawn`).
 */
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
    ? 'transition-[stop-color] duration-(--duration-sunrise) ease-glide delay-(--stagger-dawn) motion-reduce:transition-none'
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

/**
 * A star's light where the star is not drawn, waiting at the canvas's edge on the side it stands
 * (`sunward`, `view/tiles.ts`): amber, a person's, or rose, an Organization's, from beyond the edge,
 * so only its glow reaches in. An <svg> of its own, the canvas's size and viewBox, laid beneath it,
 * so the light runs on past the canvas's box to the screen's edge. As the center changes it glides
 * along the edge with the camera, at once with reduced motion.
 */
export function SunEdge({
  from,
  toward,
  size,
  light,
}: {
  /** Where the centered Tile is drawn. */
  from: Point
  /** Which way the star lies, a unit vector. */
  toward: Point
  /** The canvas's size, in its own units. */
  size: { width: number; height: number }
  light: SunLight
}) {
  const id = useId()
  const radius = Math.min(size.width, size.height) * 0.7
  const edge = edgeOf(from, toward, size)
  const at = { x: edge.x + toward.x * radius * 0.25, y: edge.y + toward.y * radius * 0.25 }
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${String(size.width)} ${String(size.height)}`}
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <radialGradient id={id}>
          {sunStops[light].map(([offset, token, percent]) => (
            <stop key={offset} offset={offset} style={{ stopColor: tint(token, percent) }} />
          ))}
        </radialGradient>
      </defs>
      <g
        className="transition-transform duration-(--duration-camera) ease-camera animate-in fade-in-0 motion-reduce:transition-none"
        style={{ transform: `translate(${String(at.x)}px, ${String(at.y)}px)` }}
      >
        <circle r={radius} fill={`url(#${id})`} />
      </g>
    </svg>
  )
}

/** A star's light from the edge, fading evenly out: its halo, then its haze. */
const sunStops: Record<SunLight, ReadonlyArray<[string, string, number]>> = {
  human: [
    ['0', 'halo', 40],
    ['.3', 'halo', 18],
    ['.6', 'aura', 50],
    ['1', 'aura', 0],
  ],
  organization: [
    ['0', 'organization-halo', 40],
    ['.3', 'organization-halo', 18],
    ['.6', 'organization', 7],
    ['1', 'organization', 0],
  ],
}

/** Where a ray from a point inside a box, going one way, leaves it. */
function edgeOf(from: Point, toward: Point, { width, height }: { width: number; height: number }) {
  const along = (start: number, step: number, end: number) =>
    step > 0 ? (end - start) / step : step < 0 ? -start / step : Infinity
  const t = Math.max(0, Math.min(along(from.x, toward.x, width), along(from.y, toward.y, height)))
  return { x: from.x + toward.x * t, y: from.y + toward.y * t }
}
