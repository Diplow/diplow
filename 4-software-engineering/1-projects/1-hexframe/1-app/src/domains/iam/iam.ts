// IAM: who someone is. An Account is someone known to hexframe; a Session, an Account's proven presence,
// for a while, on one device; a Key, a credential it issues to a program. Better Auth keeps all three,
// below (src/repositories/auth/); IAM speaks of them in its own words and decides what a refusal means
// to the user. Entitlements come later.
import { Context, Effect, Option } from 'effect'

import {
  Auth,
  type AuthApiKey,
  type AuthRefused,
  type AuthSession,
  type Refusal,
} from '#/repositories/auth/auth'

import {
  CredentialsRejected,
  EmailMalformed,
  EmailTaken,
  KeyNameInvalid,
  KeyNotFound,
  PasswordLengthInvalid,
  SessionRequired,
  SignedOut,
  TooManyAttempts,
} from './errors'

interface Credentials {
  readonly email: string
  readonly password: string
}

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

/** A Key, as its Account sees it among its others: never its secret. */
export interface Key {
  readonly id: string
  readonly name: string
  /** Its first characters, `hf_` and three more, to tell it from the Account's others. */
  readonly start: string
  readonly createdAt: Date
  /** When it last proved a request, if it ever did. */
  readonly lastUsedAt: Date | null
}

/** A Key just issued, with its secret: shown this once, since only its hash is kept. */
export interface IssuedKey {
  readonly key: Key
  readonly secret: string
}

/** What a Key proves of a request: whose it is, and which of their Keys it was. */
export interface KeyProof {
  readonly account: Account
  readonly keyId: string
}

/**
 * Which of the two proofs gave a signed-in request its Account: a Session, the user at one of their
 * devices, or one of their Keys, a program, by its id.
 */
export type Proof = { readonly _tag: 'Session' } | { readonly _tag: 'Key'; readonly keyId: string }

/** A signed-in request: its Account, and the proof that gave it. */
export interface SignedIn {
  readonly account: Account
  readonly by: Proof
}

/**
 * The request's Session, if its cookie proves one: resolved once per request by the API layer's
 * middleware, before any server function runs.
 */
export class CurrentSession extends Context.Service<CurrentSession, Option.Option<Session>>()(
  'hexframe/iam/CurrentSession',
) {}

/**
 * The request's Key, if its `Authorization: Bearer` header proves one: resolved once per request at
 * `/mcp`, the one door a Key opens. A server function's is always none: it never reads the header.
 */
export class CurrentKey extends Context.Service<CurrentKey, Option.Option<KeyProof>>()(
  'hexframe/iam/CurrentKey',
) {}

const sessionOf = ({ user, expiresAt }: AuthSession): Session => ({ account: user, expiresAt })

const keyOf = ({ lastRequest, ...listed }: AuthApiKey): Key => ({
  ...listed,
  lastUsedAt: lastRequest,
})

/** What each refusal says to the user, on the field at fault. */
const refused = {
  'credentials-rejected': () => new CredentialsRejected({ fields: ['password'] }),
  'email-taken': () => new EmailTaken({ fields: ['email'] }),
  'email-malformed': () => new EmailMalformed({ fields: ['email'] }),
  'password-length': () => new PasswordLengthInvalid({ fields: ['password'] }),
  'too-many-attempts': () => new TooManyAttempts(),
  'api-key-not-found': () => new KeyNotFound(),
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

/** The Session the request's cookie proves, if any: what the middleware puts on the request. */
export const proven = Auth.use((auth) => auth.session).pipe(Effect.map(Option.map(sessionOf)))

/** The Key the request's `Authorization: Bearer` header proves, if any: what `/mcp` puts on it. */
export const keyProven = Auth.use((auth) => auth.bearer).pipe(
  Effect.map(Option.map(({ user, apiKeyId }): KeyProof => ({ account: user, keyId: apiKeyId }))),
)

/** The request's Account and its proof: its Session's when it has one, else its Key's, if any. */
const signedInBy = (session: Option.Option<Session>, key: Option.Option<KeyProof>) =>
  Option.orElse(
    Option.map(session, ({ account }): SignedIn => ({ account, by: { _tag: 'Session' } })),
    () =>
      Option.map(key, ({ account, keyId }): SignedIn => ({ account, by: { _tag: 'Key', keyId } })),
  )

/**
 * The request's Account, proven by its Session or by its Key, and which proof it was, or
 * `SignedOut`: the first step of anything only a signed-in Account may do. Working on the System
 * never asks which proof it was; the API layer reads it to say who acted.
 */
export const signedIn = Effect.gen(function* () {
  const proven = signedInBy(yield* CurrentSession, yield* CurrentKey)
  if (Option.isNone(proven)) return yield* new SignedOut()
  return proven.value
})

/**
 * The request's Session, or `SessionRequired` when only a Key proves it, or `SignedOut`: the first
 * step of managing Keys and of changing the Account itself, so a leaked Key cannot keep itself alive.
 */
export const sessionOnly = Effect.gen(function* () {
  const session = yield* CurrentSession
  if (Option.isSome(session)) return session.value
  if (Option.isSome(yield* CurrentKey)) return yield* new SessionRequired()
  return yield* new SignedOut()
})

/** The fewest and the most characters a Key's name holds, so the user can tell their Keys apart. */
const keyNameLength = { min: 1, max: 32 } as const

/** The name a Key may take, or `KeyNameInvalid` on the name: 1 to 32 characters. IAM's rule alone. */
const keyNamed = (name: string): Effect.Effect<string, KeyNameInvalid> =>
  name.length >= keyNameLength.min && name.length <= keyNameLength.max
    ? Effect.succeed(name)
    : Effect.fail(new KeyNameInvalid({ fields: ['name'] }))

/** Issues a Key, named, to the Account the request's Session proves. Its secret is in the answer only. */
export const issueKey = (name: string) =>
  sessionOnly.pipe(
    Effect.andThen(keyNamed(name)),
    Effect.andThen((named) => Auth.use((auth) => auth.createApiKey(named)).pipe(inIamTerms)),
    Effect.map(({ apiKey, secret }): IssuedKey => ({ key: keyOf(apiKey), secret })),
  )

/** The Keys of the Account the request's Session proves, the newest first, without their secrets. */
export const keys = Effect.andThen(
  sessionOnly,
  Auth.use((auth) => auth.apiKeys),
).pipe(Effect.map((listed) => listed.map(keyOf)))

/** Revokes one of the Keys of the Account the request's Session proves: it proves nothing again. */
export const revokeKey = (id: string) =>
  Effect.andThen(sessionOnly, Auth.use((auth) => auth.deleteApiKey(id)).pipe(inIamTerms))
