// What the Assistant applied, an applied Turn's writes or an accepted Proposal's, undone once: when a
// Turn's is offered, the Entry of an accepted Proposal once it offers its Undo, whether it may be
// undone, and the Entry that offered it once it was. What was applied is an aggregate of its own, kept
// one row per applied Turn or accepted Proposal and locked while it is decided, outside the
// Conversation's Decider: these rules decide it, as the Turn's are decided outside it too
// (`hexframe-app-assistant/decisions.md#DEC-23`). Pure.
import { Result } from 'effect'

import { NothingToUndo } from '../../errors'
import type { EntryContent } from '../entry'

/**
 * The Entry of an accepted Proposal once what undoes its writes was kept: it then offers its Undo,
 * saying it may be undone (`undone: false`), which a Proposal accepted before undos were kept never
 * says. None for any other Entry, nor for one that offers it already.
 */
export function offeringEntry(content: EntryContent): EntryContent | undefined {
  return content._tag === 'Proposal' && content.fate === 'accepted' && content.undone === undefined
    ? { ...content, undone: false }
    : undefined
}

/**
 * An Entry that offers to undo what the Assistant applied, once the user undid it: an accepted
 * Proposal's, which says it may be undone once what undoes it was kept (`undone: false`), or an
 * applied Turn's, said undone. None for any other, which offers no Undo.
 */
export function undoneEntry(content: EntryContent): EntryContent | undefined {
  switch (content._tag) {
    case 'Proposal':
      return content.fate === 'accepted' && content.undone === false
        ? { ...content, undone: true }
        : undefined
    case 'TurnApplied':
      return content.undone ? undefined : { ...content, undone: true }
    default:
      return undefined
  }
}

/** Whether an Entry offers to undo what the Assistant applied: an accepted Proposal's, or a Turn's not yet undone. */
export const offersUndo = (content: EntryContent) => undoneEntry(content) !== undefined

/** What a Turn applied, as Assistant decides whether to offer its Undo: its changes, and its Entry. */
export interface Offerable {
  readonly changes: number
  readonly entryId: string | null
}

/**
 * Whether what a Turn applied is offered for undo now, in an Entry of its own: once its Turn ended,
 * so it never races the agent's next write; once only; and only when its writes changed anything.
 */
export const offeredNow = (kept: Offerable | undefined, { ended }: { readonly ended: boolean }) =>
  ended && kept !== undefined && kept.entryId === null && kept.changes > 0

/**
 * What the Assistant applied, as Assistant decides whether to undo it: the Entry that offers to undo
 * it, none while its Turn runs or once it applied nothing, and when the user undid it, if they did.
 */
export interface Undoable {
  readonly entryId: string | null
  readonly undoneAt: Date | null
}

/**
 * What the Assistant applied, undone once: answered with the Entry that offers it, which then says it
 * was undone; `NothingToUndo` for nothing applied, a Turn still running, or what was undone already.
 */
export function undoing<A extends Undoable>(
  applied: A | undefined,
): Result.Result<A & { readonly entryId: string }, NothingToUndo> {
  if (applied === undefined || applied.undoneAt !== null || applied.entryId === null) {
    return Result.fail(new NothingToUndo())
  }
  return Result.succeed({ ...applied, entryId: applied.entryId })
}
