// What a Turn spends, and whether it may spend more: a call's usage priced by the settings' table, in
// millionths of a dollar, and the two limits a call is held under, the Turn's own ceiling and the
// month's allowance, the month being the sum of its Turns' spend, never a counter of its own. Pure.
import { settings } from '../settings'
import type { Model } from './call'

/** The tokens a call used, by how they are priced. */
export interface Used {
  readonly input: number
  readonly output: number
  readonly cacheWrite5m: number
  readonly cacheWrite1h: number
  readonly cacheRead: number
}

/**
 * What a call cost, in millionths of a dollar, rounded up: each kind of token at the model's price in
 * dollars per million tokens, which is millionths of a dollar per token.
 */
export function priced(model: Model, used: Used): number {
  const price = settings.model.prices[model]
  const cost =
    used.input * price.input +
    used.output * price.output +
    used.cacheWrite5m * price.cacheWrite5m +
    used.cacheWrite1h * price.cacheWrite1h +
    used.cacheRead * price.cacheRead
  return Math.ceil(cost)
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
export function limitReached(spent: { readonly turn: number; readonly month: number }): Limit | undefined {
  if (spent.turn >= settings.turn.ceiling) return 'ceiling'
  if (spent.month >= settings.month.allowance) return 'allowance'
  return undefined
}
