// What a mark draws on a tile (`mark.ts`), by its light alone. Over its fill, as a refusal's flare:
// your amber, held where the chat points, faint under the words and glowing from the rim in, fainter
// on the way to a tile off the canvas, and a light rising once in the colour of who touched it, a
// Key's hollow; on paper, where a tile's fill is nearly white, a light behind it would not show. Over
// them: the agent's light running
// round the rim while its Turn works there, the rim dashed in violet where a Proposal would change the
// tile, and the dot a change leaves until you open it. An arc carries a proposed move to where it
// would land.
import { cn } from 'cn'
import { useId } from 'react'

import { scaled, type Hex, type Point } from '../../geometry/geometry'
import { points, proposedRim } from '../light'
import type { By, TileMark } from './mark'

/** How a glint or a held light is drawn, by who: a fill in their colour, or a Key's hollow line. */
const lights: Record<By, string> = {
  human: 'fill-human',
  agent: 'fill-agent',
  key: 'fill-none stroke-foreground',
}

/**
 * The lights over a tile's fill, glowing round it: the chat pointing at it, its way, a glint. A light
 * held, the chat's pointing, lies faint under the words, which keep their contrast, and glows from
 * the rim in; a glint passes over them all, once, as a flare does. `blur` is the tile's own filter,
 * which its other glows take.
 */
export function MarkGlow({
  hex,
  mark,
  blur,
}: {
  hex: Hex
  mark: TileMark | undefined
  blur: string
}) {
  if (mark?.pointed === undefined && mark?.glint === undefined) return null
  const inner = points(scaled(hex, 0.85))
  const { glint } = mark
  return (
    <g aria-hidden className="pointer-events-none">
      {mark.pointed === undefined ? null : (
        <g
          filter={`url(#${blur})`}
          className={cn(
            'transition-opacity duration-500',
            mark.pointed === 'tile' ? 'opacity-100' : 'opacity-45',
          )}
        >
          {/* As faint as the words' contrast allows where they are, then a band lit along the rim. */}
          <polygon points={inner} className="fill-human opacity-12" />
          <polygon
            points={points(scaled(hex, 0.86))}
            fill="none"
            strokeWidth={hex.radius * 0.14}
            strokeLinejoin="round"
            className="stroke-human opacity-60"
          />
        </g>
      )}
      {glint === undefined ? null : (
        // Keyed by the glint, so another one rises again.
        <polygon
          key={glint.key}
          points={glint.by === 'key' ? points(scaled(hex, 0.97)) : inner}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          {...(glint.by !== 'key' && { filter: `url(#${blur})` })}
          className={cn('animate-glint opacity-0', lights[glint.by])}
        />
      )}
    </g>
  )
}

/**
 * The lines over a tile's fill: the rim dashed in violet where a Proposal would change it, the
 * agent's light running round it while the Turn works there, and the dot a change leaves. `scale` is
 * the screen px per unit, so the dot stays a dot at any size.
 */
export function MarkLines({
  hex,
  mark,
  scale,
}: {
  hex: Hex
  mark: TileMark | undefined
  scale: number
}) {
  if (mark === undefined) return null
  return (
    <g aria-hidden className="pointer-events-none">
      {mark.proposed === undefined ? null : (
        <polygon
          points={points(hex)}
          fill="none"
          stroke={proposedRim.color}
          strokeWidth={1}
          strokeDasharray={proposedRim.dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {mark.working === true ? (
        <polygon
          points={points(scaled(hex, 0.95))}
          pathLength={100}
          fill="none"
          strokeWidth={1.6}
          strokeDasharray="16 84"
          vectorEffect="non-scaling-stroke"
          className="stroke-agent drop-shadow-[0_0_5px_var(--agent)] motion-safe:animate-orbit"
        />
      ) : null}
      {mark.unseen === undefined ? null : <Dot hex={hex} by={mark.unseen} scale={scale} />}
    </g>
  )
}

/** The dot a change leaves near the tile's top until you open it: the agent's lit, a Key's hollow. */
function Dot({ hex, by, scale }: { hex: Hex; by: Exclude<By, 'human'>; scale: number }) {
  return (
    <circle
      cx={hex.center.x}
      cy={hex.center.y - hex.radius * 0.8}
      r={3.6 / scale}
      strokeWidth={1.2}
      vectorEffect="non-scaling-stroke"
      className={cn(
        'motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0',
        by === 'agent'
          ? 'fill-agent drop-shadow-[0_0_4px_var(--agent)]'
          : 'fill-background stroke-foreground',
      )}
    />
  )
}

interface ArcProps {
  from: Point
  to: Point
  /** A hex's radius, which both ends keep clear of. */
  radius: number
  /** The heart of the ring it moves in, which the arc bows away from rather than cross. */
  around: Point
}

/**
 * A proposed move, from the tile to where it would land: dashed in violet, since it isn't done yet,
 * bowed away from the heart of its ring as a hand would draw it round it, an arrow at its end, from
 * the tile's edge to near the slot's.
 */
export function Arc({ from, to, radius, around }: ArcProps) {
  const id = useId()
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= radius) return null
  const along = { x: dx / length, y: dy / length }
  const start = { x: from.x + along.x * radius * 0.55, y: from.y + along.y * radius * 0.55 }
  const end = { x: to.x - along.x * radius * 0.6, y: to.y - along.y * radius * 0.6 }
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  // Of the two sides, the one away from the heart.
  const side = (middle.x - around.x) * -along.y + (middle.y - around.y) * along.x >= 0 ? 1 : -1
  const bow = {
    x: middle.x - side * along.y * length * 0.28,
    y: middle.y + side * along.x * length * 0.28,
  }
  const head = radius * 0.2
  const at = (point: Point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  return (
    <g aria-hidden className="pointer-events-none">
      <defs>
        <marker
          id={`${id}-head`}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={head}
          markerHeight={head}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0 1L9 5L0 9z" className="fill-agent/70" />
        </marker>
      </defs>
      <path
        d={`M${at(start)}Q${at(bow)} ${at(end)}`}
        fill="none"
        strokeWidth={1.2}
        strokeDasharray={proposedRim.dash}
        vectorEffect="non-scaling-stroke"
        markerEnd={`url(#${id}-head)`}
        className="stroke-agent/70"
      />
    </g>
  )
}
