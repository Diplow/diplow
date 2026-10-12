// Signing in and signing up on the client, over IAM's server functions (src/api/iam/iam.ts): the sign-in
// widget's submit, kept out of every cache since it carries a password (`submitWrite`), a refusal of
// the email or the password on its field, any other on its channel. Signed in, its caller goes on.
import { signIn, signUp } from '#/api/iam/iam'

import { submitWrite } from '../channels'

interface Credentials {
  email: string
  password: string
}

/** Each of the two's call, by the server function's name. */
const calls = {
  'sign-in': { scope: 'signIn', call: (data: Credentials) => signIn({ data }) },
  'sign-up': { scope: 'signUp', call: (data: Credentials) => signUp({ data }) },
} as const

/** The Account a sign-in or a sign-up answers. */
export type SignedInAccount = Extract<Awaited<ReturnType<typeof signIn>>, { ok: true }>['value']

/**
 * The submit of signing in or up, as `submitWrite` builds it: `{ value }` in, the refusal its form
 * shows out, or nothing once `onSignedIn` has the Account.
 */
export const accessSubmit = (
  access: 'sign-in' | 'sign-up',
  onSignedIn: (account: SignedInAccount) => void,
) => submitWrite({ ...calls[access], onSaved: onSignedIn })
