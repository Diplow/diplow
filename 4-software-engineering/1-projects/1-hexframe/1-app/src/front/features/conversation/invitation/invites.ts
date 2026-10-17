// When the chat invites a new account's first command, `/tutorial` (HEX-118): read off the Account's
// Root, Mapping's, and the Entries of its Conversation, Assistant's, each through its door. Pure;
// `Invitation.tsx` reads it on home.
import type { Entry } from '#/domains/assistant/entities'
import { holdsNothing, type SystemTile } from '#/domains/mapping/entities'

/**
 * Whether the chat invites the first command: while the Root, named, holds nothing below it
 * (Mapping's `holdsNothing`), and nothing was said, no Message among the Entries read, nor one the
 * user sent on its way or refused. Derived, never stored, so it goes once either changes. The change
 * that named the Root, which the Conversation records, says nothing, nor does a navigation
 * (`hexframe-app-tutorial/decisions.md#DEC-4`).
 */
export function invitesTutorial(
  root: Pick<SystemTile, 'title' | 'branches' | 'leaves' | 'context'>,
  entries: ReadonlyArray<Entry>,
  sending: boolean,
): boolean {
  return (
    root.title !== '' &&
    holdsNothing(root) &&
    !sending &&
    !entries.some((entry) => entry._tag === 'Message')
  )
}
