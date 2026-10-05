// What the System's page carries in its URL: the canvas's view (front/ui/hex/view), and the change the user
// has under way, if any: a new Tile's form, an import, a Tile's form, or a Tile to move. A link shows
// the page as its sender saw it, the open form included. Every function here is pure.
import { Schema } from 'effect'

import { Slot } from '#/api/mapping/mapping'
import type { ImportPlace } from '#/front/client/mapping/queries'
import type { TileNode } from '#/front/ui/hex/geometry/layout'
import { CanvasView, findTile, orDefault, readSearch, TileId } from '#/front/ui/hex/view/view'

/** What `import` says for the Root of an empty System, where a Tile's id goes otherwise. */
const rootPlace = 'root'

/** Where an import goes, as the URL names it: under a Tile, by its id, or `root`. */
const ImportInto = Schema.Union([Schema.Literal(rootPlace), TileId])

/** The page's search params, and the route's `validateSearch`: the view, then the change. */
const SystemSearch = Schema.Struct({
  ...CanvasView.fields,
  /** The Tile a new one goes under, with `slot`: the new Tile's form is open. */
  add: Schema.optionalKey(orDefault(TileId)),
  slot: Schema.optionalKey(orDefault(Slot)),
  /**
   * Where an import lands, its drawer open: in `slot` under this Tile, or, `root`, as the Root of an
   * empty System.
   */
  import: Schema.optionalKey(orDefault(ImportInto)),
  /** The Tile whose form is open. */
  edit: Schema.optionalKey(orDefault(TileId)),
  /** The Tile being moved: the next empty slot clicked is where it goes. */
  move: Schema.optionalKey(orDefault(TileId)),
})

export type SystemSearch = typeof SystemSearch.Type

/**
 * The next search params, for the route to navigate to; or, for a change that lands later, once a
 * write settles, how to make them from the search params of that moment, which the user may have
 * changed meanwhile.
 */
export type SearchChange = SystemSearch | ((current: SystemSearch) => SystemSearch)

/** The change under way, as the page reads it from its search params. */
export type Change =
  | { kind: 'none' }
  | { kind: 'add'; parent: string; slot: typeof Slot.Type }
  | { kind: 'import'; place: ImportPlace }
  | { kind: 'edit'; id: string }
  | { kind: 'move'; id: string }

/** Reads the URL's search params, field by field: the route's `validateSearch`. */
export const readSystemSearch = readSearch(SystemSearch)

/** The canvas's part of the search params. */
export function viewOf({ center, expanded, context }: SystemSearch): CanvasView {
  return { center, expanded, context }
}

/** Where an import lands, as the URL says it: a slot under a Tile, the Root, or nowhere. */
function importPlaceOf(into: string, slot: typeof Slot.Type | undefined): ImportPlace | undefined {
  if (into === rootPlace) return { _tag: 'Root' }
  return slot === undefined ? undefined : { _tag: 'Slot', parent: into, slot }
}

/**
 * The change under way. The URL holds one at most; were it to hold several, a form wins over a move,
 * since the form covers the canvas.
 */
export function changeOf({ add, slot, import: into, edit, move }: SystemSearch): Change {
  if (edit !== undefined) return { kind: 'edit', id: edit }
  if (add !== undefined && slot !== undefined) return { kind: 'add', parent: add, slot }
  const place = into === undefined ? undefined : importPlaceOf(into, slot)
  if (place !== undefined) return { kind: 'import', place }
  if (move !== undefined) return { kind: 'move', id: move }
  return { kind: 'none' }
}

/** The search params of an import's place: the Tile it goes under and its slot, or the Root. */
const importSearch = (place: ImportPlace) =>
  place._tag === 'Root' ? { import: rootPlace } : { import: place.parent, slot: place.slot }

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
    import: undefined,
    ...(change.kind === 'import' && importSearch(change.place)),
    edit: change.kind === 'edit' ? change.id : undefined,
    move: change.kind === 'move' ? change.id : undefined,
  }
}

/** The Tile a change names: the one it edits or moves, or the one it adds or imports under. */
function namedBy(change: Change): string | undefined {
  switch (change.kind) {
    case 'none':
      return undefined
    case 'add':
      return change.parent
    case 'import':
      return change.place._tag === 'Slot' ? change.place.parent : undefined
    case 'edit':
    case 'move':
      return change.id
  }
}

/**
 * The search params once this Tile is gone, and everything below it with it: the change under way
 * ends if it named one of them, and any other survives, as it does a view change. A Reference below
 * the Tile names a Tile that stays.
 */
export function withoutTile(search: SystemSearch, gone: TileNode): SystemSearch {
  const named = namedBy(changeOf(search))
  return named !== undefined && findTile(gone, named) !== undefined
    ? withChange(search, { kind: 'none' })
    : search
}
