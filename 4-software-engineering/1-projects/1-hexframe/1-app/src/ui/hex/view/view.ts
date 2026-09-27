// The canvas's view state: which Tile is centered, which Children are expanded, whether the center
// shows its Context. It lives in the URL, so a link shows what its sender saw. Every function here
// is pure; each change returns the next view, tidied, for the route to navigate to.
import { directions } from '../geometry/geometry'
import type { Placement, TileNode, Unfolding } from '../geometry/layout'

/** The view as the URL carries it. An absent field is its default, so a plain URL is the root. */
export interface CanvasView {
  /** The centered Tile's id; absent, the System's root. */
  center?: string
  /** The Children shown as Frames, each inside the centered Tile or an expanded Child. */
  expanded?: string[]
  /** Whether the centered Tile shows its Context. */
  context?: boolean
}

/** The view resolved against a System: the centered Tile itself, and what is open around it. */
export interface ShownView extends Unfolding {
  center: TileNode
}

/** What a click on a Tile does. A double-click, or Shift+Enter, centers any Tile but the center. */
export type TileAction = 'expand' | 'collapse' | 'show-context' | 'hide-context' | 'center' | 'none'

/** Reads the URL's search params field by field; a field it cannot read falls back to its default. */
export function readCanvasView(search: Record<string, unknown>): CanvasView {
  const view: CanvasView = {}
  if (typeof search.center === 'string' && search.center !== '') view.center = search.center
  if (Array.isArray(search.expanded)) {
    const ids = search.expanded.filter((id): id is string => typeof id === 'string' && id !== '')
    if (ids.length > 0) view.expanded = ids
  }
  if (search.context === true) view.context = true
  return view
}

/** The Tile with this id, anywhere in the System, Context Tiles included. */
export function findTile(system: TileNode, id: string): TileNode | undefined {
  if (system.id === id) return system
  const below = directions.flatMap((direction) => [
    system.children?.[direction],
    system.context?.[direction],
  ])
  for (const tile of below) {
    const found = tile && findTile(tile, id)
    if (found) return found
  }
  return undefined
}

/**
 * The view resolved against the System. An unknown center falls back to the root, and only the
 * expansions a reader can see are kept: a Child of the center, or of a Child that is expanded.
 */
export function showView(system: TileNode, view: CanvasView): ShownView {
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
function tidy(system: TileNode, view: CanvasView): CanvasView {
  const shown = showView(system, view)
  const next: CanvasView = {}
  if (shown.center !== system) next.center = shown.center.id
  if (shown.expanded.size > 0) next.expanded = [...shown.expanded]
  if (shown.context) next.context = true
  return next
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
