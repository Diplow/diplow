// The canvas: one <svg>, every hex a <polygon> with a real stroke, and the text in a <foreignObject>
// so it wraps like HTML. The viewBox is the canvas's own coordinates, so the page sizes it with CSS
// and everything inside, text included, scales with it. The view is the caller's, from the URL: the
// canvas only says which view comes next.
import { useRef } from 'react'

import { m } from '#/paraglide/messages'

import { hexHeight, hexWidth, type Hex } from './geometry/geometry'
import { layoutCanvas, type TileNode } from './geometry/layout'
import { EmptySlot, Frame } from './Frame'
import { Tile } from './Tile'
import {
  centerOn,
  showView,
  tileAction,
  toggleContext,
  toggleExpanded,
  type CanvasView,
  type TileAction,
} from './view/view'

interface CanvasProps {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /** The next view, after a click: the caller puts it in the URL. */
  onViewChange: (view: CanvasView) => void
  className?: string
}

/** The canvas's radius in its own coordinates; the text sizes are tuned to it. */
const radius = 320
const canvas: Hex = { center: { x: hexWidth(radius) / 2, y: radius }, radius }

export function Canvas({ system, view, onViewChange, className }: CanvasProps) {
  const shown = showView(system, view)
  const placements = layoutCanvas(shown.center, shown, canvas)
  // The Tile the last single click landed on: a double-click centers it only if its first click
  // landed there too, since that click may have redrawn what lies under the pointer.
  const clicked = useRef<string | undefined>(undefined)

  function act(tile: TileNode, action: TileAction) {
    if (action === 'expand' || action === 'collapse') {
      onViewChange(toggleExpanded(system, view, tile.id))
    } else if (action === 'show-context' || action === 'hide-context') {
      onViewChange(toggleContext(system, view))
    } else if (action === 'center') {
      onViewChange(centerOn(system, view, tile.id))
    }
  }

  function center(tile: TileNode, from: 'pointer' | 'keyboard') {
    const again = from === 'keyboard' || clicked.current === tile.id
    if (again && tile.id !== shown.center.id) onViewChange(centerOn(system, view, tile.id))
  }

  return (
    <svg
      viewBox={`0 0 ${String(hexWidth(radius))} ${String(hexHeight(radius))}`}
      role="group"
      aria-label={m.hex_canvas_label({ title: shown.center.title })}
      className={className}
    >
      {placements.map((placement) => {
        switch (placement.kind) {
          case 'frame':
            return <Frame key={placement.key} placement={placement} />
          case 'empty':
            return <EmptySlot key={placement.key} placement={placement} />
          case 'tile': {
            const action = tileAction(placement, shown)
            return (
              <Tile
                key={placement.key}
                placement={placement}
                action={action}
                onAct={(repeat) => {
                  // The second click of a double-click is the double-click's, not a click of its own.
                  if (repeat) return
                  clicked.current = placement.tile.id
                  act(placement.tile, action)
                }}
                onCenter={(from) => {
                  center(placement.tile, from)
                }}
              />
            )
          }
        }
      })}
    </svg>
  )
}
