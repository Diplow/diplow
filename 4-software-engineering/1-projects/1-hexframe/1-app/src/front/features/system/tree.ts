// The System as the canvas draws it. Mapping keeps each Tile's Branches and Leaves by Direction and
// its Context by slot, −1 to −6, where a slot holds a Tile of its own or a Reference; the canvas takes
// TileNodes, with the same Branches and Leaves, a Leaf marked as one, and the Context keyed by
// Direction. Pure: what the canvas shows of a Tile is decided here.
import type { Slot } from '#/api/mapping/mapping'
import type { SystemTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { directions, type Direction } from '#/front/ui/hex/geometry/geometry'
import type { FrameKind, TileNode } from '#/front/ui/hex/view/tiles'

type ContextSlot = keyof SystemTile['context']
type ContextEntry = NonNullable<SystemTile['context'][ContextSlot]>

/** A Leaf as the client holds it: a Tile with nothing below it. */
type LeafTile = NonNullable<SystemTile['leaves'][Direction]>

/** Each Direction's Context slot: the same Direction, negated. */
const contextSlot: Record<Direction, ContextSlot> = { 1: -1, 2: -2, 3: -3, 4: -4, 5: -5, 6: -6 }

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
    const entry = tile.context[contextSlot[direction]]
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
 * Whether a Tile on the canvas offers to swap places with the moving one: a Tile of the System drawn
 * where it stands, so neither a Reference nor a broken one, and neither the Root, which never moves,
 * nor the moving Tile itself, nor a Leaf, which only moves to a free slot or changes kind from its
 * card (`hexframe-app-import-export/decisions.md#DEC-13`). A Tile above or below the moving one offers
 * it too: Mapping refuses that swap, as it refuses a move below the Tile itself.
 */
export const swapsWith = (system: SystemTile, moving: TileNode, tile: TileNode) =>
  tile.reference !== true &&
  tile.leaf !== true &&
  tile.id !== system.id &&
  tile.id !== moving.id &&
  tileIn(system, tile.id) !== undefined

/**
 * The slot an empty Direction of the canvas stands for, by the ring it is in and the Tile that goes
 * there: a new one, a moving Branch, or a moving Leaf, which stays a Leaf. A ring of Leaves holds
 * Leaf slots, so a new Tile there is a Leaf; a ring of Children holds both kinds, so its Direction is
 * a Branch's slot, or a Leaf's for a Leaf, both free there; a Context ring's is the Direction negated.
 * Nothing where a moving Tile would change kind, a Leaf in a ring of Branches or a Branch in a ring of
 * Leaves: a Tile changes kind from its card, in its own Direction.
 */
export function slotOf(
  ring: FrameKind,
  direction: Direction,
  going?: TileNode,
): typeof Slot.Type | undefined {
  const leaf = going?.leaf === true
  switch (ring) {
    case 'children':
      return leaf ? { leaf: direction } : direction
    case 'branches':
      return leaf ? undefined : direction
    case 'leaves':
      return going === undefined || leaf ? { leaf: direction } : undefined
    case 'context':
      return contextSlot[direction]
  }
}

/** Whether a slot stands in its parent's Context, −1 to −6, rather than among its Branches or Leaves. */
export const isContextSlot = (slot: typeof Slot.Type) => typeof slot === 'number' && slot < 0

/**
 * Where a Tile stands: a Leaf in its Direction under its parent, or a Tile with what it holds, under
 * its parent in a Branch's Direction or a Context slot, or the Root, under nothing.
 */
export type Found =
  | { kind: 'leaf'; tile: LeafTile; parent: SystemTile; direction: Direction }
  | { kind: 'branch'; tile: SystemTile; parent: SystemTile; direction: Direction }
  | { kind: 'context'; tile: SystemTile; parent: SystemTile; slot: ContextSlot }
  | { kind: 'root'; tile: SystemTile; parent: undefined }

/**
 * The Tile of this id, anywhere in the System, Leaves and Context Tiles included, and where it stands
 * (`Found`); `undefined` when no Tile has it, as for a broken Reference.
 */
export function tileIn(system: SystemTile, id: string): Found | undefined {
  return system.id === id ? { kind: 'root', tile: system, parent: undefined } : below(system, id)
}

/** The Tile of this id below `parent`, at any depth, and where it stands. */
function below(parent: SystemTile, id: string): Found | undefined {
  for (const direction of directions) {
    const leaf = parent.leaves[direction]
    if (leaf?.id === id) return { kind: 'leaf', tile: leaf, parent, direction }
    const branch = parent.branches[direction]
    if (branch?.id === id) return { kind: 'branch', tile: branch, parent, direction }
    const slot = contextSlot[direction]
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

/**
 * Whether the System is empty, as Mapping adds it: its Root untitled, with nothing below it. Only an
 * empty System takes an import as its Root, which replaces the Root's Preview and Body, so a Root
 * that holds either, written before its name, is not offered one.
 */
export const isEmptySystem = (root: SystemTile) =>
  [root.title, root.preview, root.body].every((text) => text === '') && holdsNothing(root)

/** Whether nothing stands below a Tile: no Branch, no Leaf, no Context Tile nor Reference. */
export const holdsNothing = ({ branches, leaves, context }: SystemTile) =>
  [branches, leaves, context].every((below) => Object.keys(below).length === 0)

/** Whether a slot is a Leaf's, which takes one file alone and nothing below it. */
export const isLeafSlot = (slot: typeof Slot.Type) => typeof slot === 'object'
