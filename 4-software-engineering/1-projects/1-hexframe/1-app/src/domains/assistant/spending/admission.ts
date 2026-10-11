// A model call of a Turn, which the API layer calls as directly as the service: admitted on the Turn
// or not, its body and headers let through by the settings (./call.ts) and the Turn's spend held under
// its ceiling and the month's allowance (./limits.ts), on what the Turns repository holds
// (src/repositories/database/conversations/turns.ts); relayed through the model relay
// (src/repositories/agent/anthropic/); and settled on the Turn once its answer has ended. A Turn a
// limit holds back ends through the service (../assistant.ts).
import { Clock, Effect, Result } from 'effect'

import { Anthropic, type Endpoint } from '#/repositories/agent/anthropic/anthropic'
import { Turns } from '#/repositories/database/conversations/turns'

import { endTurn } from '../assistant'
import { settings } from '../settings'
import { type Allowed, allowedCall, type CallRefused } from './call'
import { charged, type Limit, limitReached, monthOf, mustWait, reserved } from './limits'

/**
 * The most bytes a model call's body holds, by the settings: the proxy reads no further, and refuses
 * the call past it, so `admitCall` never sees one.
 */
export const largestCall: number = settings.model.largestCall

/** A model call a Turn's agent asks the proxy for: its endpoint, Anthropic's headers, its body's text. */
export interface AskedCall {
  readonly endpoint: Endpoint
  readonly version: string | undefined
  readonly betas: string | undefined
  readonly body: string
}

/** A call let through and admitted on a Turn, with what it reserved of the Turn's spend. */
interface Admitted {
  readonly _tag: 'Admitted'
  readonly asked: AskedCall
  readonly call: Allowed
  readonly reserved: number
}

/**
 * What becomes of a model call before it goes: refused, by its body or its headers; refused since the
 * Turn is no longer running; held back by a limit the Turn reached, its ceiling or the month's
 * allowance, which ended the Turn so; asked to wait, until the calls under way settle, since with what
 * they reserved it would pass a limit; or admitted, the most it may cost reserved on the Turn.
 */
type Admission =
  | ({ readonly _tag: 'Refused' } & CallRefused)
  | { readonly _tag: 'TurnOver' }
  | { readonly _tag: 'Limited'; readonly limit: Limit }
  | { readonly _tag: 'Busy' }
  | Admitted

/**
 * Decides whether a call of one of the Account's Turns may go: its body and headers as the settings
 * let them through; the Turn still running, below its ceiling, and its Account's Turns this month
 * below the allowance. A call held back ends the Turn by the limit it reached. One admitted reserves
 * the most it may cost on the Turn, and one that would pass a limit with what the calls under way
 * reserved waits for them, so calls made at once stay under the limits. In the transaction the API
 * layer opens, the Turn's row locked until it commits, so they decide one after another.
 */
export const admitCall = (accountId: string, turnId: string, asked: AskedCall) =>
  Effect.gen(function* () {
    const allowed = allowedCall(asked)
    if (Result.isFailure(allowed)) {
      return { _tag: 'Refused', ...allowed.failure } satisfies Admission
    }
    const now = new Date(yield* Clock.currentTimeMillis)
    const spending = yield* Turns.use((turns) => turns.spending(accountId, turnId, monthOf(now)))
    if (spending === undefined) return { _tag: 'TurnOver' } satisfies Admission
    const limit = limitReached({ turn: spending.turn.spent, month: spending.month.spent })
    if (limit !== undefined) {
      yield* endTurn(accountId, turnId, limit)
      return { _tag: 'Limited', limit } satisfies Admission
    }
    const call = allowed.success
    const reserve = reserved(call.model, { maxTokens: call.maxTokens, length: asked.body.length })
    if (mustWait(spending, reserve)) return { _tag: 'Busy' } satisfies Admission
    yield* Turns.use((turns) => turns.charge(accountId, turnId, { spent: 0, reserved: reserve }))
    const admitted: Admission = { _tag: 'Admitted', asked, call, reserved: reserve }
    return admitted
  })

/**
 * Relays an admitted call through the model relay, which knows no limit, and answers Anthropic's
 * answer as it comes, with `charged`: what the call is charged once its answer has ended, been cut
 * short or failed.
 */
export const relayCall = ({ asked, call }: Admitted) =>
  Effect.gen(function* () {
    const { usage, ...relayed } = yield* Anthropic.use((anthropic) =>
      anthropic.relay({ ...asked, body: call.body }),
    )
    return {
      relayed,
      charged: Effect.map(usage, (used) => charged(call.model, call.maxTokens, used)),
    }
  })

/**
 * Settles an admitted call on its Turn, ended or not: what it reserved released, what it is charged
 * spent, since a call that started before the Turn ended still cost what it cost. In the transaction
 * the API layer opens.
 */
export const settleCall = (
  accountId: string,
  turnId: string,
  call: { readonly reserved: number; readonly charged: number },
) =>
  Turns.use((turns) =>
    turns.charge(accountId, turnId, { spent: call.charged, reserved: -call.reserved }),
  )
