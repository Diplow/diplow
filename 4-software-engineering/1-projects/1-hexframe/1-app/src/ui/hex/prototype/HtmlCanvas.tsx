// Renderer A: every hex is a <div> cut to shape by `clip-path`. A clipped box has no border of its
// own, so the stroke is a second <div> clipped to a ring: the hex minus the hex inset by the stroke
// width, with the even-odd rule. A ring cannot be dashed; a dashed hex falls back to a fainter stroke.
import {
  hexBounds,
  hexCorners,
  hexHeight,
  hexWidth,
  insetHex,
  type Hex,
  type Point,
} from '../geometry'
import { layoutCanvas, type CanvasView, type Placement, type TileNode } from '../layout'

import { labelBox, lookOf, strokeWidth, TileLabel } from './appearance'

const hexPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

export function HtmlCanvas({
  center,
  view,
  radius,
}: {
  center: TileNode
  view: CanvasView
  radius: number
}) {
  const canvas: Hex = { center: { x: hexWidth(radius) / 2, y: radius }, radius }
  const placements = layoutCanvas(center, view, canvas)
  return (
    <div className="relative" style={{ width: hexWidth(radius), height: hexHeight(radius) }}>
      {placements.map((placement, index) => (
        <HtmlHex key={index} placement={placement} />
      ))}
    </div>
  )
}

function HtmlHex({ placement }: { placement: Placement }) {
  const look = lookOf(placement)
  const box = hexBounds(placement.hex)
  const stroke = look.dashed ? `color-mix(in oklab, ${look.stroke} 55%, transparent)` : look.stroke
  const label = labelBox(placement, box)
  return (
    <div
      className="absolute"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <div className="absolute inset-0" style={{ clipPath: hexPath, background: look.fill }} />
      <div
        className="absolute inset-0"
        style={{ clipPath: ringPath(placement.hex, box), background: stroke }}
      />
      {placement.kind === 'tile' ? (
        <div
          className="absolute"
          style={{ left: label.x, top: label.y, width: label.width, height: label.height }}
        >
          <TileLabel placement={placement} />
        </div>
      ) : null}
    </div>
  )
}

function ringPath(hex: Hex, origin: Point) {
  const loop = (corners: Point[]) =>
    [...corners, corners[0]].map(
      (corner) => `${px(corner?.x, origin.x)} ${px(corner?.y, origin.y)}`,
    )
  const outer = loop(hexCorners(hex))
  const inner = loop(hexCorners(insetHex(hex, strokeWidth)))
  return `polygon(evenodd, ${[...outer, ...inner].join(', ')})`
}

function px(value: number | undefined, origin: number) {
  return `${String((value ?? 0) - origin)}px`
}
