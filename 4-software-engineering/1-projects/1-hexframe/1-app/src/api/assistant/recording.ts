// The Conversation records every change to the System, whoever made it: the API layer, which alone
// composes domains, subscribes to Mapping's events on the bus and hands Assistant Mapping's own
// summary of each, with who acted, as the timeline shows them: "you", a Key by its name, or the
// Assistant. And a Tile someone shared, in the Conversation of the Account it was shared with, by
// the Title of the sharer's star. Wired in ../server/run.ts. The bus runs it once the write's
// transaction committed, inside the request through its `waitUntil`, and a reaction that fails is
// reported without touching the write it follows; a rolled-back write publishes nothing, so it lands
// nothing.
import { Effect, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import type { Actor } from '#/domains/assistant/entities'
import { keyName, type SignedIn } from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { MappingEvent } from '#/domains/mapping/operations'
import { TileShared } from '#/domains/mapping/sharing/sharing'
import { transactional } from '#/repositories/database/database'

import { on } from '../server/bus'
import { actingOnOwn } from '../mapping/programs'

/**
 * Who acted, as the timeline shows it: "you" for a Session, a Key by its name, read now, and the
 * Assistant for a Turn's Key.
 */
const actorOf = ({ account, by }: SignedIn) => {
  switch (by._tag) {
    case 'Session':
      return Effect.succeed<Actor>({ _tag: 'You' })
    case 'TurnKey':
      return Effect.succeed<Actor>({ _tag: 'Assistant' })
    case 'Key':
      return Effect.map(keyName(account.id, by.keyId), (name) =>
        Option.match(name, {
          onNone: (): Actor => ({ _tag: 'Key' }),
          onSome: (named): Actor => ({ _tag: 'Key', name: named }),
        }),
      )
  }
}

/**
 * Records each of Mapping's events as an Entry of the Conversation of the Account that acted. An event
 * nobody signed in made, which no door lets through, has no Conversation to land in.
 */
export const recordedInConversation = on(MappingEvent, (event, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      Effect.gen(function* () {
        const accountId = signedIn.account.id
        const summary = yield* Mapping.summary(
          yield* actingOnOwn(accountId, { session: false }),
          event,
        )
        const actor = yield* actorOf(signedIn)
        yield* transactional(Assistant.recordChange(accountId, summary, actor))
      }),
  }),
)

/**
 * Records a Tile shared, once a Grant first opened it to an Account, as an Entry of that Account's
 * Conversation: who shared it, by the Title their star has now, the Tile by the Title it had, and
 * what the Account may do there. Only a Session shares, so nobody signed in shares nothing.
 */
export const toldShared = on(TileShared, (shared, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: ({ account }) =>
      Effect.gen(function* () {
        const own = yield* actingOnOwn(account.id, { session: false })
        const [star] = yield* Mapping.glimpses(own, [own.system])
        yield* transactional(
          Assistant.recordShared(shared.account, {
            by: star?.title ?? '',
            tile: { id: shared.tile, title: shared.title },
            rights: shared.value,
          }),
        )
      }),
  }),
)
