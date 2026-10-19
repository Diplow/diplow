// A Turn: one run of the agent answering a Message, started afresh in a Tile's folder, of the
// Account's own System or of someone else's (`elsewhere`), the Conversation its only memory, in the
// Mode its Conversation was in. It records what it spent, what its agent is
// doing now, and how it ended; one runs at most per Conversation. Pure.
import { Result, Schema } from 'effect'

import { TurnOver } from '../../errors'
import { leadingLink } from '../message/links'
import type { Mode } from '../proposal/proposal'

/** How a Turn ended when not by its answer: what the timeline tells in an Entry of its own. */
export const BadEnd = Schema.Literals(['stopped', 'ceiling', 'allowance', 'time', 'sandbox'])

export type BadEnd = typeof BadEnd.Type

/**
 * How a Turn ended: its answer, a Stop, its own ceiling, the month's allowance, its time, or the
 * sandbox failing. Nothing is rolled back whichever it was.
 */
export const TurnEnd = Schema.Literals(['answered', ...BadEnd.literals])

export type TurnEnd = typeof TurnEnd.Type

/** Whether a Turn ended otherwise than by its answer, which the timeline tells. */
export const isBadEnd = Schema.is(BadEnd)

/** The most characters a step's tool and its detail hold: enough to tell it, never a file's content. */
const longestTool = 100
const longestDetail = 200

/**
 * What a running Turn's agent is doing now, shown live and dropped once it moves on: the tool it
 * runs, in the agent's own words (`Read`, `Bash`, `open_tile`), and what on (a path, a command, a
 * Tile's id), cut short.
 */
export const TurnStep = Schema.Struct({
  tool: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(longestTool)),
  detail: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(longestDetail))),
})

export type TurnStep = typeof TurnStep.Type

/** A step as a tool and a detail give it, each cut to what a step holds. */
export const stepOf = (tool: string, detail?: string): TurnStep => ({
  tool: tool.slice(0, longestTool) || '?',
  ...(detail !== undefined && detail !== '' && { detail: detail.slice(0, longestDetail) }),
})

/** A Turn of the agent, in a Conversation. */
export interface Turn {
  readonly id: string
  readonly conversationId: string
  /** The Message it answers, by its Entry's id. */
  readonly message: string
  /** The Tile it starts in, by its id. */
  readonly location: string
  /**
   * The star of the System it started in, by its id, when that System is someone else's: the one
   * its writes and its reads reach alone. None for the Account's own.
   */
  readonly elsewhere?: string
  /** The Mode its Conversation was in as it started, which its writes keep until it ends. */
  readonly mode: Mode
  readonly startedAt: Date
  /** What it spent on the model, in millionths of a dollar. */
  readonly spent: number
  /** What its agent is doing now; none between steps, and once it ended. */
  readonly step?: TurnStep
  /** When and how it ended; none while it runs. */
  readonly ended?: { readonly at: Date; readonly how: TurnEnd }
}

/**
 * Someone else's System as a Turn, a Proposal or a draft keeps it, by its star: the field when there
 * is one, none for the Account's own, whether it comes as `undefined` or as a row's `null`.
 */
export const elsewhereOf = (star: string | null | undefined): { readonly elsewhere?: string } =>
  star === null || star === undefined ? {} : { elsewhere: star }

/**
 * Where the Turn answering a Message starts, its location, by its Tile's id: the Tile the Message opens
 * with a link to, else `center`, the one centered on the view it was sent from.
 */
export const turnLocation = (message: string, center: string): string =>
  leadingLink(message) ?? center

/** The latest a Turn may run until: its start, and its maximum length after it. */
export const deadlineOf = (turn: Pick<Turn, 'startedAt'>, longest: number): Date =>
  new Date(turn.startedAt.getTime() + longest)

/** Whether a Turn still running at `now` is over all the same: its deadline has come. */
export const overdue = (turn: Pick<Turn, 'startedAt'>, longest: number, now: Date): boolean =>
  deadlineOf(turn, longest) <= now

/**
 * A Turn as a write it made needs it: still running, or `TurnOver` once it ended, so an ended Turn
 * writes nothing, drafted or applied, however its write reached Assistant.
 */
export const stillRunning = <T extends Pick<Turn, 'ended'>>(turn: T): Result.Result<T, TurnOver> =>
  turn.ended === undefined ? Result.succeed(turn) : Result.fail(new TurnOver())
