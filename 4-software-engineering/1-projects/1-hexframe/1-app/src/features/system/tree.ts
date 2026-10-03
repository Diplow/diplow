// The System as the canvas draws it. Mapping keeps each Tile's Children by Direction and its Context
// by slot, −1 to −6, where a slot holds a Tile of its own or a Reference; the canvas takes TileNodes,
// whose Context is keyed by Direction. Pure: what the canvas shows of a Tile is decided here.
import type { SystemTile } from '#/api/domains/mapping/queries'
import { m } from '#/paraglide/messages'
import { directions, type Direction } from '#/ui/hex/geometry/geometry'
import type { Ring, TileNode } from '#/ui/hex/geometry/layout'

type ContextSlot = keyof SystemTile['context']
type ContextEntry = NonNullable<SystemTile['context'][ContextSlot]>

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
  const children: NonNullable<TileNode['children']> = {}
  const context: NonNullable<TileNode['context']> = {}
  for (const direction of directions) {
    const child = tile.children[direction]
    if (child !== undefined) children[direction] = canvasTree(child)
    const entry = tile.context[contextSlot[direction]]
    if (entry !== undefined)
      context[direction] = contextNode(entry, `${tile.id}:${String(-direction)}`)
  }
  return { id: tile.id, title: titleOf(tile.title), preview: tile.preview, children, context }
}

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

/** The slot a Tile takes under its parent: a Child's Direction, or its negation in the Context. */
export const slotOf = (ring: Ring, direction: Direction) =>
  ring === 'children' ? direction : contextSlot[direction]

/** Where a slot stands: among its parent's Children, 1 to 6, or in its Context, −1 to −6. */
export const ringOf = (slot: number): Ring => (slot > 0 ? 'children' : 'context')

/**
 * The Tile of this id, anywhere in the System, Context Tiles included, with the Tile it stands under;
 * `undefined` when no Tile has it, as for a broken Reference.
 */
export function tileIn(
  system: SystemTile,
  id: string,
  parent?: SystemTile,
): { tile: SystemTile; parent: SystemTile | undefined } | undefined {
  if (system.id === id) return { tile: system, parent }
  for (const direction of directions) {
    const entry = system.context[contextSlot[direction]]
    for (const below of [system.children[direction], entry?._tag === 'Tile' ? entry : undefined]) {
      const found = below && tileIn(below, id, system)
      if (found) return found
    }
  }
  return undefined
}
