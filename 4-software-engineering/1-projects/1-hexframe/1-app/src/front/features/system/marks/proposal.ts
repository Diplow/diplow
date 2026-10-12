// What the agent's open Proposal would do to the System, as the canvas draws it (HEX-108's proposal,
// built in HEX-109): each Tile it would create, a ghost in the slot it would take; each Tile already
// there it would edit, move or delete; and each move, from the Tile to where it would land. Read off
// the events Mapping's `fold` makes of the Proposal's writes on the System the page shows, so a write
// that no longer applies draws nothing, as accepting it would refuse it, and a Tile the Proposal
// creates then moves, renames or deletes stands where, as and whether the Proposal leaves it. Pure.
import type { Slot, System } from '#/domains/mapping/entities'
import { type Batched, fold, type OperationEvent } from '#/domains/mapping/operations'
import type { TileMark } from '#/front/ui/canvas/tile/marks/mark'

/** What a Proposal would do to a Tile already there; one it creates is a ghost of its own. */
type ProposedChange = NonNullable<TileMark['proposed']>

/** A Tile a Proposal would create: where it would stand, its Title and its Preview. */
interface Ghost {
  readonly parent: string
  readonly slot: Slot
  readonly title: string
  readonly preview: string
}

/** What an open Proposal would do, as the canvas draws it. */
export interface Proposed {
  /** Each Tile it would create, by the id it would make. */
  readonly ghosts: ReadonlyMap<string, Ghost>
  /** What it would do to each Tile already there, by its id: the weightiest change wins, a deletion over a move over an edit. */
  readonly changes: ReadonlyMap<string, ProposedChange>
  /** Each Tile already there it would move, by its id: where it would land. */
  readonly moves: ReadonlyMap<string, { readonly parent: string; readonly slot: Slot }>
}

/** How much a change says of a Tile: a deletion over a move, a move over an edit. */
const weight: Record<ProposedChange, number> = { edit: 0, move: 1, delete: 2 }

/** Builds what a Proposal would do, one of Mapping's events after the other. */
interface Building {
  ghosts: Map<string, Ghost>
  changes: Map<string, ProposedChange>
  moves: Map<string, { parent: string; slot: Slot }>
}

/** A Tile already there marked with a change, unless it already carries a weightier one. */
function marked(building: Building, id: string, change: ProposedChange) {
  const before = building.changes.get(id)
  if (before === undefined || weight[change] >= weight[before]) building.changes.set(id, change)
}

/** One of the Proposal's events, applied to what it would do so far. */
function withEvent(building: Building, event: OperationEvent): Building {
  const { ghosts, moves } = building
  switch (event._tag) {
    case 'TileCreated':
      ghosts.set(event.id, {
        parent: event.parent,
        slot: event.slot,
        title: event.title,
        preview: event.preview,
      })
      return building
    case 'TileEdited': {
      const ghost = ghosts.get(event.id)
      if (ghost === undefined) marked(building, event.id, 'edit')
      else ghosts.set(event.id, { ...ghost, ...definedOf(event) })
      return building
    }
    case 'TileMoved': {
      const ghost = ghosts.get(event.id)
      const place = { parent: event.parent, slot: event.slot }
      if (ghost !== undefined) ghosts.set(event.id, { ...ghost, ...place })
      else {
        marked(building, event.id, 'move')
        moves.set(event.id, place)
      }
      return building
    }
    case 'TileDeleted':
      if (!ghosts.delete(event.id)) {
        marked(building, event.id, 'delete')
        moves.delete(event.id)
      }
      return building
    // A swap and a Reference: the proposal drew neither (decisions.md#DEC-49).
    case 'TilesSwapped':
    case 'ReferenceCreated':
    case 'ReferenceDeleted':
      return building
  }
}

/** The Title and Preview an edit gives a ghost, those it leaves alone left out. */
const definedOf = ({ title, preview }: { title?: string; preview?: string }) => ({
  ...(title !== undefined && { title }),
  ...(preview !== undefined && { preview }),
})

/**
 * What an open Proposal would do to the System the page shows: its writes folded over it by Mapping,
 * and each event read as the canvas draws it. Nothing for a Proposal none of whose writes applies.
 */
export function proposedOf(system: System, writes: ReadonlyArray<Batched>): Proposed {
  const { events } = fold(system, writes)
  return events.reduce<Building>(withEvent, {
    ghosts: new Map(),
    changes: new Map(),
    moves: new Map(),
  })
}
