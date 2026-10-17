// Who reaches a Tile, changed by its System's owner alone, from a Session: a Tile's Grant for
// Everyone set or removed, and who reaches the Tile read, each subject with its value and the Tile it
// comes from, which the Share widget lists. It is no Operation: nothing proposes nor undoes it, it
// makes no event, so no timeline tells of it, and the System's Version stays where it was. A Tile's
// Grants are the owner's to set where its System is locked, so a move deciding who it opens a Tile to
// reads them as they stand (`../operations/rights/may.ts`). The API layer calls it as directly as the
// service, whose folder is full.
import { Effect } from 'effect'

import { Tiles } from '#/repositories/database/tiles/tiles'

import {
  type GrantChange,
  lineageOf,
  reachOn,
  sharingOf,
  subjectRowOf,
  type System,
  tileAt,
} from '../entities'
import { ShippedReadOnly, TileNotFound } from '../errors'
import { type Acting, grantsIn, lockedOf, ownerOf, wholeOf } from '../mapping'
import { mayShare } from '../operations'
import { isShippedId } from '../shipped/shipped'

/**
 * The System the actor acts on, read by `read`, and how it is shared, once Mapping found the actor
 * may change or read who reaches this Tile of it: its owner, from a Session (`mayShare`). A Tile of a
 * System hexframe ships, Help's or the tutorial's, is `ShippedReadOnly`, read by Everyone for being
 * shipped, its Grants nobody's; an id the System holds no Tile of, a Reference's included, and a
 * Tile the actor may not read are `TileNotFound`; anyone else, or the owner without a Session, is
 * `NotAllowed`.
 */
const sharedOn = <E, R>(
  acting: Acting,
  tile: string,
  read: (owner: string) => Effect.Effect<System, E, R>,
) =>
  Effect.gen(function* () {
    if (isShippedId(tile)) return yield* new ShippedReadOnly()
    const owner = yield* ownerOf(acting.system)
    const system = yield* read(owner)
    const sharing = sharingOf(owner, lineageOf(system), yield* grantsIn(owner))
    if (tileAt(system, tile) === undefined) return yield* new TileNotFound()
    yield* Effect.fromResult(mayShare(acting.actor, sharing, tile))
    return { owner, sharing }
  })

/**
 * Sets a Tile's Grant for Everyone, `read` or `none`, in place of the one it had, or removes it,
 * `inherit`, so the Tile's value comes from its parent again: on the System the actor acts on, its
 * star locked, by its owner from a Session alone, in the transaction around it.
 */
export const grant = (acting: Acting, { tile, subject, value }: GrantChange) =>
  Effect.gen(function* () {
    const { owner } = yield* sharedOn(acting, tile, lockedOf)
    const writes = (yield* Tiles).writes(owner)
    const named = subjectRowOf(subject)
    yield* value === 'inherit'
      ? writes.removeGrant(tile, named)
      : writes.setGrant({ tile, ...named, value })
  })

/**
 * Who reaches a Tile of the System the actor acts on (`reachOn`): Everyone, and each subject a Grant
 * names that reaches it, with its value and the Tile it comes from. Read by its owner from a Session
 * alone, as a Grant is set, so nobody else learns who reads it.
 */
export const whoReaches = (acting: Acting, tile: string) =>
  Effect.map(sharedOn(acting, tile, wholeOf), ({ sharing }) => reachOn(sharing, tile))
