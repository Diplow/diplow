// What each placement looks like: its colours, its stroke and its label. Colours are theme tokens;
// the Context's is `--context`. Sizes are in the canvas's own coordinates (see Canvas.tsx).
import type { CSSProperties } from 'react'

import { hexCorners, hexWidth, type Hex } from './geometry/geometry'
import type { Placement } from './geometry/layout'

interface Look {
  fill: string
  stroke: string
  dashed: boolean
  ink: string
}

export const strokeWidth = 1.5

const context = 'var(--context)'

function lookOf(placement: Placement): Look {
  switch (placement.kind) {
    case 'frame':
      return placement.ring === 'context'
        ? { fill: mix(context, 14), stroke: context, dashed: true, ink: 'var(--foreground)' }
        : {
            fill: mix('var(--muted-foreground)', placement.depth === 0 ? 8 : 16),
            stroke: 'transparent',
            dashed: false,
            ink: 'var(--foreground)',
          }
    case 'tile':
      if (placement.role === 'hub') {
        return {
          fill: 'var(--primary)',
          stroke: 'var(--primary)',
          dashed: false,
          ink: 'var(--primary-foreground)',
        }
      }
      return {
        fill: 'var(--card)',
        stroke: placement.role === 'context' ? context : 'var(--border)',
        dashed: placement.role === 'context',
        ink: 'var(--card-foreground)',
      }
    case 'empty':
      return {
        fill: 'transparent',
        stroke: mix('var(--muted-foreground)', 35),
        dashed: true,
        ink: '',
      }
  }
}

function mix(color: string, percent: number) {
  return `color-mix(in oklab, ${color} ${String(percent)}%, var(--background))`
}

/** A hex as the `points` of an SVG polygon. */
export function polygonPoints(hex: Hex): string {
  return hexCorners(hex)
    .map(({ x, y }) => `${String(x)},${String(y)}`)
    .join(' ')
}

/** The hex's outline, dashed or not, in its look's colours. */
export function HexShape({ placement }: { placement: Placement }) {
  const look = lookOf(placement)
  return (
    <polygon
      points={polygonPoints(placement.hex)}
      style={{ fill: look.fill, stroke: look.stroke }}
      strokeWidth={strokeWidth}
      strokeDasharray={look.dashed ? '4 3' : undefined}
      strokeLinejoin="round"
    />
  )
}

export function showsPreview(placement: Placement): boolean {
  return placement.kind === 'tile' && placement.hex.radius >= 70 && placement.tile.preview !== ''
}

/** The title always, the preview once the hex is large enough to hold a few lines. */
export function TileLabel({ placement }: { placement: Placement }) {
  if (placement.kind !== 'tile') return null
  const { radius } = placement.hex
  // Small enough for the longest word to fit the wide text box, at about 0.6em per character.
  const longestWord = Math.max(...placement.tile.title.split(/\s+/).map((word) => word.length))
  const fitting = (hexWidth(radius) * 0.85) / (longestWord * 0.6)
  const titleSize = Math.min(clamp(radius * 0.17, 6.5, 20), fitting)
  const previewSize = clamp(radius * 0.085, 9, 13)
  const style: CSSProperties = { color: lookOf(placement).ink }
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden text-center leading-tight select-none"
      style={style}
    >
      <span
        className="max-w-full font-semibold tracking-tight break-words"
        style={{ fontSize: titleSize }}
      >
        {placement.tile.title}
      </span>
      {showsPreview(placement) ? (
        <span className="line-clamp-3 opacity-70" style={{ fontSize: previewSize }}>
          {placement.tile.preview}
        </span>
      ) : null}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
