// What a Turn spends, and whether it may spend more: a call's usage priced by the settings' table, in
// millionths of a dollar, and the two limits a call is held under, the Turn's own ceiling and the
// month's allowance, the month being the sum of its Turns' spend, never a counter of its own. A call
// reserves the most its answer may cost before it goes, so calls made at once are held under the
// limits too, and is charged what it used once its answer has ended, or that most when the answer was
// cut short. Pure.
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

/** What a call reserves before it goes: the output it may answer, at its model's price. */
export function reserved(model: Model, maxTokens: number): number {
  return priced(model, {
    input: 0,
    output: maxTokens,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
  })
}

/**
 * What a call cost, once its answer has ended: what it used, at its model's price; an answer cut short
 * charged the output it may have answered, since what it used past the cut is not said.
 */
export function cost(model: Model, maxTokens: number, used: Used): number {
  const output = used.complete ? used.output : Math.max(used.output, maxTokens)
  return priced(model, { ...used, output })
}

/** The first instant of the calendar month, UTC, that `now` falls in: where the month's spend starts. */
export function monthOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Which limit holds a Turn back: its own ceiling, or the month's allowance. */
export type Limit = 'ceiling' | 'allowance'

/**
 * The limit a Turn has reached, if any, by what it spent and what its Account's Turns spent this
 * month, its own included: its ceiling first, then the month's allowance. A Turn reaches a limit once
 * its spend is at it: a call starts below it, and may end past it.
 */
export function limitReached(spent: {
  readonly turn: number
  readonly month: number
}): Limit | undefined {
  if (spent.turn >= settings.turn.ceiling) return 'ceiling'
  if (spent.month >= settings.month.allowance) return 'allowance'
  return undefined
}
