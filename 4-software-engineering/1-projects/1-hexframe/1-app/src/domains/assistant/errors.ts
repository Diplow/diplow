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

export const assistantFailures = [TurnRunning, AllowanceSpent] as const
