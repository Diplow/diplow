// Mapping's rights decision: `may`, whether an actor may do something on a Tile, and what each
// Operation needs of the Tiles it names, carries and lands under. The service asks it before `decide`,
// so no refusal of `decide`'s says anything of a Tile the actor may not read. Pure: who the actor is
// comes from the API layer, the Grants from the tiles repository.
import { Result } from 'effect'

import {
  type Actor,
  below,
  owns,
  reads,
  type Right,
  rightsOn,
  type Sharing,
  type System,
} from '../../entities'
import { NotAllowed, TileNotFound } from '../../errors'
import type { Operation } from '../operation'

/** Whether the actor has this right on the Tile of this id: `rightsOn`, asked of one right. */
export const may = (actor: Actor, sharing: Sharing, tile: string, right: Right) =>
  rightsOn(actor, sharing, tile).has(right)

/**
 * What an Operation needs: `read` on every Tile it names, `write` on every Tile it changes or carries
 * and on the parent it goes under, and the parents a move or a swap puts its Tiles under, by Tile.
 */
interface Needs {
  readonly named: ReadonlyArray<string>
  readonly written: ReadonlyArray<string>
  readonly moved: ReadonlyMap<string, string>
}

/** A parent a swap's Tile takes, the other's: none for the star, which `decide` refuses to swap. */
const parentIn = (sharing: Sharing, id: string) => sharing.lineage.get(id) ?? undefined

/** What each Operation needs of the System it is decided on. */
function needsOf(system: System, sharing: Sharing, operation: Operation): Needs {
  const none = new Map<string, string>()
  switch (operation._tag) {
    case 'CreateTile':
    case 'DeleteReference':
      return { named: [operation.parent], written: [operation.parent], moved: none }
    case 'CreateReference':
      return {
        named: [operation.parent, operation.target],
        written: [operation.parent],
        moved: none,
      }
    case 'EditTile':
      return { named: [operation.id], written: [operation.id], moved: none }
    case 'DeleteTile':
      return { named: [operation.id], written: [...below(system, operation.id)], moved: none }
    case 'MoveTile': {
      const { id, parent } = operation
      return {
        named: [id, parent],
        written: [...below(system, id), parent],
        moved: new Map([[id, parent]]),
      }
    }
    case 'SwapTiles': {
      const { a, b } = operation
      const [aParent, bParent] = [parentIn(sharing, a), parentIn(sharing, b)]
      const moved = new Map<string, string>()
      if (bParent !== undefined) moved.set(a, bParent)
      if (aParent !== undefined) moved.set(b, aParent)
      return {
        named: [a, b],
        written: [...below(system, a), ...below(system, b), ...moved.values()],
        moved,
      }
    }
  }
}

/**
 * Whether moving these Tiles under these parents lets a subject read a Tile they carry that it could
 * not read before: a Tile inheriting from a new parent would otherwise be opened by no Grant its
 * owner set. A move under a Tile it carries opens nothing, since `decide` refuses it.
 */
function widens(system: System, sharing: Sharing, moved: ReadonlyMap<string, string>) {
  const carried = new Set([...moved.keys()].flatMap((id) => [...below(system, id)]))
  if ([...moved.values()].some((parent) => carried.has(parent))) return false
  const after: Sharing = { ...sharing, lineage: new Map([...sharing.lineage, ...moved]) }
  return sharing.subjects.some((subject) =>
    [...carried].some((tile) => reads(after, subject, tile) && !reads(sharing, subject, tile)),
  )
}

/**
 * Whether the actor may make this Operation on the System it is decided on. Without `read` on a Tile
 * it names, `TileNotFound`, as for a Tile that isn't there. With `read`, but without `write` on what
 * it changes, carries or goes under, `NotAllowed`; and so is a move or a swap that would let someone
 * read a Tile they could not before, for anyone but the System's owner acting from a Session.
 */
export function allowed(
  actor: Actor,
  { system, sharing }: { readonly system: System; readonly sharing: Sharing },
  operation: Operation,
): Result.Result<void, TileNotFound | NotAllowed> {
  const { named, written, moved } = needsOf(system, sharing, operation)
  if (!named.every((id) => may(actor, sharing, id, 'read'))) return Result.fail(new TileNotFound())
  if (!written.every((id) => may(actor, sharing, id, 'write'))) return Result.fail(new NotAllowed())
  const widening = !(owns(actor, sharing.owner) && actor.session)
  if (widening && widens(system, sharing, moved)) return Result.fail(new NotAllowed())
  return Result.void
}
