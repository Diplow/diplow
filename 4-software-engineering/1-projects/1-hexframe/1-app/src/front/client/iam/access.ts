// Signing in, up and out on the client, over IAM's server functions (src/api/iam/iam.ts): the sign-in
// widget's submit, kept out of every cache since it carries a password (`submitWrite`), a refusal of
// the email or the password on its field, any other on its channel. Signed in, its caller goes on;
// signed out, the page loads home afresh, signed out.
import { useMutation } from '@tanstack/react-query'

import { type Credentials as Sent, signIn, signOut, signUp } from '#/api/iam/iam'
import { forget } from '#/api/report/observability/client'
import { localizeHref } from '#/paraglide/runtime'

import { write } from '../calls'
import { submitWrite } from '../channels'

/** What signing in or up sends: an email and a password, as the server function's schema says. */
export type Credentials = typeof Sent.Type

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

/**
 * Signs out on this device, the composer's `/logout`: once the Session ended, PostHog forgets who it
 * was and home loads afresh, signed out, so nothing of the Account stays in the page's caches. A
 * failure goes to the write's channel.
 */
export const useSignOut = () =>
  useMutation({
    ...write('signOut', () => signOut()),
    onSuccess: () => {
      forget()
      window.location.assign(localizeHref('/'))
    },
  })
