// The Conversation's Entries: what its timeline holds, oldest first. A Message between the user and the
// agent; a change to the System, whoever made it; an import; where the user went, consecutive
// navigations merged into one (./navigation.ts); how a Turn ended, when not by its answer; a
// Proposal, the changes its agent drafted in ask, and how the user decided it; and a Tile someone
// shared with the user, which lives in their System, not the user's. A change and an import
// are recorded as Mapping summarized them when they happened, with who acted, and never rebuilt: the
// timeline is a record of the past; a Proposal's Entry alone follows it until the user decides it.
// Assistant knows no Tile: a change names its verb and its Tiles as they came. Pure.
import { Schema } from 'effect'

import { linksOf } from './message/links'
import { Navigation } from './navigation'
import { Fate } from './proposal/proposal'
import { BadEnd } from './turn/turn'

/**
 * Who acted of an Account's own, as its timeline shows it: the user themselves, at one of their
 * Sessions ("you"); one of their Keys, by its name, which a Key revoked before its write was recorded
 * no longer has; or the Assistant, in one of their Turns, by its Turn's Key.
 */
export const OwnActor = Schema.Union([
  Schema.TaggedStruct('You', {}),
  Schema.TaggedStruct('Key', { name: Schema.optionalKey(Schema.String) }),
  Schema.TaggedStruct('Assistant', {}),
])

export type OwnActor = typeof OwnActor.Type

/**
 * Someone else, writing in the user's System: another Account, by the Title its star had when the
 * write was recorded, `''` for one not named yet, and who acted of theirs, the Account itself, one of
 * its Keys, or its Assistant.
 */
const Someone = Schema.TaggedStruct('Someone', { star: Schema.String, by: OwnActor })

/** Who acted, as the timeline shows it: one of the user's own (`OwnActor`), or someone else. */
export const Actor = Schema.Union([...OwnActor.members, Someone])

export type Actor = typeof Actor.Type

/** The most characters a Message holds. */
const longestMessage = 10_000

/** What a Message says: trimmed, never empty, at most 10,000 characters. */
export const MessageText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isLengthBetween(1, longestMessage),
)

/**
 * What the agent said, as a Message holds it: trimmed and cut to the longest a Message holds; none
 * when it said nothing but blanks.
 */
export function agentText(said: string): string | undefined {
  const text = said.trim().slice(0, longestMessage).trimEnd()
  return text === '' ? undefined : text
}

/** A Message, by the user or by the agent. */
const Message = Schema.TaggedStruct('Message', {
  author: Schema.Literals(['user', 'agent']),
  text: MessageText,
})

/** A Tile as a change names it: its id, and its Title when the change was made. */
const Named = Schema.Struct({ id: Schema.String, title: Schema.String })

/**
 * What a change did, as Mapping summarized it: its verb, as Mapping names the event (`TileMoved`), the
 * Tile it is about, and the other Tile a swap traded places with or a Reference points at.
 */
const changed = {
  verb: Schema.String,
  tile: Named,
  other: Schema.optionalKey(Named),
}

/**
 * A change to a System, as Mapping summarized it, and who acted. Made by the user in someone else's
 * System, it says so (`elsewhere`), its Tiles standing there, not in the user's. Made by someone else
 * in the user's, it offers its Undo, once (`undone`, false until the user undid it), what undoes it
 * kept with it.
 */
const Change = Schema.TaggedStruct('Change', {
  ...changed,
  actor: Actor,
  elsewhere: Schema.optionalKey(Schema.Literal(true)),
  undone: Schema.optionalKey(Schema.Boolean),
})

/**
 * A change an agent drafted into a Proposal, as Mapping summarized it on the System the Proposal
 * makes: no one has made it yet, so no one acted.
 */
export const ProposedChange = Schema.TaggedStruct('Change', changed)

export type ProposedChange = typeof ProposedChange.Type

/**
 * A Proposal: the changes the agent drafted in ask, in the order it drafted them, as Mapping summarized
 * each, and how the user decided it, open until they do, and, once accepted with what undoes it
 * kept, whether the user undid it. Its Entry dates from its first draft, and follows it: each later
 * draft adds its changes, the user's decision its fate, and an undo says so.
 */
const Proposal = Schema.TaggedStruct('Proposal', {
  proposal: Schema.String,
  changes: Schema.Array(ProposedChange),
  fate: Fate,
  undone: Schema.optionalKey(Schema.Boolean),
})

/**
 * What a Turn in apply wrote, told once it ended: the Turn, how many changes its writes made, and
 * whether the user undid them. Each change has its own Entry besides, by the Assistant.
 */
const TurnApplied = Schema.TaggedStruct('TurnApplied', {
  turn: Schema.String,
  changes: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_147_483_647 })),
  undone: Schema.Boolean,
})

/** An import: the Tile it landed as, how many Tiles came with it, below it, and who imported it. */
const Import = Schema.TaggedStruct('Import', {
  tile: Named,
  count: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_147_483_647 })),
  actor: Actor,
})

/** A Turn that ended otherwise than by its answer, and how: a Stop, a limit, its time, its sandbox. */
const TurnEnded = Schema.TaggedStruct('TurnEnded', { how: BadEnd })

/**
 * A right a Tile shared gives the user there, as the API layer hands it over: read it, write it, or
 * run the agent at it, `@`.
 */
export const SharedRight = Schema.Literals(['read', 'write', '@'])

export type SharedRight = typeof SharedRight.Type

/**
 * A Tile someone shared with the user, as the API layer told it when a Grant first opened it to
 * them: who shared it, by the Title of their star then, the Tile, by its id and the Title it had
 * then, in their System, and the rights the user has there, in order. Changing it later, or taking it
 * back, says nothing.
 */
const Shared = Schema.TaggedStruct('Shared', {
  by: Schema.String,
  tile: Named,
  rights: Schema.Array(SharedRight),
})

export type Shared = typeof Shared.Type

/** What an Entry says, whichever kind it is: what is stored of it, and what it is decoded by. */
export const EntryContent = Schema.Union([
  Message,
  Change,
  Import,
  Navigation,
  TurnEnded,
  Proposal,
  TurnApplied,
  Shared,
])

export type EntryContent = typeof EntryContent.Type

/** An Entry of the Conversation: what it says, its id, and the instant it dates from. */
export type Entry = EntryContent & { readonly id: string; readonly at: Date }

/**
 * A change or an import as Mapping summarized it, before Assistant says who acted: the shape
 * Assistant reads Mapping's summary by, which Mapping's own satisfies.
 */
export type Summarized =
  Omit<typeof Change.Type, 'actor' | 'elsewhere' | 'undone'> | Omit<typeof Import.Type, 'actor'>

/** A change as Mapping summarized it, never an import: what a write someone else made changed. */
export type SummarizedChange = Extract<Summarized, { readonly _tag: 'Change' }>

/** The most an Entry may date back, in milliseconds: a day. */
const longestAgo = 24 * 60 * 60_000

/**
 * How long before it reached the server an Entry happened, in milliseconds, a day at most: what a
 * merged navigation says of its last gesture.
 */
export const Ago = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: longestAgo }))

/** A span of milliseconds brought within what `Ago` takes: never ahead, a day back at most. */
export const within = (ago: number) => Math.min(Math.max(ago, 0), longestAgo)

/**
 * The Tiles some Entries name by their id alone, each once: those their navigations went to, and those
 * their Messages link. The Titles a reader joins in.
 */
export const namedTiles = (entries: ReadonlyArray<Entry>): ReadonlyArray<string> => [
  ...new Set(
    entries.flatMap((entry) => {
      if (entry._tag === 'Navigation') return entry.steps.map(({ tile }) => tile)
      if (entry._tag === 'Message') return linksOf(entry.text)
      return []
    }),
  ),
]
