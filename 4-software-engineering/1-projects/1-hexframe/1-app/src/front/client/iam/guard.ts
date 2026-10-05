// Where signing in starts and ends: the guard of a page only a signed-in Account sees, which sends a
// signed-out visit to sign-in carrying where it was, and the search params sign-in and sign-up read that
// place back from. The client's Unauthenticated channel (../channels.ts) sends a failed call
// there the same way.
import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { Schema } from 'effect'

import { localizeHref } from '#/paraglide/runtime'
import { orDefault, readSearch } from '#/front/ui/hex/view/view'
import { channelFor } from '#/api/errors/channel'
import { forget, identify } from '#/api/observability/client'
import { session } from '#/api/iam/iam'

import { asCallFailed, settle } from '../calls'

/**
 * A path on this site, as the router sees it, without the language prefix. Anything else is refused,
 * so sign-in never sends anyone off the site: a full URL, a `//host`, a backslash, and any control
 * character, which a browser drops from a URL (`/\t/host` would reach `//host`).
 */
const LocalPath = Schema.String.check(
  Schema.isMaxLength(2000),
  Schema.isPattern(/^\/(?![/\\])[^\\\p{Cc}]*$/u),
)

/** Sign-in's and sign-up's search params: where to go once signed in; absent or refused, home. */
const SignInSearch = Schema.Struct({
  redirect: Schema.optionalKey(orDefault(LocalPath)),
})

/** The route's `validateSearch`: every field set, `undefined` when it falls back. */
export const readSignInSearch = readSearch(SignInSearch)

/**
 * Where a signed-in Account goes next: a full load, so the page renders with its Session. Home when
 * the place, resolved, is not on this site after all. This device is tied to the Account first, so
 * its events and flags are the Account's wherever it lands.
 */
export function continueTo(redirect: string | undefined, accountId: string) {
  identify(accountId)
  const { origin } = window.location
  const onThisSite = new URL(redirect ?? '/', origin).origin === origin
  window.location.assign(localizeHref(onThisSite && redirect !== undefined ? redirect : '/'))
}

/**
 * Whether a route's context holds the Session `signedInOnly` put there: whether the page's guard proved
 * one. What the header's links show by, so the key they read stays the guard's.
 */
export function provedSession(context: unknown) {
  return typeof context === 'object' && context !== null && 'session' in context
}

/**
 * A route's `beforeLoad` for a page only a signed-in Account sees: puts the Session on the route's
 * context, or redirects a signed-out visit to sign-in, carrying where it was. Any other failure is the
 * route's error, as a read's would be.
 */
export async function signedInOnly({ location }: { location: ParsedLocation }) {
  try {
    const proven = await settle('session', session({ data: undefined }))
    // In the browser, this device's events and flags are now the Account's (a no-op on the server).
    identify(proven.account.id)
    return { session: proven }
  } catch (error) {
    const failed = asCallFailed(error, 'session')
    if (channelFor('read', failed.failure.kind) === 'sign-in') {
      forget()
      // The router's `href`, which its rewrite (src/router.tsx) already took the language prefix off.
      redirect({ to: '/sign-in', search: { redirect: location.href }, throw: true })
    }
    throw failed
  }
}
