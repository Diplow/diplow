// Where signing in starts and ends: home's read of the Session before it renders, which shows a
// signed-out visit the screen signed out rather than sending it away, and the search param home reads
// where to go once signed in from. The client's Unauthenticated channel (../channels.ts) sends a
// failed call to home, signed out, carrying where it was.
import { Schema } from 'effect'

import { localizeHref } from '#/paraglide/runtime'
import { orDefault, readSearch } from '#/front/ui/canvas/view/view'
import { channelFor } from '#/api/report/errors/channel'
import { forget, identify } from '#/api/report/observability/client'
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

/** Signed out, home's search param: where to go once signed in; absent or refused, home. */
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
 * Home's `beforeLoad`: puts the Session on the route's context, or none for a signed-out visit, which
 * home shows signed out rather than sending it away. Any other failure is the route's error, as a
 * read's would be.
 */
export async function sessionIfAny() {
  try {
    const proven = await settle('session', session({ data: undefined }))
    // In the browser, this device's events and flags are now the Account's (a no-op on the server).
    identify(proven.account.id)
    return { session: proven }
  } catch (error) {
    const failed = asCallFailed(error, 'session')
    if (channelFor('read', failed.failure.kind) === 'sign-in') {
      forget()
      return { session: undefined }
    }
    throw failed
  }
}
