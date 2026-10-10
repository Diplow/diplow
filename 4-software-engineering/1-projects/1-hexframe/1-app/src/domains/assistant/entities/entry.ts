// The Conversation's Entries: what its timeline holds, oldest first. A Message between the user and the
// agent; a change to the System, whoever made it; an import; and where the user went, consecutive
// navigations merged into one (./navigation.ts). A change and an import are recorded as Mapping
// summarized them when they happened, with who acted, and never rebuilt: the timeline is a record of
// the past. Assistant knows no Tile: a change names its verb and its Tiles as they came. Pure.
import { Schema } from 'effect'

import { Navigation } from './navigation'

/**
 * Who acted, as the timeline shows it: the user themselves, at one of their Sessions ("you"), or one
 * of their Keys, by its name, which a Key revoked before its write was recorded no longer has. The
 * Assistant's own Turns come next.
 */
export const Actor = Schema.Union([
  Schema.TaggedStruct('You', {}),
  Schema.TaggedStruct('Key', { name: Schema.optionalKey(Schema.String) }),
])

export type Actor = typeof Actor.Type

/** The most characters a Message holds. */
const longestMessage = 10_000

/** What a Message says: trimmed, never empty, at most 10,000 characters. */
export const MessageText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isLengthBetween(1, longestMessage),
)

/** A Message, by the user or by the agent. */
export const Message = Schema.TaggedStruct('Message', {
  author: Schema.Literals(['user', 'agent']),
  text: MessageText,
})

/** A Tile as a change names it: its id, and its Title when the change was made. */
const Named = Schema.Struct({ id: Schema.String, title: Schema.String })

/**
 * A change to the System: its verb, as Mapping names the event (`TileMoved`), the Tile it is about,
 * the other Tile a swap traded places with or a Reference points at, and who acted.
 */
export const Change = Schema.TaggedStruct('Change', {
  verb: Schema.String,
  tile: Named,
  other: Schema.optionalKey(Named),
  actor: Actor,
})

/** An import: the Tile it landed as, how many Tiles came with it, below it, and who imported it. */
export const Import = Schema.TaggedStruct('Import', {
  tile: Named,
  count: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_147_483_647 })),
  actor: Actor,
})

/** What an Entry says, whichever kind it is: what is stored of it, and what it is decoded by. */
export const EntryContent = Schema.Union([Message, Change, Import, Navigation])

export type EntryContent = typeof EntryContent.Type

/** An Entry of the Conversation: what it says, its id, and the instant it dates from. */
export type Entry = EntryContent & { readonly id: string; readonly at: Date }
