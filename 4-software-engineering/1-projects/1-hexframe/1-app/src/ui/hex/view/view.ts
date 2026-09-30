// The canvas's view state: which Tile is centered, which Children are expanded, whether the center
// shows its Context. It lives in the URL, so a link shows what its sender saw. Every function here
// is pure; each change returns the next view, tidied, for the route to navigate to.
import { Effect, Schema } from 'effect'

import { directions } from '../geometry/geometry'
import type { Placement, TileNode, Unfolding } from '../geometry/layout'

/** A field the URL got wrong is left out, so the view falls back to its default for that field. */
export const orDefault = <S extends Schema.Top>(schema: S) =>
  schema.pipe(Schema.catchDecoding(() => Effect.succeedNone))

export const TileId = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(100))

/**
 * The view as the URL carries it, and the route's `validateSearch`. Every field is optional and an
 * absent one is its default, so a plain URL is the root with nothing open.
 */
export const CanvasView = Schema.Struct({
  /** The centered Tile's id; absent, the System's root. */
  center: Schema.optionalKey(orDefault(TileId)),
  /** The Children shown as Frames, each inside the centered Tile or an expanded Child. */
  expanded: Schema.optionalKey(
    orDefault(Schema.Array(TileId).check(Schema.isMinLength(1), Schema.isMaxLength(100))),
  ),
  /** Whether the centered Tile shows its Context. */
  context: Schema.optionalKey(orDefault(Schema.Literal(true))),
})

export type CanvasView = typeof CanvasView.Type

/** The view resolved against a System: the centered Tile itself, and what is open around it. */
export interface ShownView extends Unfolding {
  center: TileNode
}

/** What a click on a Tile does. A double-click, or Shift+Enter, centers any Tile but the center. */
export type TileAction = 'expand' | 'collapse' | 'show-context' | 'hide-context' | 'center' | 'none'

const decodeCanvasView = Schema.decodeUnknownSync(CanvasView)

/**
 * Reads the URL's search params, field by field. Every field is set, `undefined` when it falls back:
 * the router lays a route's search over the raw one, where a field left out would keep its raw value.
 */
export function readCanvasView(search: Record<string, unknown>): CanvasView {
  return { center: undefined, expanded: undefined, context: undefined, ...decodeCanvasView(search) }
}

/**
 * The Tiles from the System's root down to the one with this id, both included, Context Tiles
 * included: the ancestors a breadcrumb shows. Empty when no Tile has the id.
 */
export function pathTo(system: TileNode, id: string): TileNode[] {
  if (system.id === id) return [system]
  const below = directions.flatMap((direction) => [
    system.children?.[direction],
    system.context?.[direction],
  ])
  for (const tile of below) {
    const path = tile ? pathTo(tile, id) : []
    if (path.length > 0) return [system, ...path]
  }
  return []
}

/** The Tile with this id, anywhere in the System, Context Tiles included. */
export function findTile(system: TileNode, id: string): TileNode | undefined {
  return pathTo(system, id).at(-1)
}

/** A view as a change asks for it, before `tidy` drops what no one would see. */
interface WantedView {
  center?: string
  expanded?: readonly string[]
  context?: boolean
}

/**
 * The view resolved against the System. An unknown center falls back to the root, and only the
 * expansions a reader can see are kept: a Child of the center, or of a Child that is expanded.
 */
export function showView(system: TileNode, view: WantedView): ShownView {
  const center = (view.center === undefined ? undefined : findTile(system, view.center)) ?? system
  const wanted = new Set(view.expanded)
  const expanded: string[] = []
  const visit = (tile: TileNode) => {
    for (const direction of directions) {
      const child = tile.children?.[direction]
      if (child && wanted.has(child.id)) {
        expanded.push(child.id)
        visit(child)
      }
    }
  }
  visit(center)
  return { center, expanded: new Set(expanded), context: view.context === true }
}

/** The view in its shortest form: defaults left out, expansions no one can see dropped. */
function tidy(system: TileNode, view: WantedView): CanvasView {
  const shown = showView(system, view)
  return {
    ...(shown.center === system ? {} : { center: shown.center.id }),
    ...(shown.expanded.size > 0 ? { expanded: [...shown.expanded] } : {}),
    ...(shown.context ? { context: true } : {}),
  }
}

export function toggleExpanded(system: TileNode, view: CanvasView, id: string): CanvasView {
  const expanded = view.expanded ?? []
  return tidy(system, {
    ...view,
    expanded: expanded.includes(id) ? expanded.filter((other) => other !== id) : [...expanded, id],
  })
}

export function toggleContext(system: TileNode, view: CanvasView): CanvasView {
  return tidy(system, { ...view, context: view.context !== true })
}

/** Centers a Tile. The expansions below it stay open; its Context starts closed. */
export function centerOn(system: TileNode, view: CanvasView, id: string): CanvasView {
  return tidy(system, { center: id, expanded: view.expanded ?? [] })
}

/**
 * A click on the center shows or hides its Context, a click on a Child expands or collapses it, and a
 * click on a Context Tile, which has nothing to expand, centers it.
 */
export function tileAction(placement: Placement, shown: ShownView): TileAction {
  if (placement.kind !== 'tile') return 'none'
  if (placement.tile.id === shown.center.id) return shown.context ? 'hide-context' : 'show-context'
  if (placement.role === 'children') return 'expand'
  // The hub of an expanded Child: the Child itself, drawn at the heart of its Frame.
  if (placement.role === 'hub') return 'collapse'
  return 'center'
}
