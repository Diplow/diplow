// The Conversation records every change to the System, whoever made it: the API layer, which alone
// composes domains, subscribes to Mapping's events on the bus and hands Assistant Mapping's own
// summary of each, with who acted, as the timeline shows them. Wired in ../server/run.ts. The bus runs
// it once the write's transaction committed, inside the request through its `waitUntil`, and a
// reaction that fails is reported without touching the write it follows; a rolled-back write
// publishes nothing, so it lands nothing.
import { Effect, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import type { Actor, EntryContent } from '#/domains/assistant/entities'
import { keyName, type SignedIn } from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { MappingEvent } from '#/domains/mapping/operations'
import { transactional } from '#/repositories/database/database'

import { on } from '../server/bus'

/** Who acted, as the timeline shows it: "you" for a Session, a Key by its name, read now. */
const actorOf = ({ account, by }: SignedIn) =>
  by._tag === 'Session'
    ? Effect.succeed<Actor>({ _tag: 'You' })
    : Effect.map(keyName(account.id, by.keyId), (name) =>
        Option.match(name, {
          onNone: (): Actor => ({ _tag: 'Key' }),
          onSome: (named): Actor => ({ _tag: 'Key', name: named }),
        }),
      )

/** The Entry Mapping's summary of an event makes: an import's, or a change's. */
const entryOf = ({ verb, tile, other, count = 0 }: Mapping.Summary, actor: Actor): EntryContent =>
  verb === 'TilesImported'
    ? { _tag: 'Import', tile, count, actor }
    : { _tag: 'Change', verb, tile, ...(other !== undefined && { other }), actor }

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
        const summary = yield* Mapping.summary(accountId, event)
        const entry = entryOf(summary, yield* actorOf(signedIn))
        yield* transactional(Assistant.record(accountId, entry))
      }),
  }),
)
