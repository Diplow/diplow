// What a Turn spends, and whether it may spend more: a call's usage priced by the settings' table, in
// millionths of a dollar, and the two limits a call is held under, the Turn's own ceiling and the
// month's allowance, the month being the sum of its Turns' spend, never a counter of its own. A call
// reserves the most it may cost before it goes, its body's length as input and its `max_tokens` as
// output, so calls made at once are held under the limits too, and is charged what it used once its
// answer has ended, or the most it may have answered when the answer was cut short. Pure.
import { settings, type TokenKind, tokenKinds } from '../settings'
import type { Model } from './call'

/** The tokens a call used, by kind, and whether its answer came whole. */
export type Used = Readonly<Record<TokenKind, number>> & { readonly complete: boolean }

/**
 * What tokens cost, in millionths of a dollar, rounded up: each kind at the model's price in dollars
 * per million tokens, which is millionths of a dollar per token.
 */
function priced(model: Model, tokens: Readonly<Record<TokenKind, number>>): number {
  const price = settings.model.prices[model]
  return Math.ceil(tokenKinds.reduce((cost, kind) => cost + tokens[kind] * price[kind], 0))
}

/**
 * What a call reserves before it goes, the most it may cost: no more input tokens than its body has
 * characters, each at the dearest an input token costs, and its `max_tokens` of output.
 */
export function reserved(
  model: Model,
  call: { readonly maxTokens: number; readonly length: number },
): number {
  const price = settings.model.prices[model]
  const dearestInput = Math.max(
    price.input,
    price.cacheWrite5m,
    price.cacheWrite1h,
    price.cacheRead,
  )
  return Math.ceil(call.length * dearestInput + call.maxTokens * price.output)
}

/**
 * What a call is charged, once its answer has ended: what it used, at its model's price; an answer cut
 * short charged the output it may have answered, since what it used past the cut is not said; one
 * Anthropic refused, nothing.
 */
export function charged(model: Model, maxTokens: number, used: Used | undefined): number {
  if (used === undefined) return 0
  const output = used.complete ? used.output : Math.max(used.output, maxTokens)
  return priced(model, { ...used, output })
}

/** The first instant of the calendar month, UTC, that `now` falls in: where the month's spend starts. */
export function monthOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Whether the month's allowance is spent, by what an Account's Turns spent this month. */
export const allowanceSpent = (month: number): boolean => month >= settings.month.allowance

/** Which limit holds a Turn back: its own ceiling, or the month's allowance. */
export type Limit = 'ceiling' | 'allowance'

/**
 * The limit a Turn has reached, if any, by what it spent and what its Account's Turns spent this
 * month, its own included, what their calls under way reserved aside: its ceiling first, then the
 * month's allowance. A Turn reaches a limit once its spend is at it, and ends so.
 */
export function limitReached(spent: {
  readonly turn: number
  readonly month: number
}): Limit | undefined {
  if (spent.turn >= settings.turn.ceiling) return 'ceiling'
  if (allowanceSpent(spent.month)) return 'allowance'
  return undefined
}

/** What a Turn and its Account's Turns this month spent, and what their calls under way reserved. */
interface Spending {
  readonly turn: { readonly spent: number; readonly reserved: number }
  readonly month: { readonly spent: number; readonly reserved: number }
}

/**
 * Whether a call must wait for the calls under way to settle: some are, and with what they reserved
 * and what it reserves, the Turn or the month would pass its limit. A call with none under way never
 * waits, however much it reserves, so a Turn below its limits always makes progress.
 */
export function mustWait(spending: Spending, reserve: number): boolean {
  if (spending.month.reserved === 0) return false
  const { turn, month } = spending
  return (
    turn.spent + turn.reserved + reserve > settings.turn.ceiling ||
    month.spent + month.reserved + reserve > settings.month.allowance
  )
}
