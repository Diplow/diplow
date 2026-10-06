// Where an operation puts a Tile: a slot under a parent Tile, which a create, a move and an import
// each name, and whether a System has that slot free. Pure.
import { Result } from 'effect'

import { heldAt, notLeaf, type Slot, type System, tileAt } from '../entities'
import { DirectionTaken, TileNotFound } from '../errors'

/** Where a Tile goes: a slot under a parent Tile. */
export interface Placement {
  readonly parent: string
  readonly slot: Slot
}

/**
 * The parent Tile of a placement in a System, once it is known to be a Tile of it, never a Reference,
 * to be no Leaf, which holds nothing, and its slot to be free.
 */
export const freeSlot = (system: System, { parent, slot }: Placement) =>
  Result.gen(function* () {
    const found = tileAt(system, parent)
    if (found === undefined) return yield* Result.fail(new TileNotFound())
    yield* notLeaf(found)
    if (heldAt(system, parent, slot) !== undefined) return yield* Result.fail(new DirectionTaken())
    return found
  })
