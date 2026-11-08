// The hex widget's view of where you are, while the center shows as its page: what it draws, what
// its Tiles let through and where a gesture on one goes. Pure.
import type { TileHex, TileLets } from '#/front/ui/canvas/state/useCanvasState'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'
import {
  centerOn,
  showView,
  withContext,
  withoutPage,
  withPage,
  type CanvasView,
  type ViewAction,
} from '#/front/ui/canvas/view/view'

/**
 * The center as the widget draws it beneath its page: at its fullest, its ring around it and its
 * Context inside where it has them, whatever the page's link opens, so each Tile around it is there to
 * be clicked; the Tiles around it as the link says.
 */
export function hexViewOf(system: TileNode, view: CanvasView): CanvasView {
  return withContext(system, withoutPage(system, view))
}

/**
 * What a Tile of the widget lets through: nothing on the center, whose page is open, nor on a Tile
 * standing in another System, a pin, which only the canvas follows; elsewhere what the canvas's own
 * rules let through, the tutorial's, or everything.
 */
export function hexLetsOf(
  system: TileNode,
  view: CanvasView,
  lets?: (hex: TileHex) => TileLets,
): (hex: TileHex) => TileLets {
  const center = showView(system, view).center.id
  return (hex) => {
    const held = hex.tile.id === center || findTile(system, hex.tile.id) === undefined
    if (held) return { click: false, recenter: false }
    return lets?.(hex) ?? { click: true, recenter: true }
  }
}

/**
 * Where a gesture on a Tile of the widget goes: that Tile's page, centered as the gesture centered
 * it, or as a Tile named from elsewhere lands if the gesture opened it in place, the widget's camera
 * flying there; a `center` gesture on it. None on the center, whose page is open.
 */
export function pageGoneTo(
  system: TileNode,
  view: CanvasView,
  next: CanvasView,
  { tile }: ViewAction,
): { view: CanvasView; action: ViewAction } | undefined {
  if (tile === showView(system, view).center.id) return undefined
  const centered = showView(system, next).center.id === tile ? next : centerOn(system, tile)
  return { view: withPage(system, centered), action: { gesture: 'center', tile } }
}
