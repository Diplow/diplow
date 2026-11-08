// Where you are while the center shows as its page, in the chat: the hex view the page took the canvas
// from, drawn small at the conversation's foot, the center at its fullest, its ring and its Context
// (`hexViewOf`). A click on a Tile there opens that Tile's page, the widget's camera flying to it as
// the canvas's does; the center, whose page is open, answers nothing, and neither does a pin. Each Tile
// shows its hover card alone: no menu, no C key, no drag. It closes with the page, by Escape or C.
// Like the breadcrumb, it holds no view, and takes what the breadcrumb takes: it shows while the view
// shows a page, and the route navigates.
import { Hexagon } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { Canvas } from '#/front/ui/canvas/Canvas'
import type { TileHex, TileLets } from '#/front/ui/canvas/state/useCanvasState'
import { showView, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'
import type { Sun, TileNode } from '#/front/ui/canvas/view/tiles'
import { Widget } from '#/front/ui/chat/layouts/Widget'

import { hexLetsOf, hexViewOf, pageGoneTo } from './hex'

interface HexWidgetProps {
  /** None while the System is read, or once reading it failed: no widget. */
  system: TileNode | undefined
  /** The view the URL asks for: no widget unless it shows the center as its page. */
  view: CanvasView
  /** The page of the Tile clicked, as a `center` gesture on it: the route navigates. */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /** What the canvas's own rules let through, the tutorial's; without them, every gesture. */
  lets?: ((hex: TileHex) => TileLets) | undefined
  /** The System's star, as the canvas takes it. */
  sun?: Sun | undefined
}

export function HexWidget({ system, view, onViewChange, lets, sun }: HexWidgetProps) {
  if (system === undefined || view.page !== true) return null
  const center = showView(system, view).center
  return (
    <Widget voice="app" icon={<Hexagon />} kicker={m.widget_hex_kicker()} title={center.title}>
      <div className="aspect-[4/3] w-full">
        <Canvas
          system={system}
          view={hexViewOf(system, view)}
          onViewChange={(next, action) => {
            const gone = pageGoneTo(system, view, next, action)
            if (gone !== undefined) onViewChange(gone.view, gone.action)
          }}
          looking="card"
          lets={hexLetsOf(system, view, lets)}
          sun={sun}
          className="size-full"
        />
      </div>
    </Widget>
  )
}
