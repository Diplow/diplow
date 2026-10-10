// A Turn: one run of the agent answering a Message, started afresh in a Tile's folder, the Conversation
// its only memory. It records what it spent, and how it ended; one runs at most per Conversation. Pure.
import { Schema } from 'effect'

/**
 * How a Turn ended: its answer, a Stop, its own ceiling, the month's allowance, its time, or the
 * sandbox failing. Nothing is rolled back whichever it was.
 */
export const TurnEnd = Schema.Literals([
  'answered',
  'stopped',
  'ceiling',
  'allowance',
  'time',
  'sandbox',
])

export type TurnEnd = typeof TurnEnd.Type

/** A Turn of the agent, in a Conversation. */
export interface Turn {
  readonly id: string
  readonly conversationId: string
  /** The Message it answers, by its Entry's id. */
  readonly message: string
  /** The Tile it starts in, by its id. */
  readonly location: string
  readonly startedAt: Date
  /** What it spent on the model, in millionths of a dollar. */
  readonly spent: number
  /** When and how it ended; none while it runs. */
  readonly ended?: { readonly at: Date; readonly how: TurnEnd }
}

/** The latest a Turn may run until: its start, and its maximum length after it. */
export const deadlineOf = (turn: Pick<Turn, 'startedAt'>, longest: number): Date =>
  new Date(turn.startedAt.getTime() + longest)
