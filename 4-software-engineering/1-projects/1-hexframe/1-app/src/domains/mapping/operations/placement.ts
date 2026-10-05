// Where an operation puts a Tile or a Reference: a slot under a parent Tile, a Context slot for a
// Reference. Pure: the Operations
// themselves, as data, grow beside it.
import type { ContextDirection, Slot } from '../entities'

/** Where a Tile or a Reference goes: a slot under a parent Tile. */
export interface Placement {
  readonly parent: string
  readonly slot: Slot
}

/** A Context slot, by the Tile that holds it: where a Reference stands. */
export interface ReferenceSlot extends Placement {
  readonly slot: ContextDirection
}
