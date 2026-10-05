// Where an operation puts a Tile: a slot under a parent Tile, which a create, a move and an import
// each name. Pure.
import type { Slot } from '../entities'

/** Where a Tile goes: a slot under a parent Tile. */
export interface Placement {
  readonly parent: string
  readonly slot: Slot
}
