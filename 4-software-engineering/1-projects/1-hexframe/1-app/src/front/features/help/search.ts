// What the Help page carries in its URL: the canvas's view (front/ui/hex/view), as on home, and the
// Tile whose Body is open, if any. A link shows Help as its sender saw it, the open Body included.
// Every function here is pure.
import { Schema } from 'effect'

import { CanvasView, orDefault, readSearch, TileId } from '#/front/ui/hex/view/view'

/** The page's search params, and the route's `validateSearch`: the view, then the open Body. */
const HelpSearch = Schema.Struct({
  ...CanvasView.fields,
  /** The Tile whose Body is open, in a drawer over the canvas. */
  open: Schema.optionalKey(orDefault(TileId)),
})

export type HelpSearch = typeof HelpSearch.Type

/** Reads the URL's search params, field by field: the route's `validateSearch`. */
export const readHelpSearch = readSearch(HelpSearch)

/** The canvas's part of the search params. */
export function viewOf({ center, expanded, context }: HelpSearch): CanvasView {
  return { center, expanded, context }
}

/** The search params for this view, keeping the open Body: the drawer covers the canvas. */
export function withView(search: HelpSearch, view: CanvasView): HelpSearch {
  return { ...search, center: view.center, expanded: view.expanded, context: view.context }
}

/** The search params with this Tile's Body open, or none when `id` is `undefined`, keeping the view. */
export function withOpen(search: HelpSearch, id: string | undefined): HelpSearch {
  return { ...search, open: id }
}
