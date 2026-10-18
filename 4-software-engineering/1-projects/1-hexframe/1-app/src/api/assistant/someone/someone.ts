// A write someone makes in a System not their own, which a Grant lets them write (HEX-132): Mapping
// runs it on that System as it decides they may, then its owner's timeline tells it, by the Title of
// the writer's star and who of theirs acted, offering its Undo, once, what undoes it kept with its
// Entry, all in the write's transaction, the owner's Conversation locked before their System, as an
// accept and an undo take the two. An Organization keeps no timeline, so a write in its System, its
// admin's or a member's, is told to nobody but the writer, and offers no Undo (HEX-136). The
// writer's own timeline tells it too, as their own, once it committed: the bus carries where it was
// made (`changingIn`), which `../recording.ts` reads. And who acted, as a timeline shows it, which
// both read.
import { Effect, Option, Schema } from 'effect'

import type { OwnActor, Someone } from '#/domains/assistant/entities'
import * as AssistantUndo from '#/domains/assistant/undo/undo'
import { keyName, type SignedIn } from '#/domains/iam/iam'
import { isOrganization } from '#/domains/iam/organizations/organizations'
import * as Mapping from '#/domains/mapping/mapping'
import { type Batched, type Operation, runAlone, Undo } from '#/domains/mapping/operations'

import { changingIn } from '../../server/bus'

const encodedUndo = Schema.encodeSync(Undo)

/**
 * Who acted, of the Account's own, as the timeline shows it: "you" for a Session, a Key by its name,
 * read now, and the Assistant for a Turn's Key.
 */
export const actorOf = ({ account, by }: SignedIn) => {
  switch (by._tag) {
    case 'Session':
      return Effect.succeed<OwnActor>({ _tag: 'You' })
    case 'TurnKey':
      return Effect.succeed<OwnActor>({ _tag: 'Assistant' })
    case 'Key':
      return Effect.map(keyName(account.id, by.keyId), (name) =>
        Option.match(name, {
          onNone: (): OwnActor => ({ _tag: 'Key' }),
          onSome: (named): OwnActor => ({ _tag: 'Key', name: named }),
        }),
      )
  }
}

/**
 * Who acted, as the owner's timeline shows a write someone else made there: that Account, by the
 * Title its own star has now, the card anyone sees, `''` while it has none, and who of theirs acted,
 * a Key of theirs by no name, the one they gave it being theirs alone.
 */
const someoneOf = (signed: SignedIn, own: Mapping.Acting) =>
  Effect.map(
    Effect.all([Mapping.glimpses(own, [own.system]), actorOf(signed)]),
    ([[star], acted]): Someone => ({
      _tag: 'Someone',
      star: star?.title ?? '',
      by: acted._tag === 'Key' ? { _tag: 'Key' } : acted,
    }),
  )

/**
 * Whose timeline is told of a write in the System a star names, other than the writer's: its owner's,
 * an Account's; none for an Organization's, which keeps none, whose admins are not told of every
 * write. `TileNotFound` for a star that names no System.
 */
export const toldOwner = (star: string) =>
  Effect.flatMap(Mapping.ownerOf(star), (owner) =>
    Effect.map(isOrganization(owner), (organization) => (organization ? undefined : owner)),
  )

/**
 * Runs a write the signed-in Account makes in someone else's System, the one `acting` names, as
 * Mapping decides it may there (`runUndoable`), in the transaction the caller opened: told in the
 * owner's timeline by who acted, offering its Undo once (`undo/`'s `writtenBySomeone`), none for an
 * Organization's System, whose owner keeps no timeline (`toldOwner`), each event it publishes saying
 * where it was made, for the writer's own timeline. `own` is the writer acting on their own System,
 * whose star names them; `across`, whether their request may pin a Tile of a third System (Mapping's
 * `Across`, the API layer's to say). Answers the Tile as it now stands for a create or an edit.
 */
export const writtenInAnothers = <O extends Operation>(
  signed: SignedIn,
  {
    acting,
    own,
    across,
  }: { readonly acting: Mapping.Acting; readonly own: Mapping.Acting; readonly across: boolean },
  operation: O,
) =>
  Effect.gen(function* () {
    const owner = yield* toldOwner(acting.system)
    const run = Mapping.runUndoable(acting, operation, { across })
    if (owner === undefined) return (yield* changingIn(acting.system)(run)).tile
    const actor = yield* someoneOf(signed, own)
    const ran = yield* changingIn(acting.system)(
      AssistantUndo.writtenBySomeone(
        owner,
        actor,
        Effect.map(run, (ran) => ({ ...ran, undo: encodedUndo(ran.undo) })),
      ),
    )
    return ran.tile
  })

/**
 * Runs a batch the signed-in Account makes in someone else's System, the one `acting` names, an
 * accepted Proposal of a Turn that worked there (HEX-134), in the transaction the caller opened,
 * whole or not at all: found to run as the writer may there, its star locked (Mapping's
 * `batchAllowed`), `BatchOutdated`, `TileNotFound` or `NotAllowed` otherwise, nothing run; then
 * each of its writes as `writtenInAnothers` runs one, in order, its owner told of each and offered
 * its Undo, the writer's own timeline told of each as made elsewhere. The owner's Conversation is
 * locked already, with the writer's, in one order, by Assistant's `acceptProposal`, its one caller's
 * step, before the System is. Answers how many writes it ran.
 */
export const batchInAnothers = (
  signed: SignedIn,
  { acting, own }: { readonly acting: Mapping.Acting; readonly own: Mapping.Acting },
  batch: ReadonlyArray<Batched>,
) =>
  Effect.gen(function* () {
    yield* Mapping.batchAllowed(acting, batch)
    // Found to run whole under the lock, each write runs as it was found to: a refusal is a defect.
    yield* Effect.forEach(
      batch,
      (batched) =>
        Effect.orDie(writtenInAnothers(signed, { acting, own, across: false }, runAlone(batched))),
      { discard: true },
    )
    return batch.length
  })
