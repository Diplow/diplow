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
 * The open Proposal is over another System than the one this Turn works in: one Proposal is open at a
 * time, and it changes one System, so a Turn started elsewhere drafts nothing into it until the user
 * accepts or discards it. Nothing changes.
 */
export class ProposalElsewhere extends Schema.TaggedError<ProposalElsewhere>()(
  'ProposalElsewhere',
  { kind: kind('Conflict') },
) {}

/**
 * Nothing is left to undo: the user undid it already, in another tab say, or it never applied
 * anything that is the Account's to undo. Nothing changes; the timeline says it was undone.
 */
export class NothingToUndo extends Schema.TaggedError<NothingToUndo>()('NothingToUndo', {
  kind: kind('Conflict'),
}) {}

/**
 * The Turn that made this write ended: by its answer, a Stop, its time, its ceiling, the month's
 * allowance or its sandbox. An ended Turn writes nothing, drafted or applied: whoever wrote acts for no
 * running Turn, so the write is Unauthenticated, as it was when the API layer refused it. Nothing
 * changes.
 */
export class TurnOver extends Schema.TaggedError<TurnOver>()('TurnOver', {
  kind: kind('Unauthenticated'),
}) {}

export const assistantFailures = [
  TurnRunning,
  AllowanceSpent,
  ProposalClosed,
  ProposalElsewhere,
  NothingToUndo,
  TurnOver,
] as const
