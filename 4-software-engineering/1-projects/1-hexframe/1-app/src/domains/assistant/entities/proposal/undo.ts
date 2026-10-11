// What the Assistant applied, an applied Turn's writes or an accepted Proposal's, undone once: whether
// it may be undone, and the Entry that offered it once it was. Pure.
import { Result } from 'effect'

import { NothingToUndo } from '../../errors'
import type { EntryContent } from '../entry'

/**
 * An Entry that offers to undo what the Assistant applied, once the user undid it: an accepted
 * Proposal's, `undone`, and an applied Turn's, said undone. None for any other, which offers no Undo.
 */
export function undoneEntry(content: EntryContent): EntryContent | undefined {
  switch (content._tag) {
    case 'Proposal':
      return content.fate === 'accepted' ? { ...content, fate: 'undone' } : undefined
    case 'TurnApplied':
      return content.undone ? undefined : { ...content, undone: true }
    default:
      return undefined
  }
}

/** Whether an Entry offers to undo what the Assistant applied: an accepted Proposal's, or a Turn's not yet undone. */
export const offersUndo = (content: EntryContent) => undoneEntry(content) !== undefined

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
