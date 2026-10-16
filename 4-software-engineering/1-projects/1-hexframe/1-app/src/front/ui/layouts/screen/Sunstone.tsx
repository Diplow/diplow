// hexframe's mark, the Sunstone: a tile cut into six facets, the six things a person cares about,
// meeting at one point, the person, a sun lighting them from inside. The apex sits up and to the left,
// so the stone has depth and its light a side, the top-left, where the root's light comes from. A
// facet's colour is the root's glow mixed into the night's `dusk` in oklch, whose hue runs from amber
// through coral, rose and plum to indigo, so the shade side stays light and never turns grey.
import { cn } from 'cn'
import { useEffect, useId, useRef } from 'react'

import { easingOf, movingFor } from '../../motion'

const radius = 100
const apex = { x: -11, y: -10 }
const corners = Array.from({ length: 6 }, (_, i) => {
  const angle = ((-90 + 60 * i) * Math.PI) / 180
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
})
const at = ({ x, y }: { x: number; y: number }) => `${x.toFixed(2)},${y.toFixed(2)}`

/** How much of the glow each facet holds, from the one between the top and the next corner, clockwise. */
const glows = [88, 30, 6, 50, 72, 100]

function facetColour(glow: number) {
  return glow === 100
    ? 'var(--glow-soft)'
    : `color-mix(in oklch, var(--glow) ${String(glow)}%, var(--dusk))`
}

const mixed = (colour: string, percent: number, other: string) =>
  `color-mix(in oklab, ${colour} ${String(percent)}%, var(--${other}))`

const facets = corners.map((corner, i) => {
  const next = corners[(i + 1) % 6] ?? corner
  const colour = facetColour(glows[i] ?? 0)
  return {
    points: [apex, corner, next].map(at).join(' '),
    // Lit by the sun near the apex, going toward the night at the edge.
    near: mixed(colour, 88, 'glow-soft'),
    far: mixed(colour, 86, 'dusk'),
    edge: { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 },
  }
})

/**
 * The Sunstone, as tall as its box; its sun's glow may run past it. It turns once whole around its
 * heart each time `turns` grows, for `--duration-turn`, so whatever is done, the sun answers it.
 */
export function Sunstone({ className, turns = 0 }: { className?: string; turns?: number }) {
  const id = useId()
  const hex = corners.map(at).join(' ')
  const svg = useRef<SVGSVGElement>(null)
  useTurning(svg, turns)
  return (
    <svg
      ref={svg}
      aria-hidden
      viewBox="-95 -110 190 220"
      className={cn('shrink-0 overflow-visible ease-glide', className)}
    >
      <defs>
        {facets.map(({ near, far, edge }, i) => (
          <linearGradient
            key={i}
            id={`${id}-facet-${String(i)}`}
            gradientUnits="userSpaceOnUse"
            x1={apex.x}
            y1={apex.y}
            x2={edge.x}
            y2={edge.y}
          >
            <stop offset="0" style={{ stopColor: near }} />
            <stop offset="1" style={{ stopColor: far }} />
          </linearGradient>
        ))}
        <radialGradient
          id={`${id}-heart`}
          gradientUnits="userSpaceOnUse"
          cx={apex.x}
          cy={apex.y}
          r="110"
        >
          <stop offset="0" style={{ stopColor: 'var(--glow-soft)', stopOpacity: 0.36 }} />
          <stop offset=".3" style={{ stopColor: 'var(--glow)', stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: 'var(--glow)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient
          id={`${id}-sun`}
          gradientUnits="userSpaceOnUse"
          cx={apex.x}
          cy={apex.y}
          r="34"
        >
          <stop offset="0" style={{ stopColor: 'var(--glow-soft)' }} />
          <stop offset=".45" style={{ stopColor: 'var(--glow)', stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: 'var(--glow)', stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient
          id={`${id}-rim`}
          gradientUnits="userSpaceOnUse"
          x1="-90"
          y1="-100"
          x2="90"
          y2="100"
        >
          <stop offset="0" style={{ stopColor: mixed('var(--glow-soft)', 60, 'human') }} />
          <stop offset=".55" style={{ stopColor: 'var(--human)', stopOpacity: 0.75 }} />
          <stop offset="1" style={{ stopColor: 'var(--human)', stopOpacity: 0.3 }} />
        </linearGradient>
        {corners.map((corner, i) => (
          <linearGradient
            key={i}
            id={`${id}-ridge-${String(i)}`}
            gradientUnits="userSpaceOnUse"
            x1={apex.x}
            y1={apex.y}
            x2={corner.x}
            y2={corner.y}
          >
            <stop offset="0" style={{ stopColor: 'var(--glow-soft)', stopOpacity: 0.7 }} />
            <stop offset="1" style={{ stopColor: 'var(--glow-soft)', stopOpacity: 0.1 }} />
          </linearGradient>
        ))}
      </defs>
      {facets.map(({ points }, i) => (
        <polygon key={i} points={points} fill={`url(#${id}-facet-${String(i)})`} />
      ))}
      <polygon points={hex} fill={`url(#${id}-heart)`} />
      {corners.map((corner, i) => (
        <line
          key={i}
          x1={apex.x}
          y1={apex.y}
          x2={corner.x}
          y2={corner.y}
          stroke={`url(#${id}-ridge-${String(i)})`}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polygon
        points={hex}
        fill="none"
        stroke={`url(#${id}-rim)`}
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={apex.x} cy={apex.y} r="34" fill={`url(#${id}-sun)`} />
      <circle cx={apex.x} cy={apex.y} r="7" className="fill-glow-soft" />
    </svg>
  )
}

/**
 * One whole turn each time `turns` grows: a turn already on its way runs to its end and takes the
 * ones asked meanwhile with it, so a burst of things done turns it once, never faster. Still with
 * reduced motion.
 */
function useTurning(svg: { current: SVGSVGElement | null }, turns: number) {
  const turning = useRef<Animation>(undefined)
  const first = useRef(turns)
  useEffect(() => {
    const stone = svg.current
    const lasts = movingFor('--duration-turn')
    if (stone === null || turns === first.current || lasts === 0) return
    if (turning.current?.playState === 'running') return
    turning.current = stone.animate([{ rotate: '0deg' }, { rotate: '360deg' }], {
      duration: lasts,
      easing: easingOf(stone),
    })
  }, [svg, turns])
}
