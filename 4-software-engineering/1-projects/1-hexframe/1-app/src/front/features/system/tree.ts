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
 * nor the moving Tile itself, nor a Leaf, which trades places through its own actions (HEX-61). A
 * Tile above or below the moving one offers it too: Mapping refuses that swap, as it refuses a move
 * below the Tile itself.
 */
export const swapsWith = (system: SystemTile, moving: TileNode, tile: TileNode) =>
  tile.reference !== true &&
  tile.leaf !== true &&
  tile.id !== system.id &&
  tile.id !== moving.id &&
  tileIn(system, tile.id) !== undefined

/**
 * The slot a Tile takes under its parent, by the ring it is placed in: a Branch's Direction, in a ring
 * of Children or of Branches; a Leaf's, `{ leaf: n }`; or the Direction's negation in the Context.
 */
export function slotOf(ring: FrameKind, direction: Direction): typeof Slot.Type {
  switch (ring) {
    case 'children':
    case 'branches':
      return direction
    case 'leaves':
      return { leaf: direction }
    case 'context':
      return contextSlot[direction]
  }
}

/**
 * Where a slot stands: among its parent's Children, a Branch's 1 to 6 or a Leaf's, or in its Context,
 * −1 to −6.
 */
export const ringOf = (slot: typeof Slot.Type): 'children' | 'context' =>
  typeof slot === 'number' && slot < 0 ? 'context' : 'children'

/**
 * The Tile of this id, anywhere in the System, Leaves and Context Tiles included, with the Tile it
 * stands under; `undefined` when no Tile has it, as for a broken Reference.
 */
export function tileIn(
  system: SystemTile,
  id: string,
  parent?: SystemTile,
): { tile: SystemTile | LeafTile; parent: SystemTile | undefined } | undefined {
  if (system.id === id) return { tile: system, parent }
  for (const direction of directions) {
    const leaf = system.leaves[direction]
    if (leaf?.id === id) return { tile: leaf, parent: system }
    const entry = system.context[contextSlot[direction]]
    for (const below of [system.branches[direction], entry?._tag === 'Tile' ? entry : undefined]) {
      const found = below && tileIn(below, id, system)
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
export const isEmptySystem = ({ title, preview, body, branches, leaves, context }: SystemTile) =>
  [title, preview, body].every((text) => text === '') &&
  [branches, leaves, context].every((below) => Object.keys(below).length === 0)

/** Whether a slot is a Leaf's, which takes one file alone and nothing below it. */
export const isLeafSlot = (slot: typeof Slot.Type) => typeof slot === 'object'
