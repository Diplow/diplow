// What was applied to the user's System by another than themselves, kept with what undoes it and
// undone once, which the API layer calls as directly as the service, through the Applied repository
// (src/repositories/database/conversations/applied.ts): a Turn in apply's write run in the order it
// must run, in the Account's own System or in someone else's, a write someone else made in the
// user's System, told in their timeline as it runs, and an undo. What undoes a write is Mapping's,
// opaque here: the API layer hands it over and runs it. Every step takes the Conversation's lock
// first, as the service's do (../assistant.ts), so a write, a Turn's end that offers its Undo, and an
// undo see one another. The rules it runs are pure (../entities/applied/undo.ts).
import { Clock, Effect } from 'effect'

import { Applied } from '#/repositories/database/conversations/applied'

import {
  type Applying,
  lockConversation,
  lockConversations,
  record,
  rewritten,
  writingTurn,
} from '../assistant'
import { type Someone, type SummarizedChange, undoing, undoneEntry } from '../entities'

/**
 * Runs a write one of the Account's Turns in apply made, in the one order it holds in: the
 * Conversation locked until the transaction ends, as the Turn's end locks it to offer the Undo, so
 * the write lands before the offer or finds the Turn over; what undoes the Turn's writes so far read,
 * none before its first, its row locked; then the Turn read, `TurnOver` once it ended, `run` never
 * run (`writingTurn`); then `run` given what undoes them so far, which runs the write and answers what
 * undoes them all, this one's included, and the changes it made (Mapping's, in the API layer); and
 * that kept with the Turn, its changes added to theirs, for the Entry that offers it once the Turn
 * ended. Answers what `run` answered. What `run` refuses is refused, nothing kept. In the transaction
 * the API layer opened.
 */
export const applyInTurn = <A extends Applying, E, R>(
  accountId: string,
  turnId: string,
  run: (soFar: unknown) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    yield* lockConversation(accountId)
    const kept = yield* Applied.use((applied) => applied.locked(accountId, turnId))
    yield* writingTurn(accountId, turnId)
    const ran = yield* run(kept?.undo)
    const changes = (kept?.changes ?? 0) + ran.changes
    yield* Applied.use((applied) => applied.keep(accountId, turnId, { undo: ran.undo, changes }))
    return ran
  })

/**
 * Runs a write one of the Account's Turns in apply made in someone else's System, the one it started
 * in, whose owner `owner` names, in the one order it holds in: both Conversations locked until the
 * transaction ends, in the order of their Accounts' ids (`lockConversations`), so the Turn's, held as
 * its end takes it, and the owner's, held as `run` records the write there (`writtenBySomeone`), never
 * wait on another Turn's write in the Account's own System; then the Turn read, `TurnOver` once it
 * ended, `run` never run (`writingTurn`); then `run`, which runs the write there and tells its owner,
 * who holds its Undo: nothing is kept with the Turn, which offers none of it. `owner` is none when
 * no Conversation of the System's owner is told the write, the API layer's to say: the Turn's alone
 * is locked then. Answers what `run` answered. In the transaction the API layer opened.
 */
export const writtenInTurnElsewhere = <A, E, R>(
  { accountId, turnId, owner }: { accountId: string; turnId: string; owner: string | undefined },
  run: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    yield* lockConversations(owner === undefined ? [accountId] : [accountId, owner])
    yield* writingTurn(accountId, turnId)
    return yield* run
  })

/**
 * A write someone else made in the Account's System, as the API layer hands it: what undoes it,
 * opaque, and the change it made, as Mapping summarized it, none when it changed nothing.
 */
export interface Written {
  readonly undo: unknown
  readonly change?: SummarizedChange | undefined
}

/**
 * Runs a write someone else made in the Account's System, in the one order it holds in: the
 * Conversation locked until the transaction ends, as an undo locks it, before `run` locks the System,
 * as an accept takes the two; then `run`, which runs the write on the System and answers what undoes
 * it and the change it made (Mapping's, in the API layer); then that change recorded in the Account's
 * timeline by who acted, offering its Undo once (`undone: false`), what undoes it kept with its Entry,
 * by the Entry's id. A write that changed nothing records nothing. Answers what `run` answered. What
 * `run` refuses is refused, nothing recorded. In the transaction the API layer opened.
 */
export const writtenBySomeone = <A extends Written, E, R>(
  accountId: string,
  actor: Someone,
  run: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    yield* lockConversation(accountId)
    const ran = yield* run
    if (ran.change === undefined) return ran
    const entry = yield* record(accountId, { ...ran.change, actor, undone: false })
    yield* Applied.use((applied) =>
      applied.keep(accountId, entry.id, { undo: ran.undo, changes: 1, entryId: entry.id }),
    )
    return ran
  })

/**
 * Undoes what one of the Account's Turns applied, a Proposal it accepted, or a write someone else
 * made in its System, by the Turn's, the Proposal's or the write's Entry's id, once: marked
 * undone, its Entry saying so and offering no second Undo, and what undoes it answered, opaque, for the
 * API layer to run on the System in the same transaction, which a refusal there rolls back with it.
 * `NothingToUndo` once it was undone already, for a Turn still running, or for nothing it applied.
 * The Conversation locked until the transaction ends. In the transaction the API layer opened.
 */
export const undo = (accountId: string, id: string) =>
  Effect.gen(function* () {
    yield* lockConversation(accountId)
    const kept = yield* Applied.use((applied) => applied.locked(accountId, id))
    const undoable = yield* Effect.fromResult(undoing(kept))
    const now = new Date(yield* Clock.currentTimeMillis)
    yield* Applied.use((applied) => applied.undone(accountId, id, now))
    yield* rewritten(accountId, undoable.entryId, undoneEntry)
    return undoable.undo
  })
