// Who reaches a Tile, changed by its System's owner alone, from a Session: a Tile's Grant for
// Everyone, or for someone named by their star, set or removed, and who reaches the Tile read, each
// subject with its value and the Tile it comes from, each Account by its star, which the Share
// widget lists. It is no Operation: nothing proposes nor undoes it, and the System's Version stays
// where it was. A Grant that first opens a Tile to someone publishes `TileShared`, which the API
// layer tells in their timeline; no other change of who reaches a Tile says anything. A Tile's
// Grants are the owner's to set where its System is locked, so a move deciding who it opens a Tile
// to reads them as they stand (`../operations/rights/may.ts`). The API layer calls it as directly
// as the service, whose folder is full.
import { Effect, Schema } from 'effect'

import { Bus } from '#/domains/bus'
import { Tiles } from '#/repositories/database/tiles/tiles'

import {
  accountsIn,
  type GrantChange,
  lineageOf,
  namedBy,
  opens,
  originOn,
  reachOn,
  Reading,
  sharingOf,
  type Subject,
  subjectRowOf,
  type System,
  tileAt,
} from '../entities'
import { NotAllowed, TileNotFound } from '../errors'
import { type Acting, grantsIn, lockedOf, outsideShipped, ownerOf, wholeOf } from '../mapping'
import { mayShare } from '../operations'

/**
 * A Tile shared with an Account: a Grant its System's owner set first let them read it, or more. The
 * Tile, by its id and the Title it had then, the Account it was shared with, and what they may do
 * there now. A fact of Mapping's sharing, published on the bus, and no event of a System's, which it
 * leaves as it was: it says nothing of who shared it, which the bus's envelope carries.
 */
export class TileShared extends Schema.TaggedClass<TileShared>()('TileShared', {
  tile: Schema.String,
  title: Schema.String,
  account: Schema.String,
  value: Reading,
}) {}

/**
 * The System the actor acts on, read by `read`, and how it is shared, once `mayShare` found the actor
 * may change or read who reaches this Tile of it: its owner, from a Session. A Tile of a System
 * hexframe ships, Help's or the tutorial's, is refused first, `ShippedReadOnly`, as every Operation
 * naming one is (`outsideShipped`): read by Everyone for being shipped, its Grants nobody's.
 */
const sharedOn = <E, R>(
  acting: Acting,
  tile: string,
  read: (owner: string) => Effect.Effect<System, E, R>,
) =>
  Effect.gen(function* () {
    yield* outsideShipped([tile])
    const owner = yield* ownerOf(acting.system)
    const system = yield* read(owner)
    const sharing = sharingOf(owner, lineageOf(system), yield* grantsIn(owner))
    yield* Effect.fromResult(mayShare(acting.actor, { system, sharing }, tile))
    return { owner, system, sharing }
  })

/**
 * The subject a change names, as a Grant is kept for it: Everyone, or the Account a star stands for,
 * found by the star, `TileNotFound` for an id that names no star. The System's own owner is
 * `NotAllowed`: they may do everything there already, and a Grant to them would list them among
 * those it is shared with.
 */
const subjectOf = (named: GrantChange['subject'], owner: string) =>
  Effect.gen(function* () {
    if (named._tag === 'Everyone') return named satisfies Subject
    const account = yield* Tiles.use((tiles) => tiles.ownerOf(named.star))
    if (account === undefined) return yield* Effect.fail(new TileNotFound())
    if (account === owner) return yield* Effect.fail(new NotAllowed())
    return { _tag: 'Account', id: account } satisfies Subject
  })

/**
 * Sets a Tile's Grant for Everyone, `read` or `none`, or for an Account named by its star, any value,
 * in place of the one it had, or removes it, `inherit`, so the Tile's value comes from its parent
 * again: on the System the actor acts on, its star locked, by its owner from a Session alone, in the
 * transaction around it. A Grant that opens the Tile to an Account (`opens`) publishes `TileShared`,
 * which reaches the bus once that transaction commits.
 */
export const grant = (acting: Acting, change: GrantChange) =>
  Effect.gen(function* () {
    const { tile, value } = change
    const { owner, system, sharing } = yield* sharedOn(acting, tile, lockedOf)
    const subject = yield* subjectOf(change.subject, owner)
    const before = { subject, ...originOn(sharing, subject, tile) }
    const writes = (yield* Tiles).writes(owner)
    const named = subjectRowOf(subject)
    yield* value === 'inherit'
      ? writes.removeGrant(tile, named)
      : writes.setGrant({ tile, ...named, value })
    if (subject._tag !== 'Account' || !opens(before, tile, value)) return
    const title = tileAt(system, tile)?.title ?? ''
    const { publish } = yield* Bus
    yield* publish(new TileShared({ tile, title, account: subject.id, value }))
  })

/**
 * Who reaches a Tile of the System the actor acts on (`reachOn`): Everyone, and each subject a Grant
 * names that reaches it, with its value and the Tile it comes from, each Account by its star's card
 * (`namedBy`). Read by its owner from a Session alone, as a Grant is set, so nobody else learns who
 * reads it.
 */
export const whoReaches = (acting: Acting, tile: string) =>
  Effect.gen(function* () {
    const { sharing } = yield* sharedOn(acting, tile, wholeOf)
    const reaching = reachOn(sharing, tile)
    const stars = yield* Tiles.use((tiles) => tiles.starsOwnedBy(accountsIn(reaching)))
    return namedBy(reaching, stars)
  })
