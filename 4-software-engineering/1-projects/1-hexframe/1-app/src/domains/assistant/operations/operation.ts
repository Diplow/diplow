// Assistant's Operations on a Conversation, changes described as data, and the events they make, facts
// in the past tense: its Mode switched, a write its agent made in ask drafted into its Proposal, and
// the Proposal accepted or discarded by the user. A drafted write is kept as the API layer hands it,
// opaque: what it does to the System is Mapping's to say, and Assistant keeps of it only what Mapping
// summarized. Pure.
import { Schema } from 'effect'

import { Decision, Mode, ProposedChange } from '../entities'

/** Switches the Conversation's Mode: the Turns started from then on take it. */
export class SetMode extends Schema.TaggedClass<SetMode>()('SetMode', { mode: Mode }) {}

/**
 * Drafts a write a Turn's agent made in ask into the Conversation's open Proposal, opening one when
 * none is: the write as the API layer encoded it, opaque, and the changes it makes, as Mapping
 * summarized them on the System the Proposal makes.
 */
export class Draft extends Schema.TaggedClass<Draft>()('Draft', {
  turn: Schema.String,
  write: Schema.Unknown,
  changes: Schema.Array(ProposedChange),
}) {}

/** Accepts the Conversation's open Proposal of this id, whole. */
export class AcceptProposal extends Schema.TaggedClass<AcceptProposal>()('AcceptProposal', {
  proposal: Schema.String,
}) {}

/** Discards the Conversation's open Proposal of this id. */
export class DiscardProposal extends Schema.TaggedClass<DiscardProposal>()('DiscardProposal', {
  proposal: Schema.String,
}) {}

/** An Operation on a Conversation. */
export type Operation = SetMode | Draft | AcceptProposal | DiscardProposal

/** The Conversation's Mode is now this. */
export class ModeSet extends Schema.TaggedClass<ModeSet>()('ModeSet', { mode: Mode }) {}

/** A Proposal opened in the Conversation, under this id, by the Turn whose write it drafted first. */
export class ProposalOpened extends Schema.TaggedClass<ProposalOpened>()('ProposalOpened', {
  id: Schema.String,
  turn: Schema.String,
}) {}

/** A write was drafted into the open Proposal of this id, making these changes. */
export class Drafted extends Schema.TaggedClass<Drafted>()('Drafted', {
  proposal: Schema.String,
  write: Schema.Unknown,
  changes: Schema.Array(ProposedChange),
}) {}

/** The user decided the open Proposal of this id: accepted whole, or discarded. It is open no longer. */
export class ProposalDecided extends Schema.TaggedClass<ProposalDecided>()('ProposalDecided', {
  proposal: Schema.String,
  fate: Decision,
}) {}

/** What an Operation did to a Conversation. */
export type ConversationEvent = ModeSet | ProposalOpened | Drafted | ProposalDecided
