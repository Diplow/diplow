// Draws a Frame's placements as an SVG document, for the surfaces that take one (the Desktop app).
// Each hex takes its placement's radius; the text keeps one size, set for claude-mod's depth 1.
import type { Direction } from './shape/node.js'
import { wrap } from './raster.js'
import { viewHeight, viewWidth, hexCorners, type Placement } from './shape/layout.js'

/** Pixels per unit of the layout. */
const scale = 110

/** The share of a placement's radius a hex is drawn at, leaving a gap between neighbors. */
const hexRadius = 0.93

/** The width of the band between a hex's side corners, where its text sits. */
function bandWidth(radius: number): number {
  return Math.sqrt(3) * radius
}

const fills = {
  center: { fill: '#5b3cc4', title: '#ffffff', preview: '#ddd6fe' },
  branch: { fill: '#2f3446', title: '#f3f4f6', preview: '#9ca3af' },
  leaf: { fill: '#4a3426', title: '#fde7d0', preview: '#d4a373' },
  context: { fill: '#134e4a', title: '#ccfbf1', preview: '#5eead4' },
}

const titleSize = 15
const previewSize = 11
/** About how wide a character of the sans-serif face is, as a share of its size. */
const characterWidth = 0.55

/** Draws the placements; the member in direction `selected`, if any, outlined. */
export function drawSvg(placements: readonly Placement[], selected?: Direction): string {
  const width = Math.round(viewWidth * scale)
  const height = Math.round(viewHeight * scale)
  const shapes = placements.map((placement) => shapeOf(placement, selected)).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" font-family="system-ui, sans-serif">${shapes}</svg>`
  )
}

function shapeOf(placement: Placement, selected: Direction | undefined): string {
  const cx = placement.center.x * scale
  const cy = placement.center.y * scale
  const radius = hexRadius * placement.radius
  const points = hexCorners(placement.center, radius)
    .map(({ x, y }) => `${round(x * scale)},${round(y * scale)}`)
    .join(' ')

  if (placement.kind === 'empty') {
    return (
      `<polygon points="${points}" fill="none" stroke="#4b5563" stroke-dasharray="4 6"/>` +
      text(cx, cy + 5, '#6b7280', previewSize, String(placement.direction))
    )
  }

  const colors = fills[placement.kind === 'center' ? 'center' : placement.memberKind]
  const band = bandWidth(radius) * scale * 0.86
  const title = wrap(placement.tile.title, Math.floor(band / (titleSize * characterWidth)), 2)
  const preview = wrap(
    placement.tile.preview,
    Math.floor(band / (previewSize * characterWidth)),
    placement.kind === 'center' ? 5 : 4,
  )
  const lineHeights = [...title.map(() => titleSize * 1.2), ...preview.map(() => previewSize * 1.3)]
  const gap = preview.length > 0 ? 6 : 0
  const total = lineHeights.reduce((sum, line) => sum + line, 0) + gap
  let y = cy - total / 2

  let words = ''
  title.forEach((line, index) => {
    y += lineHeights[index] ?? 0
    words += text(cx, y - 4, colors.title, titleSize, line, true)
  })
  y += gap
  preview.forEach((line, index) => {
    y += lineHeights[title.length + index] ?? 0
    words += text(cx, y - 3, colors.preview, previewSize, line)
  })

  const label =
    placement.kind === 'member'
      ? text(
          cx,
          cy - radius * scale * 0.72,
          colors.preview,
          previewSize,
          String(placement.direction),
        )
      : ''
  const outline =
    placement.kind === 'member' && placement.direction === selected
      ? ' stroke="#fbbf24" stroke-width="4"'
      : ''
  return `<polygon points="${points}" fill="${colors.fill}"${outline}/>${label}${words}`
}

function text(
  x: number,
  y: number,
  color: string,
  size: number,
  content: string,
  isBold = false,
): string {
  const weight = isBold ? ' font-weight="600"' : ''
  return (
    `<text x="${round(x)}" y="${round(y)}" fill="${color}" font-size="${size}"${weight} ` +
    `text-anchor="middle">${escape(content)}</text>`
  )
}

function escape(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
