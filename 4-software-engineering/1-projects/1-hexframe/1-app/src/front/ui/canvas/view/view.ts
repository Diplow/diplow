// The canvas's view state, the shape's: which Tile is centered, whether it stands alone, folded, or
// opens into a ring around it, the ring inside its hex, which Branches of the ring around it open,
// each into a Frame kind of its own, two generations deep, and which of the Tiles around it open,
// with theirs. It lives in the URL, so a link shows what its sender saw. Every function here is pure;
// each change returns the next view, tidied, for the route to navigate to.
import { Effect, Schema } from 'effect'

import { directions, type Direction } from '../geometry/geometry'
import {
  findTile,
  firstKindOf,
  frameKinds,
  innerKinds,
  kindsOf,
  outerKinds,
  pathTo,
  type FrameKind,
  type InnerKind,
  type OuterKind,
  type TileNode,
} from './tiles'

/**
 * How large a Tile is drawn, counted from the largest: 1, a Tile the canvas holds whole, the center
 * or one around it; 2, a Tile of the ring one of those opens into; 3, a Tile of the ring one of those
 * opens into, the smallest drawn. Magnitude 4 is never drawn, so a Tile of magnitude 3 never opens,
 * and going out a level folds what would be drawn there.
 */
type Magnitude = 1 | 2 | 3

/** The magnitude the ring of a Tile drawn at a magnitude is drawn at once it opens: none past 3. */
const ringAt = { 1: 2, 2: 3, 3: undefined } as const satisfies Record<
  Magnitude,
  Magnitude | undefined
>

/** Whether a Tile drawn at this magnitude may open: its ring stays within the smallest drawn. */
const opensAt = (magnitude: Magnitude) => ringAt[magnitude] !== undefined

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

/** A Branch of a ring, opened into a Frame kind; one the URL got wrong stays closed. */
const opened = Schema.optionalKey(orDefault(Schema.Literals(frameKinds)))

/** The Branches of a ring that open, by Direction, each into its Frame kind. */
const Expansions = Schema.Struct({
  1: opened,
  2: opened,
  3: opened,
  4: opened,
  5: opened,
  6: opened,
})

export type Expanded = Partial<Record<Direction, FrameKind>>

/** A Tile around the center, opened into its first ring, with the Branches of that ring that open. */
const besideOpened = Schema.optionalKey(orDefault(Expansions))

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
  expanded: Schema.optionalKey(orDefault(Expansions)),
  /**
   * The Tiles around the center that open, the others of the ring it stands in, by their Direction
   * there, each into its first ring, with the Branches of that ring that open, by Direction.
   */
  around: Schema.optionalKey(
    orDefault(
      Schema.Struct({
        1: besideOpened,
        2: besideOpened,
        3: besideOpened,
        4: besideOpened,
        5: besideOpened,
        6: besideOpened,
      }),
    ),
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
  expanded: Expanded
  /**
   * The Tile the center stands in, in the ring the canvas draws around it with the Tiles beside it;
   * none for the root, a Context Tile, or a Leaf shown inside the Tile it stands in.
   */
  parent: TileNode | undefined
  /**
   * The Tiles around the center that open, by their Direction in the ring it stands in, each with the
   * Branches of its ring that open; none where it stands in none.
   */
  around: Partial<Record<Direction, Expanded>>
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
 * Branch of the ring around the center opens, into a kind it offers but its Context, which the center alone shows, else into its first ring.
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
  const expanded = expansionsOf(center, frame, view.expanded ?? {})
  const parent = standingIn(system, center)
  return {
    center,
    frame,
    inner,
    expanded,
    parent,
    around: aroundOf(parent, center, view.around ?? {}),
  }
}

/**
 * The Tile a Tile stands in, where it stands in the ring around that one, as a Branch, or a Leaf of
 * its Children: the ring the canvas draws around the center when it is centered; none for the root,
 * a Context Tile, or a Leaf shown inside the Tile it stands in.
 */
function standingIn(system: TileNode, tile: TileNode): TileNode | undefined {
  const parent = pathTo(system, tile.id).at(-2)
  if (parent === undefined) return undefined
  const ring = directions.flatMap((direction) => [
    parent.branches?.[direction],
    ...(firstKindOf(parent) === 'children' ? [parent.leaves?.[direction]] : []),
  ])
  return ring.some((member) => member?.id === tile.id) ? parent : undefined
}

/**
 * The Tiles around `center` that `wanted` opens, the other Branches of the ring it stands in, each
 * into its first ring, with the Branches of that ring it opens, as a Branch of the center's opens.
 */
function aroundOf(
  parent: TileNode | undefined,
  center: TileNode,
  wanted: NonNullable<CanvasView['around']>,
): ShownView['around'] {
  const around: ShownView['around'] = {}
  for (const direction of directions) {
    const within = wanted[direction]
    const beside = parent?.branches?.[direction]
    if (within === undefined || beside === undefined || beside.id === center.id) continue
    const first = firstKindOf(beside)
    if (first !== undefined) around[direction] = expansionsOf(beside, first, within)
  }
  return around
}

/**
 * Whether the reader may add to a ring of a Tile, a free slot of it taking a new Tile: its Children,
 * or its Context, a ring of its own, which may take a new Tile where its Children are all taken.
 */
export type Fills = (tile: TileNode, ring: 'children' | 'context') => boolean

/**
 * Whether a Tile opens onto something: a ring holding a Branch or a Leaf, or, holding neither, one
 * the reader may add to (`fills`). Holding nothing the reader may add to, its ring would be six free
 * slots that take nothing, so it opens nothing, as a Leaf.
 */
export function opens(tile: TileNode, fills: Fills): boolean {
  if (firstKindOf(tile) === undefined) return false
  const held = Object.keys({ ...tile.branches, ...tile.leaves }).length
  return held > 0 || fills(tile, 'children')
}

/**
 * Whether a Tile shows a Context: one it holds, or, holding none, a Context the reader may add to
 * (`fills`).
 * A Leaf has none; holding none the reader may add to, its Context would be six free slots that take
 * nothing, so it shows none.
 */
export function showsContext(tile: TileNode, fills: Fills): boolean {
  if (!kindsOf(tile).includes('context')) return false
  return Object.keys(tile.context ?? {}).length > 0 || fills(tile, 'context')
}

/**
 * The view shown, each ring that would open onto nothing folded (`opens`, `showsContext`): the
 * center's Context hidden, the center alone unless its Context still shows inside it, and a Branch
 * of its ring closed.
 */
export function withoutEmptyRings(shown: ShownView, fills: Fills): ShownView {
  const { center, parent } = shown
  const inner = shown.inner === 'context' && !showsContext(center, fills) ? undefined : shown.inner
  const around: ShownView['around'] = {}
  for (const direction of directions) {
    const within = shown.around[direction]
    const beside = parent?.branches?.[direction]
    if (within === undefined || beside === undefined || !opens(beside, fills)) continue
    around[direction] = opening(beside, within, fills)
  }
  if (shown.frame !== undefined && inner === undefined && !opens(center, fills))
    return { ...shown, frame: undefined, inner, expanded: {}, around }
  return { ...shown, inner, expanded: opening(center, shown.expanded, fills), around }
}

/** The Branches of `tile`'s ring that `expanded` opens, but those that would open onto nothing. */
function opening(tile: TileNode, expanded: Expanded, fills: Fills): Expanded {
  const kept: Expanded = {}
  for (const direction of directions) {
    const kind = expanded[direction]
    const branch = tile.branches?.[direction]
    if (kind === undefined || branch === undefined) continue
    if (opens(branch, fills)) kept[direction] = kind
  }
  return kept
}

/** Whether a view opens something within the center's ring, a ring inside it or a Branch. */
const opensWithin = (view: CanvasView) =>
  view.inner !== undefined || Object.keys(view.expanded ?? {}).length > 0

/** The Branches of the ring `frame` around `center` that `wanted` opens, each into a kind it offers but Context. */
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
    // Only the center shows its Context: a Branch asked for its own opens into its first ring.
    const offered = kind !== 'context' && kindsOf(branch).includes(kind)
    expanded[direction] = offered ? kind : firstKindOf(branch)
  }
  return expanded
}

/** The view in its shortest form: defaults left out, what no one would see dropped. */
function tidy(system: TileNode, view: CanvasView): CanvasView {
  const { center, frame, inner, expanded, around } = showView(system, view)
  return {
    ...(center === system ? {} : { center: center.id }),
    ...(frame === undefined ? {} : { frame }),
    ...(inner === undefined ? {} : { inner }),
    ...(Object.keys(expanded).length === 0 ? {} : { expanded }),
    ...(Object.keys(around).length === 0 ? {} : { around }),
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
 * Centers a Tile the view draws, the camera moving to it and every Tile keeping the state it is drawn
 * in, opened or folded, as far as its magnitude there lets it open: the center, the Branches open
 * around it, the Tiles around it with theirs, and the Tile it stands in, which opens onto the way
 * down to it, as every Tile above it does. Going out a level, what would be drawn below magnitude 3
 * folds. A Tile the view doesn't draw lands as `centerOn` lands it, opened.
 */
export function recenter(system: TileNode, view: CanvasView, id: string): CanvasView {
  const shown = showView(system, view)
  const path = pathTo(system, id)
  const target = path.at(-1)
  if (target === undefined || target.id === shown.center.id) return tidy(system, view)
  const opened = openedIn(system, shown)
  if (!drawnIn(system, shown, opened, path)) return centerOn(system, id)
  const around: ShownView['around'] = {}
  const beside = standingIn(system, target)
  for (const direction of directions) {
    const tile = beside?.branches?.[direction]
    if (tile === undefined || tile.id === target.id || !opened.has(tile.id)) continue
    around[direction] = expansionsWithin(tile, opened, 1)
  }
  const rings = ringsOf(target, opened.get(target.id))
  const expanded = expansionsWithin(target, opened, 1)
  return tidy(system, { center: target.id, ...rings, expanded, around })
}

/**
 * Whether the view draws the Tile at the end of `path`: the center or a Tile above it, one beside it,
 * or one of a ring drawn opened, the center's, a Branch's or that of a Tile beside it.
 */
function drawnIn(
  system: TileNode,
  shown: ShownView,
  opened: ReadonlyMap<string, FrameKind>,
  path: readonly TileNode[],
): boolean {
  const above = pathTo(system, shown.center.id).slice(0, -1)
  const parent = path.at(-2)
  if (parent === undefined || above.some((tile) => tile.id === path.at(-1)?.id)) return true
  if (above.some((tile) => tile.id === parent.id)) return parent.id === shown.parent?.id
  return opened.has(parent.id)
}

/**
 * The ring each Tile drawn opened opens into, by its id: the center, the Branches open around it, the
 * Tiles around it and theirs, and each Tile above the center, opened onto the way down to it.
 */
function openedIn(system: TileNode, shown: ShownView): Map<string, FrameKind> {
  const opened = new Map<string, FrameKind>()
  const path = pathTo(system, shown.center.id)
  path.slice(0, -1).forEach((above, at) => {
    const below = path[at + 1]
    if (below !== undefined) opened.set(above.id, ringHolding(above, below))
  })
  const { center, frame, inner, parent } = shown
  if (frame !== undefined) opened.set(center.id, inner === 'context' ? 'context' : frame)
  const open = (tile: TileNode, expanded: Expanded) => {
    for (const direction of directions) {
      const branch = tile.branches?.[direction]
      const kind = expanded[direction]
      if (branch !== undefined && kind !== undefined) opened.set(branch.id, kind)
    }
  }
  open(center, shown.expanded)
  for (const direction of directions) {
    const beside = parent?.branches?.[direction]
    const within = shown.around[direction]
    if (beside === undefined || within === undefined) continue
    const first = firstKindOf(beside)
    if (first !== undefined) opened.set(beside.id, first)
    open(beside, within)
  }
  return opened
}

/**
 * The ring of `tile` that holds `below`: its Context, its Children, or its Branches or Leaves. A
 * Reference in its Context, drawn under the id of the Tile it points at, holds nothing.
 */
function ringHolding(tile: TileNode, below: TileNode): FrameKind {
  const held = (ring: TileNode['context']) =>
    directions.some((direction) => {
      const member = ring?.[direction]
      return member?.id === below.id && member.reference === undefined
    })
  if (held(tile.context)) return 'context'
  if (firstKindOf(tile) === 'children') return 'children'
  return held(tile.leaves) ? 'leaves' : 'branches'
}

/**
 * The rings a Tile centered opened into `kind` shows: its first one around it and its Context inside
 * for a way down through its Context, its Branches around it and its Leaves inside for one through a
 * Leaf past six, that ring alone otherwise; none for one folded.
 */
function ringsOf(tile: TileNode, kind: FrameKind | undefined): Pick<CanvasView, 'frame' | 'inner'> {
  if (kind === undefined) return {}
  if (kind === 'context') return { frame: firstKindOf(tile), inner: 'context' }
  if (kind === 'leaves' && kindsOf(tile).includes('branches')) {
    return { frame: 'branches', inner: 'leaves' }
  }
  return { frame: kind }
}

/**
 * The Branches of the ring `tile` opens into at `magnitude` that stand opened, each into the ring it
 * opens into, but Context: that ring is drawn a magnitude smaller, where a Branch opens only if its
 * magnitude lets it.
 */
function expansionsWithin(
  tile: TileNode,
  opened: ReadonlyMap<string, FrameKind>,
  magnitude: Magnitude,
): Expanded {
  const expanded: Expanded = {}
  const ring = ringAt[magnitude]
  if (ring === undefined || !opensAt(ring)) return expanded
  for (const direction of directions) {
    const branch = tile.branches?.[direction]
    const kind = branch && opened.get(branch.id)
    if (kind !== undefined && kind !== 'context') expanded[direction] = kind
  }
  return expanded
}

/**
 * The view of the Tile the center stands in, as the canvas draws it around the center: opened as
 * centering it opens it, each Tile beside the center that opens opened into its first ring; none for
 * a center that stands in no ring. What those open in turn is the shown view's `around`.
 */
export function aboveOf(system: TileNode, shown: ShownView): ShownView | undefined {
  const { parent } = shown
  if (parent === undefined) return undefined
  const expanded: Expanded = {}
  for (const direction of directions) {
    const beside = parent.branches?.[direction]
    const first = beside && firstKindOf(beside)
    if (shown.around[direction] !== undefined && first !== undefined) expanded[direction] = first
  }
  return showView(system, { ...centerOn(system, parent.id), expanded })
}

/**
 * Opens the center, or folds it back. Opened, its first ring shows around it and, past six, its
 * Leaves inside it; folded, it stands alone again, nothing around it, inside it or open. A centered
 * Leaf opens nothing. The Tiles around it stay as they are.
 */
export function toggleCenter(system: TileNode, view: CanvasView): CanvasView {
  const { frame } = showView(system, view)
  const { around } = view
  if (frame !== undefined) return tidy(system, { center: view.center, around })
  return tidy(system, { ...openedOn(system, view.center), around })
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

/**
 * The gesture to the center's next view, as the C key cycles them: alone, then opened into its ring,
 * then its Context shown inside it too, then alone again, on the view as it shows (`shown`). A step
 * that would show nothing is skipped, a ring that opens onto nothing (`opens`) or a Context that shows
 * none (`showsContext`); none where neither shows anything, the center staying alone.
 */
export function cycleOf(
  shown: ShownView,
  fills: Fills,
): 'expand' | 'show-context' | 'collapse' | undefined {
  const context = showsContext(shown.center, fills)
  if (shown.inner === 'context') return 'collapse'
  if (shown.frame !== undefined) return context ? 'show-context' : 'collapse'
  if (opens(shown.center, fills)) return 'expand'
  return context ? 'show-context' : undefined
}

/** The canvas's part of a page's search params. */
export function viewIn({ center, frame, inner, expanded, around }: CanvasView): CanvasView {
  return { center, frame, inner, expanded, around }
}

/** A page's search params with this view, every field of the canvas's set, the others kept. */
export function withViewIn<S extends CanvasView>(search: S, view: CanvasView): S {
  const { center, frame, inner, expanded, around } = view
  return { ...search, center, frame, inner, expanded, around }
}
