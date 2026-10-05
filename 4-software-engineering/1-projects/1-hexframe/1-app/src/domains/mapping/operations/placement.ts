// Where an operation puts a Tile or a Reference: a slot under a parent Tile. Pure: the Operations
// themselves, as data, grow beside it.
import type { Slot } from '../entities'

/** Where a Tile or a Reference goes: a slot under a parent Tile. */
export interface Placement {
  readonly parent: string
  readonly slot: Slot
}
