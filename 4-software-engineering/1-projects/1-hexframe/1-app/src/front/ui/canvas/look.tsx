// What each hex looks like: its colours, its stroke and its label. Colours are theme tokens; the
// Context's is `--context`, a clash's `--warning`. Sizes are in the canvas's own coordinates.
import type { CSSProperties } from 'react'

import { hexCorners, hexWidth, type Hex } from './geometry/geometry'
import type { CanvasHex } from './geometry/shape'

type Of<Kind extends CanvasHex['kind']> = Extract<CanvasHex, { kind: Kind }>

interface Look {
  fill: string
  stroke: string
  dashed: boolean
  ink: string
}

export const strokeWidth = 1.5

const contextTint = 'var(--context)'

const centerLook: Look = {
  fill: 'var(--primary)',
  stroke: 'var(--primary)',
  dashed: false,
  ink: 'var(--primary-foreground)',
}

/** A Tile by what it stands for: the center and an opened Branch's own, then a member by kind. */
function tileLook(hex: Of<'tile'>): Look {
  switch (hex.role) {
    case 'center':
    case 'hub':
      return centerLook
    case 'branch':
      return {
        fill: 'var(--card)',
        stroke: 'var(--border)',
        dashed: false,
        ink: 'var(--card-foreground)',
      }
    case 'leaf':
      // A Leaf is a file's worth: muted, and stroked as a warning when it clashes with a Branch.
      return {
        fill: 'var(--muted)',
        stroke: hex.clash === undefined ? 'var(--border)' : 'var(--warning)',
        dashed: false,
        ink: 'var(--foreground)',
      }
    case 'context':
      return {
        fill: 'var(--card)',
        stroke: contextTint,
        dashed: true,
        ink: 'var(--card-foreground)',
      }
  }
}

function lookOf(hex: CanvasHex): Look {
  switch (hex.kind) {
    case 'ground':
      return hex.ring === 'context'
        ? {
            fill: mix(contextTint, 14),
            stroke: contextTint,
            dashed: true,
            ink: 'var(--foreground)',
          }
        : {
            fill: mix('var(--muted-foreground)', hex.generation === 0 ? 8 : 16),
            stroke: 'transparent',
            dashed: false,
            ink: 'var(--foreground)',
          }
    case 'tile':
      return tileLook(hex)
    case 'list':
      return {
        fill: 'var(--card)',
        stroke: 'var(--warning)',
        dashed: false,
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
export function HexShape({ hex }: { hex: CanvasHex }) {
  const look = lookOf(hex)
  return (
    <polygon
      points={polygonPoints(hex.hex)}
      style={{ fill: look.fill, stroke: look.stroke }}
      strokeWidth={strokeWidth}
      strokeDasharray={look.dashed ? '4 3' : undefined}
      strokeLinejoin="round"
    />
  )
}

export function showsPreview(hex: Of<'tile'>): boolean {
  return hex.hex.radius >= 70 && hex.tile.preview !== ''
}

/** The title always, the preview once the hex is large enough to hold a few lines. */
export function TileLabel({ hex }: { hex: Of<'tile'> }) {
  const { radius } = hex.hex
  // Small enough for the longest word to fit the wide text box, at about 0.6em per character.
  const longestWord = Math.max(...hex.tile.title.split(/\s+/).map((word) => word.length))
  const fitting = (hexWidth(radius) * 0.85) / (longestWord * 0.6)
  const titleSize = Math.min(clamp(radius * 0.17, 6.5, 20), fitting)
  const previewSize = clamp(radius * 0.085, 9, 13)
  const style: CSSProperties = { color: lookOf(hex).ink }
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden text-center leading-tight select-none"
      style={style}
    >
      <span
        className="max-w-full font-semibold tracking-tight break-words"
        style={{ fontSize: titleSize }}
      >
        {hex.tile.title}
      </span>
      {showsPreview(hex) ? (
        <span className="line-clamp-3 opacity-70" style={{ fontSize: previewSize }}>
          {hex.tile.preview}
        </span>
      ) : null}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
