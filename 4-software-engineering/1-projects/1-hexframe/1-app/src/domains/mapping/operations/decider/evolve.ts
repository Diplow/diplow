// The second half of Mapping's Decider: a System after one of its events. An event is a fact `decide`
// already ruled on, so `evolve` checks nothing and refuses nothing; an event naming what the System
// doesn't hold leaves it as it is. Folded over the events `decide` made, it gives the System the
// service leaves in the database, and the one the client shows before the server answers. Pure.
import { Struct } from 'effect'

import {
  below,
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

/** The System once a Tile says what an edit changed, the Root's own Title included. */
function edited(system: System, { id, ...changes }: Omit<TileEdited, '_tag'>): System {
  if (id === system.root.id) return { ...system, root: { ...system.root, ...changes } }
  const tile = placedAt(system, id)
  return tile === undefined ? system : placing(system, { ...tile, ...changes })
}

/** The System once two Tiles traded places, each taking the other's parent and slot. */
function swapped(system: System, a: string, b: string): System {
  const first = placedAt(system, a)
  const second = placedAt(system, b)
  if (first === undefined || second === undefined) return system
  return placing(
    system,
    { ...first, parent: second.parent, slot: second.slot },
    { ...second, parent: first.parent, slot: first.slot },
  )
}

/** A System after one of its events. */
export function evolve(system: System, event: MappingEvent): System {
  switch (event._tag) {
    case 'TileCreated':
      return placing(system, { ...Struct.omit(event, ['_tag']), _tag: 'Tile' })
    case 'TileEdited':
      return edited(system, Struct.omit(event, ['_tag']))
    case 'TileMoved': {
      const tile = placedAt(system, event.id)
      return tile === undefined
        ? system
        : placing(system, { ...tile, parent: event.parent, slot: event.slot })
    }
    case 'TilesSwapped':
      return swapped(system, event.a, event.b)
    case 'TileDeleted':
      return placedAt(system, event.id) === undefined
        ? system
        : without(system, below(system, event.id))
    case 'ReferenceCreated':
      return placing(system, { ...Struct.omit(event, ['_tag']), _tag: 'Reference' })
    case 'ReferenceDeleted':
      return system.tiles[event.id]?._tag === 'Reference'
        ? without(system, new Set([event.id]))
        : system
  }
}
