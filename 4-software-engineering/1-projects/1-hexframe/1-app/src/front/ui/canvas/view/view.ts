// The canvas's view state, the shape's: which Tile is centered, whether it stands alone, folded, or
// opens into a ring around it, the ring inside its hex, and which Branches of the ring around it
// open, each into a Frame kind of its own, two generations deep. It lives in the URL, so a link shows
// what its sender saw. Every function here is pure; each change returns the next view, tidied, for
// the route to navigate to.
import { Effect, Schema } from 'effect'

import { directions, type Direction } from '../geometry/geometry'
import {
  findTile,
  firstKindOf,
  frameKinds,
  innerKinds,
  kindsOf,
  outerKinds,
  type FrameKind,
  type InnerKind,
  type OuterKind,
  type TileNode,
} from './tiles'

/** A field the URL got wrong is left out, so the view falls back to its default for that field. */
export const orDefault = <S extends Schema.Top>(schema: S) =>
  schema.pipe(Schema.catchDecoding(() => Effect.succeedNone))

/**
 * A route's `validateSearch` over search params whose fields each fall back. Every field of the schema
 * is set, `undefined` when it falls back: the router lays a route's search over the raw one, where a
 * field left out would keep its raw value.
 */
export function readSearch<
  S extends Schema.Struct<Schema.Struct.Fields> & Schema.ConstraintDecoder<object>,
>(schema: S) {
  const decode = Schema.decodeUnknownSync(schema)
  const unset = Object.fromEntries(Object.keys(schema.fields).map((key) => [key, undefined]))
  return (search: Record<string, unknown>): S['Type'] => ({ ...unset, ...decode(search) })
}

export const TileId = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(100))

/** A Branch of the ring around the center, opened into a Frame kind; one the URL got wrong stays closed. */
const opened = Schema.optionalKey(orDefault(Schema.Literals(frameKinds)))

/**
 * The view as the URL carries it, and the route's `validateSearch`. Every field is optional and an
 * absent one is its default, so a plain URL is the root alone, folded, filling the canvas with its
 * preview whole: nothing around it, nothing inside it, nothing open. A link from before the shape's
 * view, its expansions a list of ids, keeps its center alone.
 */
export const CanvasView = Schema.Struct({
  /** The centered Tile's id; absent, the System's root. */
  center: Schema.optionalKey(orDefault(TileId)),
  /** The Frame kind of the ring around the center; absent, none: the center alone, folded. */
  frame: Schema.optionalKey(orDefault(Schema.Literals(outerKinds))),
  /** The ring inside the center's hex; absent, none. */
  inner: Schema.optionalKey(orDefault(Schema.Literals(innerKinds))),
  /** The Branches of the ring around the center that open, by Direction, each into its Frame kind. */
  expanded: Schema.optionalKey(
    orDefault(Schema.Struct({ 1: opened, 2: opened, 3: opened, 4: opened, 5: opened, 6: opened })),
  ),
})

export type CanvasView = typeof CanvasView.Type

/**
 * The gestures that change the view, as the canvas names them: centering a Tile, opening the center
 * or a Branch of the ring around it, or closing it, showing a ring inside the center or hiding it,
 * and picking the ring around it, which links recorded before the center folded still name. A
 * navigation fact carries one, and the timeline tells it.
 */
export const Gesture = Schema.Literals([
  'center',
  'expand',
  'collapse',
  'show-context',
  'hide-context',
  'show-leaves',
  'hide-leaves',
  'show-children-around',
  'show-branches-around',
  'show-leaves-around',
])

export type Gesture = typeof Gesture.Type

/** What changed the view: the gesture, and the Tile it was made on, the center for a ring's. */
export const ViewAction = Schema.Struct({ gesture: Gesture, tile: TileId })

export type ViewAction = typeof ViewAction.Type

/** Reads the URL's search params, field by field: the route's `validateSearch`. */
export const readCanvasView = readSearch(CanvasView)

/**
 * The view resolved against a System: the centered Tile itself, the rings it shows, and what opens
 * around it. A folded center, and a centered Leaf, which opens nothing, have no ring, `frame` and
 * `inner` undefined: it fills the view alone.
 */
export interface ShownView {
  center: TileNode
  frame: OuterKind | undefined
  inner: InnerKind | undefined
  expanded: Partial<Record<Direction, FrameKind>>
}

/** Context goes inside any ring, Leaves only inside Branches: never the same kind in both. */
function insideKinds(kinds: readonly FrameKind[], frame: OuterKind | undefined): InnerKind[] {
  if (frame === undefined) return []
  return frame === 'branches' && kinds.includes('leaves') ? ['leaves', 'context'] : ['context']
}

/**
 * The view resolved against the System. An unknown center falls back to the root; the center stands
 * alone unless the view opens a ring around it, one it doesn't offer opening its first, and so does a
 * view that names a ring inside it or a Branch open but no ring around, as links did when the first
 * ring was the default; an inner ring that can't sit beside the outer one falls back to none. Only a
 * Branch of the ring around the center opens, into a kind it offers, else into its first ring.
 */
export function showView(system: TileNode, view: CanvasView): ShownView {
  const center = (view.center === undefined ? undefined : findTile(system, view.center)) ?? system
  const kinds = kindsOf(center)
  const wanted = view.frame
  const frame =
    wanted !== undefined && kinds.includes(wanted)
      ? wanted
      : wanted !== undefined || opensWithin(view)
        ? firstKindOf(center)
        : undefined
  const inner =
    view.inner !== undefined && insideKinds(kinds, frame).includes(view.inner)
      ? view.inner
      : undefined
  return { center, frame, inner, expanded: expansionsOf(center, frame, view.expanded ?? {}) }
}

/**
 * Whether a Tile opens onto something: a ring holding a Branch or a Leaf, or, holding neither, one
 * the reader may add to (`fills`). Holding nothing the reader may add to, its ring would be six free
 * slots that take nothing, so it opens nothing, as a Leaf.
 */
export function opens(tile: TileNode, fills: (tile: TileNode) => boolean): boolean {
  if (firstKindOf(tile) === undefined) return false
  const held = Object.keys({ ...tile.branches, ...tile.leaves }).length
  return held > 0 || fills(tile)
}

/**
 * Whether a Tile shows a Context: one it holds, or, holding none, one the reader may add to (`fills`).
 * A Leaf has none; holding none the reader may add to, its Context would be six free slots that take
 * nothing, so it shows none.
 */
export function showsContext(tile: TileNode, fills: (tile: TileNode) => boolean): boolean {
  if (!kindsOf(tile).includes('context')) return false
  return Object.keys(tile.context ?? {}).length > 0 || fills(tile)
}

/**
 * The view shown, each ring that would open onto nothing folded (`opens`, `showsContext`): the
 * center's Context hidden, the center alone unless its Context still shows inside it, and a Branch
 * of its ring closed.
 */
export function withoutEmptyRings(shown: ShownView, fills: (tile: TileNode) => boolean): ShownView {
  const { center } = shown
  const inner = shown.inner === 'context' && !showsContext(center, fills) ? undefined : shown.inner
  if (shown.frame !== undefined && inner === undefined && !opens(center, fills))
    return { ...shown, frame: undefined, inner, expanded: {} }
  const expanded: ShownView['expanded'] = {}
  for (const direction of directions) {
    const kind = shown.expanded[direction]
    const branch = center.branches?.[direction]
    if (kind === undefined || branch === undefined) continue
    const shows = kind === 'context' ? showsContext(branch, fills) : opens(branch, fills)
    if (shows) expanded[direction] = kind
  }
  return { ...shown, inner, expanded }
}

/** Whether a view opens something within the center's ring, a ring inside it or a Branch. */
const opensWithin = (view: CanvasView) =>
  view.inner !== undefined || Object.keys(view.expanded ?? {}).length > 0

/** The Branches of the ring `frame` around `center` that `wanted` opens, each into a kind it offers. */
function expansionsOf(
  center: TileNode,
  frame: OuterKind | undefined,
  wanted: Partial<Record<Direction, FrameKind>>,
): ShownView['expanded'] {
  const expanded: ShownView['expanded'] = {}
  // A Leaves ring holds no Branch; in a Children ring, as in a Branches one, a Branch sits where it sits.
  if (frame === undefined || frame === 'leaves') return expanded
  for (const direction of directions) {
    const kind = wanted[direction]
    const branch = center.branches?.[direction]
    if (kind === undefined || branch === undefined) continue
    expanded[direction] = kindsOf(branch).includes(kind) ? kind : firstKindOf(branch)
  }
  return expanded
}

/** The view in its shortest form: defaults left out, what no one would see dropped. */
function tidy(system: TileNode, view: CanvasView): CanvasView {
  const { center, frame, inner, expanded } = showView(system, view)
  return {
    ...(center === system ? {} : { center: center.id }),
    ...(frame === undefined ? {} : { frame }),
    ...(inner === undefined ? {} : { inner }),
    ...(Object.keys(expanded).length === 0 ? {} : { expanded }),
  }
}

/**
 * The view of `center` opened: its first ring around it and, past six, its Leaves inside it, the
 * shape's double expansion, so every child shows at once; nothing else open. A Leaf, which opens
 * nothing, stands alone.
 */
function openedOn(system: TileNode, center: string | undefined): CanvasView {
  const tile = showView(system, { center }).center
  const first = firstKindOf(tile)
  const inside = first === 'branches' && kindsOf(tile).includes('leaves') ? 'leaves' : undefined
  return tidy(system, { center, frame: first, inner: inside })
}

/**
 * Centers a Tile as a gesture does: opened, as `toggleCenter` opens it, so the Tiles around it
 * show as it arrives, nothing open in its ring. A Leaf, which has no ring, stands alone, its preview
 * whole. Only its own click folds a center (`toggleCenter`); a plain URL shows the root folded.
 */
export function centerOn(system: TileNode, id: string): CanvasView {
  return openedOn(system, id)
}

/**
 * Opens the center, or folds it back. Opened, its first ring shows around it and, past six, its
 * Leaves inside it; folded, it stands alone again, nothing around it, inside it or open. A centered
 * Leaf opens nothing.
 */
export function toggleCenter(system: TileNode, view: CanvasView): CanvasView {
  const { frame } = showView(system, view)
  if (frame !== undefined) return tidy(system, { center: view.center })
  return openedOn(system, view.center)
}

/**
 * Opens the Branch in this Direction of the ring around the center into its first ring, or closes it;
 * a folded center has no ring around to open one in.
 */
export function toggleExpanded(
  system: TileNode,
  view: CanvasView,
  direction: Direction,
): CanvasView {
  const shown = showView(system, view)
  if (shown.frame === undefined) return tidy(system, view)
  const { [direction]: open, ...others } = shown.expanded
  const branch = shown.center.branches?.[direction]
  const first = branch === undefined ? undefined : firstKindOf(branch)
  const expanded =
    open === undefined && first !== undefined ? { ...others, [direction]: first } : others
  return tidy(system, { ...view, expanded })
}

/** Shows the center's Context inside its hex, opening the center's first ring were it folded. */
export function withContext(system: TileNode, view: CanvasView): CanvasView {
  const { center, frame } = showView(system, view)
  return tidy(system, { ...view, frame: frame ?? firstKindOf(center), inner: 'context' })
}

/** The canvas's part of a page's search params. */
export function viewIn({ center, frame, inner, expanded }: CanvasView): CanvasView {
  return { center, frame, inner, expanded }
}

/** A page's search params with this view, every field of the canvas's set, the others kept. */
export function withViewIn<S extends CanvasView>(search: S, view: CanvasView): S {
  const { center, frame, inner, expanded } = view
  return { ...search, center, frame, inner, expanded }
}
