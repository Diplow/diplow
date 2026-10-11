// Where you are, in the canvas's corner: the centered Tile's ancestors, from the System's root down to
// the centered Tile, drawn as the canvas's `Rail`, the theme at its head. A click on an ancestor
// centers it; like the canvas, the rail holds no view and hands the next one to the route, with the
// gesture that asked for it. Before the System is read, or once reading it failed, the theme is alone.
import { Rail } from '#/front/ui/canvas/layouts/Rail'
import { pathTo, type TileNode } from '#/front/ui/canvas/view/tiles'
import { centerOn, showView, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'

interface BreadcrumbProps {
  /** None while the System is read, or once reading it failed: no step, the theme alone. */
  system: TileNode | undefined
  view: CanvasView
  onViewChange: (view: CanvasView, action: ViewAction) => void
  className?: string
}

export function Breadcrumb({ system, view, onViewChange, className }: BreadcrumbProps) {
  return (
    <Rail
      steps={system === undefined ? [] : pathTo(system, showView(system, view).center.id)}
      onSelect={(tile) => {
        if (system !== undefined) onViewChange(centerOn(system, tile), { gesture: 'center', tile })
      }}
      className={className}
    />
  )
}
