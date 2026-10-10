// The System as the canvas draws it. Mapping keeps each Tile's Branches and Leaves by Direction and
// its Context by slot, −1 to −6, where a slot holds a Tile of its own or a Reference; the canvas takes
// TileNodes, with the same Branches and Leaves, a Leaf marked as one, and the Context keyed by
// Direction. Pure: what the canvas shows of a Tile is decided here.
import { Result } from 'effect'

import {
  contextSlotOf,
  type ContextDirection,
  type Direction,
  directions,
  type LeafTile,
  type Slot,
  type System,
  type SystemTile,
  tileAt,
} from '#/domains/mapping/entities'
import { decide, type Placement } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import type { FrameKind, TileNode } from '#/front/ui/hex/view/tiles'

type ContextEntry = NonNullable<SystemTile['context'][ContextDirection]>

/**
 * A Tile's title as a reader sees it. Only the Root is ever untitled: Mapping adds it that way, until
 * the user names themselves.
 */
const titleOf = (title: string) => (title === '' ? m.system_untitled() : title)

/**
 * The System's Tiles as the canvas draws them, from `tile` down. A Reference is drawn as the Tile it
 * points at, under that Tile's id, so centering on it and acting on it reach the Tile itself; a broken
 * one says so, under an id no Tile has.
 */
export function canvasTree(tile: SystemTile): TileNode {
  const branches: NonNullable<TileNode['branches']> = {}
  const leaves: NonNullable<TileNode['leaves']> = {}
  const context: NonNullable<TileNode['context']> = {}
  for (const direction of directions) {
    const branch = tile.branches[direction]
    if (branch !== undefined) branches[direction] = canvasTree(branch)
    const leaf = tile.leaves[direction]
    if (leaf !== undefined) leaves[direction] = leafNode(leaf)
    const entry = tile.context[contextSlotOf(direction)]
    if (entry !== undefined)
      context[direction] = contextNode(entry, `${tile.id}:${String(-direction)}`)
  }
  const { id, title, preview } = tile
  return { id, title: titleOf(title), preview, branches, leaves, context }
}

const leafNode = ({ id, title, preview }: LeafTile): TileNode => ({
  id,
  title,
  preview,
  leaf: true,
})

function contextNode(entry: ContextEntry, slot: string): TileNode {
  switch (entry._tag) {
    case 'Tile':
      return canvasTree(entry)
    case 'Reference':
      return {
        id: entry.tile.id,
        title: titleOf(entry.tile.title),
        preview: entry.tile.preview,
        reference: true,
      }
    case 'BrokenReference':
      return { id: `broken:${slot}`, title: m.system_reference_broken(), preview: '' }
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
  if (tile.reference === true || tile.leaf === true) return false
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
