// What the Assistant applied, kept with what undoes it and undone once, which the API layer calls as
// directly as the service, through the Applied repository
// (src/repositories/database/conversations/applied.ts): a Turn in apply's write run in the order it
// must run, and an undo. What undoes a write is Mapping's, opaque here: the API layer hands it over
// and runs it. Every step takes the Conversation's lock first, as the service's do (../assistant.ts),
// so a write, a Turn's end that offers its Undo, and an undo see one another. The rules it runs are
// pure (../entities/applied/undo.ts).
import { Clock, Effect } from 'effect'

import { Applied } from '#/repositories/database/conversations/applied'

import { type Applying, lockConversation, rewritten, writingTurn } from '../assistant'
import { undoing, undoneEntry } from '../entities'

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
 * Undoes what one of the Account's Turns applied, or a Proposal it accepted, by its id, once: marked
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
