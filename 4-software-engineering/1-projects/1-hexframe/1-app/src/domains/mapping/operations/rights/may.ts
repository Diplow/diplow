// Mapping's rights decision: `may`, whether an actor may do something on a Tile, and what each
// Operation needs of the Tiles it names, carries and lands under. The service asks it before `decide`,
// so no refusal of `decide`'s says anything of a Tile the actor may not read. Pure: who the actor is
// comes from the API layer, the Grants from the tiles repository.
import { Result } from 'effect'

import {
  type Actor,
  below,
  heldBy,
  type Lineage,
  lineageOf,
  owns,
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
 * Whether, where the Tiles stand in `after`, a subject holds on one of these Tiles a right it did not
 * hold before: who may read it, write it or run the agent at it would change by no Grant its owner
 * set.
 */
function opens(before: Sharing, after: Lineage, tiles: ReadonlyArray<string>) {
  const moved: Sharing = { ...before, lineage: after }
  return before.subjects.some((subject) =>
    tiles.some((tile) => {
      const held = heldBy(before, subject, tile)
      return heldBy(moved, subject, tile).some((right) => !held.includes(right))
    }),
  )
}

/**
 * Whether moving these Tiles under these parents opens a Tile they carry to a subject. A move under a
 * Tile it carries opens nothing, since `decide` refuses it.
 */
function widens(system: System, sharing: Sharing, moved: ReadonlyMap<string, string>) {
  const carried = new Set([...moved.keys()].flatMap((id) => [...below(system, id)]))
  if ([...moved.values()].some((parent) => carried.has(parent))) return false
  return opens(sharing, new Map([...sharing.lineage, ...moved]), [...carried])
}

/**
 * Whether the actor may change who may do what on a Tile, as a Grant does: the owner, from a Session.
 */
const mayOpen = (actor: Actor, sharing: Sharing) => owns(actor, sharing.owner) && actor.session

/**
 * Whether a change without a Session would delete one of these Tiles while it carries a Grant. It may
 * not: such a change is the one an undo undoes (an applied Turn's, an accepted Proposal's), and an
 * undo makes a deleted Tile again with no Grant, so a Tile kept from someone would come back open.
 */
const dropsGrants = (actor: Actor, sharing: Sharing, gone: ReadonlyArray<string>) =>
  !actor.session && gone.some((id) => (sharing.grants.get(id)?.size ?? 0) > 0)

/** A System decided on, and how it is shared. */
interface On {
  readonly system: System
  readonly sharing: Sharing
}

/**
 * Whether the actor may make this Operation on the System it is decided on. Without `read` on a Tile
 * it names, `TileNotFound`, as for a Tile that isn't there. With `read`, but without `write` on what
 * it changes, carries or goes under, `NotAllowed`; and so is a move or a swap that would give someone
 * a right on a Tile they did not hold before, for anyone but the System's owner acting from a Session,
 * and a delete without a Session over a Tile that carries a Grant.
 */
export function allowed(
  actor: Actor,
  { system, sharing }: On,
  operation: Operation,
): Result.Result<void, TileNotFound | NotAllowed> {
  const { named, written, moved } = needsOf(system, sharing, operation)
  if (!named.every((id) => may(actor, sharing, id, 'read'))) return Result.fail(new TileNotFound())
  if (!written.every((id) => may(actor, sharing, id, 'write'))) return Result.fail(new NotAllowed())
  if (!mayOpen(actor, sharing) && widens(system, sharing, moved)) {
    return Result.fail(new NotAllowed())
  }
  const deleted = operation._tag === 'DeleteTile' ? [...below(system, operation.id)] : []
  return dropsGrants(actor, sharing, deleted) ? Result.fail(new NotAllowed()) : Result.void
}

/**
 * Whether the System's owner may run a batch, or an undo, that leaves it as `after`: from a Session
 * always; else only when no Tile that stood before it gives anyone a right they did not hold, a Tile
 * the batch makes opening nothing that stood, and none it deletes carries a Grant. `NotAllowed`
 * otherwise, the whole batch with it.
 */
export function allowedBatch(
  actor: Actor,
  sharing: Sharing,
  after: System,
): Result.Result<void, NotAllowed> {
  if (mayOpen(actor, sharing)) return Result.void
  const now = lineageOf(after)
  const stood = [...sharing.lineage.keys()]
  const kept = stood.filter((id) => now.has(id))
  const gone = stood.filter((id) => !now.has(id))
  return opens(sharing, now, kept) || dropsGrants(actor, sharing, gone)
    ? Result.fail(new NotAllowed())
    : Result.void
}
