// The second half of Mapping's Decider: a System after one of its events. An event is a fact `decide`
// already ruled on, so `evolve` checks nothing and refuses nothing; an event naming what the System
// doesn't hold leaves it as it is. Each event counts on the Version of the Tile it changes: a create
// makes one at 1, an edit, a move and a swap add one to each Tile they change, and a Reference's create
// and delete to the Tile whose Context slot they change, a Reference having no Version of its own.
// Folded over the events `decide` made, it gives the System the service leaves in the database, and
// the one the client shows before the server answers. Pure.
import { Struct } from 'effect'

import {
  below,
  type FoundTile,
  type PlacedReference,
  type PlacedTile,
  type System,
  tileAt,
} from '../../entities'
import type { MappingEvent, TileEdited } from '../events'

type Held = PlacedTile | PlacedReference

/** The System with these Tiles and References placed, each replacing whatever held its id. */
const placing = (system: System, ...placed: ReadonlyArray<Held>): System => ({
  ...system,
  tiles: { ...system.tiles, ...Object.fromEntries(placed.map((held) => [held.id, held])) },
})

/** The System without the Tiles and References of these ids. */
const without = (system: System, ids: ReadonlySet<string>): System => ({
  ...system,
  tiles: Object.fromEntries(Object.entries(system.tiles).filter(([id]) => !ids.has(id))),
})

/** A Tile of the System below its Root, by its id; `undefined` for the Root, a Reference or none. */
const placedAt = (system: System, id: string) => {
  const found = tileAt(system, id)
  return found !== undefined && 'parent' in found ? found : undefined
}

/** A Tile one event further on: its Version one more. */
const counted = <T extends FoundTile>(tile: T): T => ({ ...tile, version: tile.version + 1 })

/** The System once an event changed the Tile of this id below its Root, as `change` makes it, counted. */
function changing(system: System, id: string, change: (tile: PlacedTile) => PlacedTile): System {
  const tile = placedAt(system, id)
  return tile === undefined ? system : placing(system, counted(change(tile)))
}

/**
 * The System once a Reference's create or delete changed a Context slot of the Tile of this id, the
 * Root's included: that Tile's Version counts it.
 */
const holding = (system: System, id: string): System =>
  id === system.root.id
    ? { ...system, root: counted(system.root) }
    : changing(system, id, (tile) => tile)

/** The System once a Tile says what an edit changed, the Root's own Title included. */
function edited(system: System, { id, ...changes }: Omit<TileEdited, '_tag'>): System {
  if (id === system.root.id) return { ...system, root: counted({ ...system.root, ...changes }) }
  return changing(system, id, (tile) => ({ ...tile, ...changes }))
}

/** The System once two Tiles traded places, each taking the other's parent and slot. */
function swapped(system: System, a: string, b: string): System {
  const first = placedAt(system, a)
  const second = placedAt(system, b)
  if (first === undefined || second === undefined) return system
  return placing(
    system,
    counted({ ...first, parent: second.parent, slot: second.slot }),
    counted({ ...second, parent: first.parent, slot: first.slot }),
  )
}

/** A System after one of its events. */
export function evolve(system: System, event: MappingEvent): System {
  switch (event._tag) {
    case 'TileCreated':
      return placing(system, { ...Struct.omit(event, ['_tag']), _tag: 'Tile', version: 1 })
    case 'TileEdited':
      return edited(system, Struct.omit(event, ['_tag']))
    case 'TileMoved':
      return changing(system, event.id, (tile) => ({
        ...tile,
        parent: event.parent,
        slot: event.slot,
      }))
    case 'TilesSwapped':
      return swapped(system, event.a, event.b)
    case 'TileDeleted':
      return placedAt(system, event.id) === undefined
        ? system
        : without(system, below(system, event.id))
    case 'ReferenceCreated':
      return holding(
        placing(system, { ...Struct.omit(event, ['_tag']), _tag: 'Reference' }),
        event.parent,
      )
    case 'ReferenceDeleted':
      return system.tiles[event.id]?._tag === 'Reference'
        ? holding(without(system, new Set([event.id])), event.parent)
        : system
  }
}
