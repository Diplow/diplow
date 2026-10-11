// The Mode a Conversation is in, as in Claude Code, and the Proposal its agent's writes become in ask:
// kept as a draft over the System, at most one open per Conversation, which a Message sent meanwhile
// continues, until the user accepts it whole or discards it. Assistant keeps a Proposal's writes as
// the API layer hands them, opaque: what they do to the System is Mapping's to say. Pure.
import { Schema } from 'effect'

/**
 * How a Conversation's Turns write: *ask*, the default, drafts their writes into a Proposal the user
 * decides on; *apply* runs them as they come. A Turn takes the Mode its Conversation is in as it starts.
 */
export const Mode = Schema.Literals(['ask', 'apply'])

export type Mode = typeof Mode.Type

/** The Mode of a Conversation nobody switched yet. */
export const firstMode: Mode = 'ask'

/** How the user decides an open Proposal: accepted whole, or discarded. */
export const Decision = Schema.Literals(['accepted', 'discarded'])

/**
 * How a Proposal stands: open, waiting for the user; how the user decided it; or undone, accepted
 * then undone by the user.
 */
export const Fate = Schema.Literals(['open', ...Decision.literals, 'undone'])

export type Fate = typeof Fate.Type

/**
 * What becomes of a write made with a Turn's Key, which the API layer routes on: drafted into the
 * Conversation's Proposal, or applied to the System as it comes.
 */
export type Route = 'draft' | 'apply'

/** The route a Turn's writes take, by the Mode it started with. */
export const routeOf = ({ mode }: { readonly mode: Mode }): Route =>
  mode === 'ask' ? 'draft' : 'apply'
