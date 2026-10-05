// The canvas's view state, the shape's: which Tile is centered, the Frame kind of the ring around it,
// the ring inside its hex, and which Branches of the ring around it open, each into a Frame kind of
// its own, two generations deep. It lives in the URL, so a link shows what its sender saw. Every
// function here is pure; each change returns the next view, tidied, for the route to navigate to.
import { Effect, Schema } from 'effect'

import { directions, type Direction } from '../geometry/geometry'
import {
  findTile,
  firstKindOf,
  kindsOf,
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
const opened = Schema.optionalKey(
  orDefault(Schema.Literals(['children', 'branches', 'leaves', 'context'])),
)

/**
 * The view as the URL carries it, and the route's `validateSearch`. Every field is optional and an
 * absent one is its default, so a plain URL is the root with its first ring around it, nothing
 * inside it and nothing open. A link from before the shape's view, its expansions a list of ids,
 * keeps its center alone.
 */
export const CanvasView = Schema.Struct({
  /** The centered Tile's id; absent, the System's root. */
  center: Schema.optionalKey(orDefault(TileId)),
  /** The Frame kind of the ring around the center; absent, Children, or Branches past six. */
  frame: Schema.optionalKey(orDefault(Schema.Literals(['children', 'branches', 'leaves']))),
  /** The ring inside the center's hex; absent, none. */
  inner: Schema.optionalKey(orDefault(Schema.Literals(['leaves', 'context']))),
  /** The Branches of the ring around the center that open, by Direction, each into its Frame kind. */
  expanded: Schema.optionalKey(
    orDefault(Schema.Struct({ 1: opened, 2: opened, 3: opened, 4: opened, 5: opened, 6: opened })),
  ),
})

export type CanvasView = typeof CanvasView.Type

/** Reads the URL's search params, field by field: the route's `validateSearch`. */
export const readCanvasView = readSearch(CanvasView)

/**
 * The view resolved against a System: the centered Tile itself, the rings it shows, and what opens
 * around it. A centered Leaf has no ring, `frame` and `inner` undefined: it fills the view alone.
 */
export interface ShownView {
  center: TileNode
  frame: OuterKind | undefined
  inner: InnerKind | undefined
  expanded: Partial<Record<Direction, FrameKind>>
}

/** The rings the center can show: around it, among the kinds it offers, and inside it beside that. */
export interface RingChoices {
  around: OuterKind[]
  inside: InnerKind[]
}

/** Context goes inside any ring, Leaves only inside Branches: never the same kind in both. */
function insideKinds(kinds: readonly FrameKind[], frame: OuterKind | undefined): InnerKind[] {
  if (frame === undefined) return []
  return frame === 'branches' && kinds.includes('leaves') ? ['leaves', 'context'] : ['context']
}

/** The rings the shown center can show, for a medium to offer. */
export function ringChoices({ center, frame }: ShownView): RingChoices {
  const kinds = kindsOf(center)
  const around = kinds.filter((kind): kind is OuterKind => kind !== 'context')
  return { around, inside: insideKinds(kinds, frame) }
}

/**
 * The view resolved against the System. An unknown center falls back to the root, a ring it doesn't
 * offer to its first one, an inner ring that can't sit beside the outer one to none. Only a Branch of
 * the ring around the center opens, into a kind it offers, else into its first ring.
 */
export function showView(system: TileNode, view: CanvasView): ShownView {
  const center = (view.center === undefined ? undefined : findTile(system, view.center)) ?? system
  const kinds = kindsOf(center)
  const wanted = view.frame
  const frame = wanted !== undefined && kinds.includes(wanted) ? wanted : firstKindOf(center)
  const inner =
    view.inner !== undefined && insideKinds(kinds, frame).includes(view.inner)
      ? view.inner
      : undefined
  return { center, frame, inner, expanded: expansionsOf(center, frame, view.expanded ?? {}) }
}

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
    ...(frame === firstKindOf(center) ? {} : { frame }),
    ...(inner === undefined ? {} : { inner }),
    ...(Object.keys(expanded).length === 0 ? {} : { expanded }),
  }
}

/** Centers a Tile, with its first ring around it, nothing inside and nothing open. */
export function centerOn(system: TileNode, id: string): CanvasView {
  return tidy(system, { center: id })
}

/** Opens the Branch in this Direction of the ring around the center into its first ring, or closes it. */
export function toggleExpanded(
  system: TileNode,
  view: CanvasView,
  direction: Direction,
): CanvasView {
  const shown = showView(system, view)
  const { [direction]: open, ...others } = shown.expanded
  const branch = shown.center.branches?.[direction]
  const first = branch === undefined ? undefined : firstKindOf(branch)
  const expanded =
    open === undefined && first !== undefined ? { ...others, [direction]: first } : others
  return tidy(system, { ...view, expanded })
}

/** Shows this kind around the center. Its Branches are other Tiles, so none stays open. */
export function withFrame(system: TileNode, view: CanvasView, frame: OuterKind): CanvasView {
  return tidy(system, { ...view, frame, expanded: {} })
}

/** Shows this kind inside the center's hex, or nothing. */
export function withInner(
  system: TileNode,
  view: CanvasView,
  inner: InnerKind | undefined,
): CanvasView {
  return tidy(system, { ...view, inner })
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
