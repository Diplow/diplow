// Where you are, in the canvas's corner: the centered Tile's ancestors, from the System's root down to
// the centered Tile, drawn as the canvas's `Rail`, hexframe's mark at its head, turning whole at each
// thing done on the page (`useThingsDone`). A click on an ancestor centers it, the camera going out to
// it with every Tile keeping its state (`recenter`); like the canvas, the rail holds no view and hands
// the next one to the route, with the gesture that asked for it. Before
// the System is read, or once reading it failed, the mark is alone. On another System than the
// reader's, the tutorial, the mark is the way back to their own Root, which its caller takes. The
// point you are on takes the light of the System's star, rose on an Organization's.
import { Rail } from '#/front/ui/canvas/layouts/Rail'
import type { TileHex, TileLets } from '#/front/ui/canvas/state/useCanvasState'
import { pathTo, type Sun, type TileNode } from '#/front/ui/canvas/view/tiles'
import { recenter, showView, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'

import { useThingsDone } from './done'

/**
 * Where you are on the System the canvas shows, as each side of home hands it on: the breadcrumb in
 * the canvas's corner and, under a page, the hex widget in the chat each take it whole and draw what
 * they need of it.
 */
export interface Where {
  /** None while the System is read, or once reading it failed: no step, the mark alone; no widget. */
  system: TileNode | undefined
  view: CanvasView
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /** The mark chosen, on another System than the reader's: back to their own Root. */
  onHome?: (() => void) | undefined
  /** The System's star, whose light the point you are on takes: a person's, amber, by default. */
  sun?: Sun | undefined
  /** What the canvas's own rules let through, the tutorial's, which the hex widget holds back too. */
  lets?: ((hex: TileHex) => TileLets) | undefined
}

interface BreadcrumbProps extends Where {
  className?: string
}

export function Breadcrumb(props: BreadcrumbProps) {
  const { system, view, onViewChange, onHome, sun, className } = props
  const turns = useThingsDone()
  return (
    <Rail
      turns={turns}
      steps={system === undefined ? [] : pathTo(system, showView(system, view).center.id)}
      onSelect={(tile) => {
        if (system === undefined) return
        onViewChange(recenter(system, view, tile), { gesture: 'center', tile })
      }}
      onHome={onHome}
      light={sun?.light}
      className={className}
    />
  )
}
