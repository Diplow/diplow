// The message table: the sentence a failure shows, in the page's language. The server's own sentence
// never reaches the screen.
import type { Kind } from '#/domains/kind'
import { m } from '#/paraglide/messages'

import type { Failure } from './failure'

interface Entry {
  tag: Failure['_tag']
  /**
   * Narrows the entry to one operation, by the scope its call names: the server function's name,
   * which the MCP tool that runs the same program names too.
   */
  scope?: string
  message: () => string
}

/**
 * Keyed by `_tag`, optionally narrowed by a scope: the first entry that matches wins, so a scoped
 * entry comes before its tag's general one. A domain's errors add their entries as it is built.
 */
const table: readonly Entry[] = [
  { tag: 'CredentialsRejected', message: m.error_iam_credentials_rejected },
  { tag: 'EmailTaken', message: m.error_iam_email_taken },
  { tag: 'EmailMalformed', message: m.error_iam_email_malformed },
  { tag: 'PasswordLengthInvalid', message: m.error_iam_password_length },
  { tag: 'TooManyAttempts', message: m.error_iam_too_many_attempts },
  { tag: 'SessionRequired', message: m.error_iam_session_required },
  { tag: 'KeyNameInvalid', message: m.error_iam_key_name_invalid },
  { tag: 'KeyNotFound', message: m.error_iam_key_not_found },
  { tag: 'TileNotFound', message: m.error_mapping_tile_not_found },
  { tag: 'TitleMissing', message: m.error_mapping_title_missing },
  { tag: 'PreviewTooLong', message: m.error_mapping_preview_too_long },
  { tag: 'DirectionTaken', message: m.error_mapping_direction_taken },
  { tag: 'MovedUnderItself', scope: 'swapTiles', message: m.error_mapping_swapped_in_line },
  { tag: 'MovedUnderItself', message: m.error_mapping_moved_under_itself },
  { tag: 'RootFixed', message: m.error_mapping_root_fixed },
  { tag: 'DevInvalid', scope: 'submitDevTitle', message: m.error_dev_title_missing },
  { tag: 'DevConflict', scope: 'submitDevTitle', message: m.error_dev_title_taken },
  { tag: 'DevNotFound', message: m.error_dev_not_found },
]

/** What a failure of each kind says when the table has no entry for it. */
const fallbacks: Record<Kind, () => string> = {
  Unauthenticated: m.error_unauthenticated,
  Forbidden: m.error_forbidden,
  Invalid: m.error_invalid,
  NotFound: m.error_not_found,
  Conflict: m.error_conflict,
  Unexpected: m.error_unexpected,
}

/** The sentence to show for a failure met in a scope, from the table or its kind's fallback. */
export function messageFor(failure: Failure, scope?: string): string {
  const entry = table.find(
    (entry) => entry.tag === failure._tag && (entry.scope === undefined || entry.scope === scope),
  )
  return (entry?.message ?? fallbacks[failure.kind])()
}
