// The Conversation records every change to the System, whoever made it: the API layer, which alone
// composes domains, subscribes to Mapping's events on the bus and hands Assistant Mapping's own
// summary of each, with who acted, as the timeline shows them: "you", a Key by its name, or the
// Assistant (`./someone/`'s `actorOf`), a change made in someone else's System said so. And a Tile
// someone shared, in the Conversation of the Account it was shared with, by
// the Title of the sharer's star. Wired in ../server/run.ts. The bus runs it once the write's
// transaction committed, inside the request through its `waitUntil`, and a reaction that fails is
// reported without touching the write it follows; a rolled-back write publishes nothing, so it lands
// nothing.
import { Effect, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import * as Mapping from '#/domains/mapping/mapping'
import { rightsOf } from '#/domains/mapping/entities'
import { MappingEvent } from '#/domains/mapping/operations'
import { TileShared } from '#/domains/mapping/sharing/sharing'
import { transactional } from '#/repositories/database/database'

import { on } from '../server/bus'
import { actingOnOwn } from '../mapping/programs'
import { actorOf } from './someone/someone'

/**
 * Records each of Mapping's events as an Entry of the Conversation of the Account that acted, as
 * Mapping summarized it on the System it changed: the Account's own, or someone else's, where the
 * envelope says it was made (`elsewhere`), the Entry then saying so, its Tiles named as the Account
 * may see them there; that owner's timeline told it already, in the write's transaction
 * (`./someone/`). An event nobody signed in made, which no door lets through, has no Conversation to
 * land in.
 */
export const recordedInConversation = on(MappingEvent, (event, actor, elsewhere) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      Effect.gen(function* () {
        const accountId = signedIn.account.id
        const own = yield* actingOnOwn(accountId, { session: false })
        const where = Option.getOrUndefined(elsewhere)
        const summary = yield* Mapping.summary(
          where === undefined ? own : { ...own, system: where },
          event,
        )
        const actor = yield* actorOf(signedIn)
        yield* transactional(
          Assistant.recordChange(accountId, summary, actor, { elsewhere: where !== undefined }),
        )
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
            rights: rightsOf(shared.value),
          }),
        )
      }),
  }),
)
