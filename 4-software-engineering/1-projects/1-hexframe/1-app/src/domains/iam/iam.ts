// IAM: who someone is. An Account is someone known to hexframe; a Session, an Account's proven presence,
// for a while, on one device. Better Auth keeps both, below (src/repositories/auth/); IAM speaks of them
// in its own words and decides what a refusal means to the user. Keys and Entitlements come later.
import { Context, Effect, Option } from 'effect'

import {
  Auth,
  type AuthRefused,
  type AuthSession,
  type Credentials,
  type Refusal,
} from '#/repositories/auth/auth'

import {
  CredentialsRejected,
  EmailMalformed,
  EmailTaken,
  PasswordLengthInvalid,
  SignedOut,
} from './errors'

/**
 * Someone known to hexframe. Its name is not IAM's: the user is their Root tile in Mapping, whose
 * Title is copied to Better Auth for emails, never the other way.
 */
interface Account {
  readonly id: string
  readonly email: string
}

/** An Account's proven presence, until `expiresAt`, on the device that holds its cookie. */
export interface Session {
  readonly account: Account
  readonly expiresAt: Date
}

/**
 * The request's Session, if its cookie proves one: resolved once per request by the API layer's
 * middleware, before any server function runs.
 */
export class CurrentSession extends Context.Service<CurrentSession, Option.Option<Session>>()(
  'hexframe/iam/CurrentSession',
) {}

const sessionOf = ({ user, expiresAt }: AuthSession): Session => ({ account: user, expiresAt })

/** What each refusal says to the user, on the field at fault. */
const refused = {
  'credentials-rejected': () => new CredentialsRejected({ fields: ['password'] }),
  'email-taken': () => new EmailTaken({ fields: ['email'] }),
  'email-malformed': () => new EmailMalformed({ fields: ['email'] }),
  'password-length': () => new PasswordLengthInvalid({ fields: ['password'] }),
} satisfies Record<Refusal, () => unknown>

const inIamTerms = <A, R>(attempt: Effect.Effect<A, AuthRefused, R>) =>
  Effect.catchTag(attempt, 'AuthRefused', ({ reason }) => Effect.fail(refused[reason]()))

/** Creates an Account and signs it in on this device. */
export const signUp = (credentials: Credentials) =>
  Auth.use((auth) => auth.signUp(credentials)).pipe(inIamTerms)

/** Signs an Account in on this device. */
export const signIn = (credentials: Credentials) =>
  Auth.use((auth) => auth.signIn(credentials)).pipe(inIamTerms)

/** Ends the Session on this device. */
export const signOut = Auth.use((auth) => auth.signOut)

/** The Session the request proves, if any: what the middleware puts on the request. */
export const proven = Auth.use((auth) => auth.session).pipe(Effect.map(Option.map(sessionOf)))

/** The request's Session, or `SignedOut`: the first step of anything only a signed-in Account may do. */
export const signedIn = Effect.gen(function* () {
  const session = yield* CurrentSession
  if (Option.isNone(session)) return yield* new SignedOut()
  return session.value
})
