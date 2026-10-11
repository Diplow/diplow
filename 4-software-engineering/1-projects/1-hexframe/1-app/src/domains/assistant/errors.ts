// Assistant's errors, in its language, each with the kind the client routes it by (src/domains/kind.ts).
import { Schema } from 'effect'

import { kind } from '../kind'

/** A Turn already runs in the Conversation: one at a time, so wait for its end, or stop it. */
export class TurnRunning extends Schema.TaggedError<TurnRunning>()('TurnRunning', {
  kind: kind('Conflict'),
}) {}

/** The month's allowance is spent: no Turn starts until the next month. */
export class AllowanceSpent extends Schema.TaggedError<AllowanceSpent>()('AllowanceSpent', {
  kind: kind('Forbidden'),
}) {}

/**
 * The Proposal is open no longer: the user accepted or discarded it already, in another tab say, or
 * it was never the Conversation's. Nothing changes; the timeline says how it was decided.
 */
export class ProposalClosed extends Schema.TaggedError<ProposalClosed>()('ProposalClosed', {
  kind: kind('Conflict'),
}) {}

/**
 * Nothing is left to undo: the user undid it already, in another tab say, or it never applied
 * anything that is the Account's to undo. Nothing changes; the timeline says it was undone.
 */
export class NothingToUndo extends Schema.TaggedError<NothingToUndo>()('NothingToUndo', {
  kind: kind('Conflict'),
}) {}

export const assistantFailures = [
  TurnRunning,
  AllowanceSpent,
  ProposalClosed,
  NothingToUndo,
] as const
