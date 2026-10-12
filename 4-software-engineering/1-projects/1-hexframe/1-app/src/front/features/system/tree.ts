// The System as the canvas draws it. Mapping keeps each Tile's Branches and Leaves by Direction and
// its Context by slot, −1 to −6, where a slot holds a Tile of its own or a Reference; the canvas takes
// TileNodes, with the same Branches and Leaves, a Leaf marked as one, and the Context keyed by
// Direction, each marked with what its light shows: the Root, a file, a Reference, broken or not. Pure: what the canvas shows of a Tile is decided here.
import { Result } from 'effect'

import { isVerbatim } from '#/api/mapping/files/download'
import {
  contextSlotOf,
  type ContextDirection,
  type Direction,
  directions,
  isContextSlot,
  isEmptySystem,
  isLeafSlot,
  type LeafTile,
  type Slot,
  type System,
  type SystemTile,
  tileAt,
} from '#/domains/mapping/entities'
import { decide, type Placement } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import type { FrameKind, TileNode } from '#/front/ui/canvas/view/tiles'
import { type CanvasView, showView } from '#/front/ui/canvas/view/view'

type ContextEntry = NonNullable<SystemTile['context'][ContextDirection]>

/**
 * A Tile's title as a reader sees it. Only the Root is ever untitled: Mapping adds it that way, until
 * the user names themselves.
 */
export const titleOf = (title: string) => (title === '' ? m.system_untitled() : title)

/**
 * The System's Tiles as the canvas draws them, from its Root down. A Leaf that isn't Markdown is
 * marked as a file's. A Reference is drawn as the Tile it points at, under that Tile's id, so
 * centering on it and acting on it reach the Tile itself, with where that Tile stands; a broken one
 * says so, under an id no Tile has. With `yours`, the Root is the user's, the Account's System's
 * and not Help's: named, untitled, or an empty System's (Mapping's `isEmptySystem`).
 */
export function canvasTree(root: SystemTile, { yours = false } = {}): TileNode {
  const tree = nodeOf(root, root)
  return yours ? { ...tree, root: rootOf(root) } : tree
}

const rootOf = (root: SystemTile): NonNullable<TileNode['root']> => {
  if (isEmptySystem(root)) return 'empty'
  return root.title === '' ? 'untitled' : 'named'
}

/** A Tile of the System `root` as the canvas draws it, with everything below it. */
function nodeOf(tile: SystemTile, root: SystemTile): TileNode {
  const branches: NonNullable<TileNode['branches']> = {}
  const leaves: NonNullable<TileNode['leaves']> = {}
  const context: NonNullable<TileNode['context']> = {}
  for (const direction of directions) {
    const branch = tile.branches[direction]
    if (branch !== undefined) branches[direction] = nodeOf(branch, root)
    const leaf = tile.leaves[direction]
    if (leaf !== undefined) leaves[direction] = leafNode(leaf)
    const entry = tile.context[contextSlotOf(direction)]
    if (entry !== undefined)
      context[direction] = contextNode(entry, `${tile.id}:${String(-direction)}`, root)
  }
  const { id, title, preview } = tile
  return { id, title: titleOf(title), preview, branches, leaves, context }
}

const leafNode = (leaf: LeafTile): TileNode => ({
  id: leaf.id,
  title: leaf.title,
  preview: leaf.preview,
  leaf: true,
  ...(isVerbatim(leaf) && { file: true }),
})

function contextNode(entry: ContextEntry, slot: string, root: SystemTile): TileNode {
  switch (entry._tag) {
    case 'Tile':
      return nodeOf(entry, root)
    case 'Reference': {
      // The Root stands under nothing: a Reference to it is from the Root itself.
      const above = tileIn(root, entry.tile.id)?.parent ?? entry.tile
      return {
        id: entry.tile.id,
        title: titleOf(entry.tile.title),
        preview: entry.tile.preview,
        reference: { from: titleOf(above.title) },
      }
    }
    case 'BrokenReference':
      return { id: `broken:${slot}`, title: m.tile_broken_title(), preview: '', broken: true }
  }
}

/**
 * The move of a Tile to a place, at the Version the System shows of it, the one the canvas drew; none
 * when the System holds no Tile of that id.
 */
export function moveOf(system: System, id: string, place: Placement) {
  const tile = tileAt(system, id)
  return tile === undefined ? undefined : { id, version: tile.version, ...place }
}

/**
 * The swap of the moving Tile with another, the moving one named first, as `movingIn` reads it, each
 * at the Version the System shows of it; none when either is no Tile of the System.
 */
export function swapOf(system: System, moving: string, held: string) {
  const a = tileAt(system, moving)
  const b = tileAt(system, held)
  if (a === undefined || b === undefined) return undefined
  return { a: moving, aVersion: a.version, b: held, bVersion: b.version }
}

/** The Tile a swap moves, the one the move under way named (`swapOf`). */
export const movingIn = (swap: { readonly a: string }) => swap.a

/**
 * Whether a Tile on the canvas offers to swap places with the moving one: a Tile drawn where it stands,
 * so no Reference, drawn under its Tile's id, and no Leaf, which only moves to a free slot or changes
 * kind from its card (`hexframe-app-import-export/decisions.md#DEC-13`); and a swap Mapping makes
 * something of. The rest is `decide`'s, Mapping's own rules on the System as the server read it: the
 * Root never moves, a Tile above or below the moving one would put one below itself, a broken
 * Reference names no Tile, and the moving Tile with itself changes nothing.
 */
export function swapsWith(system: System, moving: TileNode, tile: TileNode) {
  if (tile.reference !== undefined || tile.leaf === true) return false
  const swap = swapOf(system, moving.id, tile.id)
  if (swap === undefined) return false
  const swapped = decide(system, { _tag: 'SwapTiles', ...swap })
  return Result.isSuccess(swapped) && swapped.success.length > 0
}

/**
 * The slot an empty Direction of the canvas stands for, by the ring it is in and the Tile that goes
 * there: a new one, a moving Branch, or a moving Leaf, which stays a Leaf. A ring of Leaves holds
 * Leaf slots, so a new Tile there is a Leaf; a ring of Children holds both kinds, so its Direction is
 * a Branch's slot, or a Leaf's for a Leaf, both free there; a Context ring's is the Direction negated.
 * Nothing where a moving Tile would change kind, a Leaf in a ring of Branches or a Branch in a ring of
 * Leaves: a Tile changes kind from its card, in its own Direction.
 */
export function slotOf(ring: FrameKind, direction: Direction, going?: TileNode): Slot | undefined {
  const leaf = going?.leaf === true
  switch (ring) {
    case 'children':
      return leaf ? { leaf: direction } : direction
    case 'branches':
      return leaf ? undefined : direction
    case 'leaves':
      return going === undefined || leaf ? { leaf: direction } : undefined
    case 'context':
      return contextSlotOf(direction)
  }
}

/**
 * Whether an empty Direction of the canvas, in a ring of this kind, stands for this slot of Mapping's:
 * a ring of Children's for a Branch's slot and a Leaf's alike, a ring of Branches' for a Branch's, a
 * ring of Leaves' for a Leaf's, a Context ring's for the Direction negated.
 */
export function standsFor(ring: FrameKind, direction: Direction, slot: Slot): boolean {
  if (isContextSlot(slot)) return ring === 'context' && slot === contextSlotOf(direction)
  if (isLeafSlot(slot)) return (ring === 'children' || ring === 'leaves') && slot.leaf === direction
  return (ring === 'children' || ring === 'branches') && slot === direction
}

/**
 * Where a Tile stands: a Leaf in its Direction under its parent, or a Tile with what it holds, under
 * its parent in a Branch's Direction or a Context slot, or the Root, under nothing.
 */
export type Located =
  | { kind: 'leaf'; tile: LeafTile; parent: SystemTile; direction: Direction }
  | { kind: 'branch'; tile: SystemTile; parent: SystemTile; direction: Direction }
  | { kind: 'context'; tile: SystemTile; parent: SystemTile; slot: ContextDirection }
  | { kind: 'root'; tile: SystemTile; parent: undefined }

/**
 * The Tile of this id, anywhere in the System, Leaves and Context Tiles included, and where it stands
 * (`Located`); `undefined` when no Tile has it, as for a broken Reference.
 */
export function tileIn(system: SystemTile, id: string): Located | undefined {
  return system.id === id ? { kind: 'root', tile: system, parent: undefined } : below(system, id)
}

/** The Tile of this id below `parent`, at any depth, and where it stands. */
function below(parent: SystemTile, id: string): Located | undefined {
  for (const direction of directions) {
    const leaf = parent.leaves[direction]
    if (leaf?.id === id) return { kind: 'leaf', tile: leaf, parent, direction }
    const branch = parent.branches[direction]
    if (branch?.id === id) return { kind: 'branch', tile: branch, parent, direction }
    const slot = contextSlotOf(direction)
    const entry = parent.context[slot]
    const tile = entry?._tag === 'Tile' ? entry : undefined
    if (tile?.id === id) return { kind: 'context', tile, parent, slot }
    for (const next of [branch, tile]) {
      const found = next && below(next, id)
      if (found) return found
    }
  }
  return undefined
}

/** The Tiles a ring of this kind shows around, or inside, a Tile. */
function ringOf(tile: TileNode, kind: FrameKind | undefined): ReadonlyArray<TileNode> {
  const of = (ring: TileNode['branches']) =>
    directions.flatMap((direction) => ring?.[direction] ?? [])
  switch (kind) {
    case undefined:
      return []
    case 'children':
      return [...of(tile.branches), ...of(tile.leaves)]
    default:
      return of(tile[kind])
  }
}

/**
 * What a view of the System shows, by id: the centered Tile, the System's own when the view names
 * none it holds, and the Tiles on screen, the center first, then the ring around it, the ring inside
 * it, and the rings its opened Branches show, each once. What a Message sent from that view tells the
 * Assistant.
 */
export function onScreen(
  tree: TileNode,
  view: CanvasView,
): { readonly center: string; readonly shown: ReadonlyArray<string> } {
  const { center, frame, inner, expanded } = showView(tree, view)
  const opened = directions.flatMap((direction) => {
    const branch = center.branches?.[direction]
    return branch === undefined ? [] : ringOf(branch, expanded[direction])
  })
  const tiles = [center, ...ringOf(center, frame), ...ringOf(center, inner), ...opened]
  return { center: center.id, shown: [...new Set(tiles.map(({ id }) => id))] }
}
