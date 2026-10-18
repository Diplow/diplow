// A write someone makes in a System not their own, which a Grant lets them write (HEX-132): Mapping
// runs it on that System as it decides they may, then its owner's timeline tells it, by the Title of
// the writer's star and who of theirs acted, offering its Undo, once, what undoes it kept with its
// Entry, all in the write's transaction, the owner's Conversation locked before their System, as an
// accept and an undo take the two. The writer's own timeline tells it too, as their own, once it
// committed: the bus carries where it was made (`changingIn`), which `../recording.ts` reads. And who
// acted, as a timeline shows it, which both read.
import { Effect, Option, Schema } from 'effect'

import type { OwnActor, Someone } from '#/domains/assistant/entities'
import * as AssistantUndo from '#/domains/assistant/undo/undo'
import { keyName, type SignedIn } from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { type Operation, Undo } from '#/domains/mapping/operations'

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
 * Runs a write the signed-in Account makes in someone else's System, the one `acting` names, as
 * Mapping decides it may there (`runUndoable`), in the transaction the caller opened: told in the
 * owner's timeline by who acted, offering its Undo once (`undo/`'s `writtenBySomeone`), each event
 * it publishes saying where it was made, for the writer's own timeline. `own` is the writer acting on
 * their own System, whose star names them; `across`, whether their request may pin a Tile of a third
 * System (Mapping's `Across`, the API layer's to say). Answers the Tile as it now stands for a create
 * or an edit.
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
    const owner = yield* Mapping.ownerOf(acting.system)
    const actor = yield* someoneOf(signed, own)
    const ran = yield* changingIn(acting.system)(
      AssistantUndo.writtenBySomeone(
        owner,
        actor,
        Effect.map(Mapping.runUndoable(acting, operation, { across }), (run) => ({
          ...run,
          undo: encodedUndo(run.undo),
        })),
      ),
    )
    return ran.tile
  })
