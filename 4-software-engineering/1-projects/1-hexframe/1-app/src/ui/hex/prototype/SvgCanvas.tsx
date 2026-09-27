// Renderer B: one <svg>, every hex a <polygon> with a real stroke, and the text in a <foreignObject>
// so it wraps like HTML. The viewBox is the canvas's own coordinates, so zooming is one attribute.
import { hexCorners, hexHeight, hexWidth, type Hex } from '../geometry'
import { layoutCanvas, type CanvasView, type Placement, type TileNode } from '../layout'

import { labelBox, lookOf, strokeWidth, TileLabel } from './appearance'

export function SvgCanvas({
  center,
  view,
  radius,
}: {
  center: TileNode
  view: CanvasView
  radius: number
}) {
  const width = hexWidth(radius)
  const height = hexHeight(radius)
  const canvas: Hex = { center: { x: width / 2, y: radius }, radius }
  const placements = layoutCanvas(center, view, canvas)
  return (
    <svg viewBox={`0 0 ${String(width)} ${String(height)}`} width={width} height={height}>
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
  const label = labelBox(placement, { x: 0, y: 0 })
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
