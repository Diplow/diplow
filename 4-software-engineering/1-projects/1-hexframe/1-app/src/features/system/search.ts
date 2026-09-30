// What the System's page carries in its URL: the canvas's view (ui/hex/view), and the change the user
// has under way, if any: a new Tile's form, a Tile's form, or a Tile to move. A link shows the page as
// its sender saw it, the open form included. Every function here is pure.
import { Schema } from 'effect'

import { CanvasView, orDefault, TileId } from '#/ui/hex/view/view'

/** A Child's Direction, 1 to 6, or a Context slot, −1 to −6. */
const Slot = Schema.Literals([1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6])

/** The page's search params, and the route's `validateSearch`: the view, then the change. */
const SystemSearch = Schema.Struct({
  ...CanvasView.fields,
  /** The Tile a new one goes under, with `slot`: the new Tile's form is open. */
  add: Schema.optionalKey(orDefault(TileId)),
  slot: Schema.optionalKey(orDefault(Slot)),
  /** The Tile whose form is open. */
  edit: Schema.optionalKey(orDefault(TileId)),
  /** The Tile being moved: the next empty slot clicked is where it goes. */
  move: Schema.optionalKey(orDefault(TileId)),
})

export type SystemSearch = typeof SystemSearch.Type

/** The change under way, as the page reads it from its search params. */
export type Change =
  | { kind: 'none' }
  | { kind: 'add'; parent: string; slot: typeof Slot.Type }
  | { kind: 'edit'; id: string }
  | { kind: 'move'; id: string }

const decodeSystemSearch = Schema.decodeUnknownSync(SystemSearch)

/** Reads the URL's search params, field by field; every field is set, `undefined` when it falls back. */
export function readSystemSearch(search: Record<string, unknown>): SystemSearch {
  return {
    center: undefined,
    expanded: undefined,
    context: undefined,
    add: undefined,
    slot: undefined,
    edit: undefined,
    move: undefined,
    ...decodeSystemSearch(search),
  }
}

/** The canvas's part of the search params. */
export function viewOf({ center, expanded, context }: SystemSearch): CanvasView {
  return { center, expanded, context }
}

/**
 * The change under way. The URL holds one at most; were it to hold several, a form wins over a move,
 * since the form covers the canvas.
 */
export function changeOf({ add, slot, edit, move }: SystemSearch): Change {
  if (edit !== undefined) return { kind: 'edit', id: edit }
  if (add !== undefined && slot !== undefined) return { kind: 'add', parent: add, slot }
  if (move !== undefined) return { kind: 'move', id: move }
  return { kind: 'none' }
}

/** The search params for this view, keeping the change under way. */
export function withView(search: SystemSearch, view: CanvasView): SystemSearch {
  return { ...search, center: view.center, expanded: view.expanded, context: view.context }
}

/** The search params for this change, keeping the view; `none` ends the one under way. */
export function withChange(search: SystemSearch, change: Change): SystemSearch {
  return {
    ...viewOf(search),
    add: change.kind === 'add' ? change.parent : undefined,
    slot: change.kind === 'add' ? change.slot : undefined,
    edit: change.kind === 'edit' ? change.id : undefined,
    move: change.kind === 'move' ? change.id : undefined,
  }
}

/**
 * The search params once this Tile is gone: the change under way ends if it named the Tile, and any
 * other survives, as it does a view change.
 */
export function withoutTile(search: SystemSearch, id: string): SystemSearch {
  const change = changeOf(search)
  const named =
    change.kind === 'add' ? change.parent : change.kind === 'none' ? undefined : change.id
  return named === id ? withChange(search, { kind: 'none' }) : search
}
