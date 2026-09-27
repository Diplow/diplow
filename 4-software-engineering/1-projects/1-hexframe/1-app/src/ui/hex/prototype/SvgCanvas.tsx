// The canvas: one <svg>, every hex a <polygon> with a real stroke, and the text in a <foreignObject>
// so it wraps like HTML. The viewBox is the canvas's own coordinates, so the page sizes it with CSS
// and everything inside, text included, scales with it.
import { hexCorners, hexHeight, hexWidth, textBox, type Hex } from '../geometry'
import { layoutCanvas, type CanvasView, type Placement, type TileNode } from '../layout'

import { lookOf, showsPreview, strokeWidth, TileLabel } from './appearance'

/** The canvas's radius in its own coordinates; the text sizes are tuned to it. */
const radius = 320

export function SvgCanvas({
  center,
  view,
  className,
}: {
  center: TileNode
  view: CanvasView
  className?: string
}) {
  const width = hexWidth(radius)
  const canvas: Hex = { center: { x: width / 2, y: radius }, radius }
  const placements = layoutCanvas(center, view, canvas)
  return (
    <svg viewBox={`0 0 ${String(width)} ${String(hexHeight(radius))}`} className={className}>
      {placements.map((placement, index) => (
        <SvgHex key={index} placement={placement} />
      ))}
    </svg>
  )
}

function SvgHex({ placement }: { placement: Placement }) {
  const look = lookOf(placement)
  const points = hexCorners(placement.hex)
    .map(({ x, y }) => `${String(x)},${String(y)}`)
    .join(' ')
  const label = textBox(placement.hex, showsPreview(placement) ? 'tall' : 'wide')
  return (
    <g>
      <polygon
        points={points}
        style={{ fill: look.fill, stroke: look.stroke }}
        strokeWidth={strokeWidth}
        strokeDasharray={look.dashed ? '4 3' : undefined}
        strokeLinejoin="round"
      />
      {placement.kind === 'tile' ? (
        <foreignObject x={label.x} y={label.y} width={label.width} height={label.height}>
          <TileLabel placement={placement} />
        </foreignObject>
      ) : null}
    </g>
  )
}
