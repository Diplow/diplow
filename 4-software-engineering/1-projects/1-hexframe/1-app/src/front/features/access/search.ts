// What home carries in its URL signed out, beside where to go once signed in (`readSignInSearch`,
// front/client/iam/guard.ts): which of signing in and signing up the sign-in widget shows, so an old
// link to /sign-up still opens on signing up. Pure.
import { Schema } from 'effect'

import { orDefault, readSearch } from '#/front/ui/canvas/view/view'
import type { Access } from '#/front/ui/chat/widgets/sign-in/SignInWidget'

const AccessSearch = Schema.Struct({
  /** Signing up; signing in when absent. */
  access: Schema.optionalKey(orDefault(Schema.Literal('sign-up'))),
})

export type AccessSearch = typeof AccessSearch.Type

/** Reads the URL's search param, falling back on signing in. */
export const readAccessSearch = readSearch(AccessSearch)

/** Which of the two the widget shows. */
export const accessOf = ({ access }: AccessSearch): Access => access ?? 'sign-in'

/** The search param for this one, nothing for signing in. */
export const withAccess = (access: Access): AccessSearch => ({
  access: access === 'sign-up' ? 'sign-up' : undefined,
})
