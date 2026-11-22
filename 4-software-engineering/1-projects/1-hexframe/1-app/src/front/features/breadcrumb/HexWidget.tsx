// Where you are while the center shows as its page, in the chat: the hex view the page took the
// canvas from, drawn small at the conversation's foot, filling the widget behind its head as far as
// the curve, the center at its fullest, its ring and its Context (`hexViewOf`). A click on a Tile
// there opens that Tile's page, the widget's camera flying to it as the canvas's does; the center,
// whose page is open, answers nothing, and neither does a pin. Each Tile shows its hover card
// alone: no menu, no C key, no drag. It closes with the page, by Escape or C. Like the breadcrumb,
// it holds no view, and takes what the breadcrumb takes: it shows while the view shows a page, and
// the route navigates.
import { Hexagon } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { showView } from '#/front/ui/canvas/view/view'
import { Widget } from '#/front/ui/chat/layouts/Widget'

import type { Where } from './Breadcrumb'
import { hexLetsOf, hexViewOf, pageGoneTo } from './hex'

/**
 * Shown while `view` shows the center as its page; a click hands the route that Tile's page, a
 * `center` gesture on it (`onViewChange`). `onHome` is the corner's alone.
 */
export function HexWidget({ system, view, onViewChange, lets, sun }: Where) {
  if (system === undefined || view.page !== true) return null
  const center = showView(system, view).center
  return (
    <Widget
      voice="app"
      icon={<Hexagon />}
      kicker={m.widget_hex_kicker()}
      title={center.title}
      backdrop={
        // Where the page's flight finds the hex view, flying it in from the canvas and back.
        <div data-hex-widget="" className="size-full">
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
      }
    >
      {/* The room the hex view takes below its head, which it fills behind the head too. */}
      <div className="aspect-[3/2] w-full" />
    </Widget>
  )
}
