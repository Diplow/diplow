// Mapping's rights decision: `may`, whether an actor may do something on a Tile, and what each
// Operation needs of the Tiles it names, carries and lands under. The service asks it before `decide`,
// so no refusal of `decide`'s says anything of a Tile the actor may not read. Pure: who the actor is
// comes from the API layer, the Grants from the tiles repository.
import { Result } from 'effect'

import {
  type Actor,
  below,
  type Grant,
  heldBy,
  type Lineage,
  lineageOf,
  owns,
  type Right,
  rightsOn,
  type Seen,
  type Sharing,
  sharingOf,
  type System,
  tileAt,
} from '../../entities'
import { BatchOutdated, NotAllowed, TileNotFound } from '../../errors'
import { afterOne, type Batched, type Folded, whole } from '../batch/fold'
import type { Operation } from '../operation'

/** Whether the actor has this right on the Tile of this id: `rightsOn`, asked of one right. */
export const may = (actor: Actor, sharing: Sharing, tile: string, right: Right) =>
  rightsOn(actor, sharing, tile).has(right)

/**
 * Whether rights on a Tile let their holder run the agent there, a Turn starting at it: *@*, which
 * includes *read*. What Mapping asks before a Turn starts (`agentAt`), and what the front offers the
 * agent's line and the composer's Tiles by.
 */
export const runsAgent = (rights: Iterable<Right>) => [...rights].includes('@')

/**
 * What an Operation needs: `read` on every Tile it names, of the System decided on, `write` on every
 * Tile it changes or carries and on the parent it goes under, and the parents a move or a swap puts
 * its Tiles under, by Tile. A Reference's target that the System does not hold is no Tile of it.
 */
interface Needs {
  readonly named: ReadonlyArray<string>
  readonly written: ReadonlyArray<string>
  readonly moved: ReadonlyMap<string, string>
}

/**
 * Where a Tile stands, by its parent's id, as whoever decides reads it: the parent a swap's Tile
 * takes, the other's; none for the star, which `decide` refuses to swap.
 */
type ParentOf = (id: string) => string | undefined

/** What each Operation needs of the System it is decided on. */
function needsOf(system: System, parentOf: ParentOf, operation: Operation): Needs {
  const none = new Map<string, string>()
  switch (operation._tag) {
    case 'CreateTile':
    case 'DeleteReference':
      return { named: [operation.parent], written: [operation.parent], moved: none }
    case 'CreateReference': {
      // A target another System holds is read there, by the service, before the System is locked.
      const { parent, target } = operation
      const named = tileAt(system, target) === undefined ? [parent] : [parent, target]
      return { named, written: [parent], moved: none }
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
      const [aParent, bParent] = [parentOf(a), parentOf(b)]
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
 * Whether the actor may change who reaches this Tile of the System, or read who does: its owner, from
 * a Session, never through a Key, a Turn's Key or an agent. An id the System holds no Tile of, a
 * Reference's included, which has no reach of its own, and a Tile the actor may not read are
 * `TileNotFound`, alike; with `read`, `NotAllowed`, which says nothing of who else reads it. A Tile of
 * a System hexframe ships is the service's to refuse first (`ShippedReadOnly`), as for an Operation,
 * since the shipped ids are no rule of the System.
 */
export function mayShare(
  actor: Actor,
  { system, sharing }: On,
  tile: string,
): Result.Result<void, TileNotFound | NotAllowed> {
  if (tileAt(system, tile) === undefined || !may(actor, sharing, tile, 'read')) {
    return Result.fail(new TileNotFound())
  }
  return mayOpen(actor, sharing) ? Result.void : Result.fail(new NotAllowed())
}

/**
 * Whether a Grant on the System may name this Account: anyone but its owner, who may do everything
 * there already, so a Grant to them would only list them among those it is shared with, `NotAllowed`.
 */
export const grantableTo = (sharing: Sharing, account: string): Result.Result<void, NotAllowed> =>
  account === sharing.owner ? Result.fail(new NotAllowed()) : Result.void

/**
 * Whether a change by anyone but the owner from a Session would delete one of these Tiles while it
 * carries a Grant. It may not: such a change is the one an undo undoes (an applied Turn's, an
 * accepted Proposal's, a write someone else made in the owner's System), and an undo makes a deleted
 * Tile again with no Grant, so a Tile kept from someone would come back open.
 */
const dropsGrants = (actor: Actor, sharing: Sharing, gone: ReadonlyArray<string>) =>
  !mayOpen(actor, sharing) && gone.some((id) => (sharing.grants.get(id)?.size ?? 0) > 0)

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
 * and a delete by anyone else over a Tile that carries a Grant.
 */
export function allowed(
  actor: Actor,
  { system, sharing }: On,
  operation: Operation,
): Result.Result<void, TileNotFound | NotAllowed> {
  const parentOf: ParentOf = (id) => sharing.lineage.get(id) ?? undefined
  const { named, written, moved } = needsOf(system, parentOf, operation)
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

/** What a System's rights are read from beside where its Tiles stand: its owner, and its Grants. */
export interface Granted {
  readonly owner: string
  readonly grants: ReadonlyArray<Grant>
}

/**
 * A batch folded whole over the System the actor runs it on, or adds to it: for its owner, every
 * right theirs, as `whole` folds it; for anyone else, each Operation once `allowed` found they may
 * make it on what the ones before it made, by the System's Grants and where each Tile stands then, a
 * Tile the batch made reading as its parent lets it. All of it, or the first refusal: `TileNotFound`
 * or `NotAllowed` as `allowed` answers, so a Grant taken back since refuses it, or `BatchOutdated`
 * once an Operation no longer applies. What the whole batch leaves is `allowedBatch`'s to rule on.
 */
export function allowedThrough(
  actor: Actor,
  { owner, grants }: Granted,
  system: System,
  batch: ReadonlyArray<Batched>,
): Result.Result<Folded, BatchOutdated | TileNotFound | NotAllowed> {
  if (owns(actor, owner)) return whole(system, batch)
  let folded: Folded = { system, events: [], left: [] }
  for (const batched of batch) {
    const on = {
      system: folded.system,
      sharing: sharingOf(owner, lineageOf(folded.system), grants),
    }
    const rights = allowed(actor, on, batched.operation)
    if (Result.isFailure(rights)) return Result.fail(rights.failure)
    const next = afterOne(folded.system, batched)
    if (Result.isFailure(next)) return Result.fail(new BatchOutdated())
    const { events, system: after } = next.success
    folded = { ...folded, system: after, events: [...folded.events, ...events] }
  }
  return Result.succeed(folded)
}

/**
 * Whether the rights a reader was shown on each Tile (`Seen`'s) let them make this Operation on the
 * System as they see it, as `allowed` asks them: *read* on every Tile it names, *write* on what it
 * changes, carries or goes under. A preview for the client, which offers a line of a System it visits
 * by it as it asks `decide`, never a guard: what the reader is not shown, a Tile kept from them below
 * one they write, who a move would open a Tile to, a Grant a delete would drop, is the service's to
 * refuse.
 */
export function shownAllowed(rights: Seen['rights'], system: System, operation: Operation) {
  const parentOf: ParentOf = (id) => {
    const found = tileAt(system, id)
    return found !== undefined && 'parent' in found ? found.parent : undefined
  }
  // A Reference has no rights of its own: the Tile holding it gives them, as `rightsOn` reads it.
  const held = (id: string, right: Right): boolean => {
    const shown = rights[id]
    if (shown !== undefined) return shown.includes(right)
    const reference = Object.hasOwn(system.tiles, id) ? system.tiles[id] : undefined
    return reference?._tag === 'Reference' && held(reference.parent, right)
  }
  const { named, written } = needsOf(system, parentOf, operation)
  return named.every((id) => held(id, 'read')) && written.every((id) => held(id, 'write'))
}
