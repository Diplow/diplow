// IAM: who someone is, and what they may do. An Account is someone known to hexframe; a Session, an
// Account's proven presence, for a while, on one device; a Key, a credential it issues to a program; a
// Turn's Key, the credential of one Turn of its Assistant, short-lived. Better Auth keeps the first
// three, below (src/repositories/auth/), and the turn-keys repository the last
// (src/repositories/database/turn-keys/); IAM speaks of them in its own words and decides what a
// refusal means to the user. An Entitlement, something an Account may do, is derived when asked: for
// now from a list kept by hand (src/repositories/auth/allowlist.ts), until Stripe.
import { Clock, Context, Effect, Option, Redacted } from 'effect'

import { Allowlist } from '#/repositories/auth/allowlist'
import {
  Auth,
  type AuthApiKey,
  type AuthRefused,
  type AuthSession,
  HttpExchange,
  type Refusal,
  bearerOf,
} from '#/repositories/auth/auth'
import { TurnKeys, isTurnKeySecret } from '#/repositories/database/turn-keys/turn-keys'

import {
  CredentialsRejected,
  EmailMalformed,
  EmailTaken,
  Entitlement,
  EntitlementMissing,
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

/** What a Turn's Key is bound to, beside its Account: the Conversation and the Turn it was issued for. */
export interface TurnBinding {
  readonly conversationId: string
  readonly turnId: string
}

/** A Turn's Key just issued: its secret, the one time it is known, and when it stops proving. */
export interface IssuedTurnKey {
  readonly secret: Redacted.Redacted
  readonly expiresAt: Date
}

/**
 * Which proof gave a signed-in request its Account: a Session, the user at one of their devices; one
 * of their Keys, a program, by its id; or the Key of one of their Turns, the Assistant, by what it
 * is bound to.
 */
type Proof =
  | { readonly _tag: 'Session' }
  | { readonly _tag: 'Key'; readonly keyId: string }
  | ({ readonly _tag: 'TurnKey' } & TurnBinding)

/** What a Bearer header proves of a request: whose it is, and which Key, or Turn's Key, it was. */
export interface KeyProof {
  readonly account: Account
  readonly by: Exclude<Proof, { readonly _tag: 'Session' }>
}

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
 * The request's Key, or Turn's Key, if its `Authorization: Bearer` header proves one: resolved once per
 * request at `/mcp`, the one door a Key opens, and at the two doors of a Turn's sandbox. A server
 * function's is always none: it never reads the header.
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

/**
 * The Key the request's `Authorization: Bearer` header proves, if any: a Turn's Key, unexpired, when
 * its secret is shaped as one, else an Account's Key. What `/mcp` puts on it.
 */
export const keyProven = Effect.gen(function* () {
  const secret = bearerOf((yield* HttpExchange).headers)
  if (Option.isNone(secret)) return Option.none<KeyProof>()
  if (isTurnKeySecret(secret.value)) {
    const now = new Date(yield* Clock.currentTimeMillis)
    const turnKey = yield* TurnKeys.use((keys) => keys.proven(secret.value, now))
    if (turnKey === undefined) return Option.none<KeyProof>()
    const { user, conversationId, turnId } = turnKey
    return Option.some<KeyProof>({ account: user, by: { _tag: 'TurnKey', conversationId, turnId } })
  }
  const key = yield* Auth.use((auth) => auth.bearer)
  return Option.map(key, ({ user, apiKeyId }): KeyProof => ({
    account: user,
    by: { _tag: 'Key', keyId: apiKeyId },
  }))
})

/**
 * The Account two proofs give, and which gave it: the Session's when there is one, else the Key's, a
 * Turn's Key's included, if any. What `signedIn` reads the request by, and the API layer too, to say
 * who acted.
 */
export const signedInBy = (
  session: Option.Option<Session>,
  key: Option.Option<KeyProof>,
): Option.Option<SignedIn> =>
  Option.orElse(
    Option.map(session, ({ account }): SignedIn => ({ account, by: { _tag: 'Session' } })),
    () => key,
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
 * The request's Session, or `SessionRequired` when only a Key, or a Turn's Key, proves it, or
 * `SignedOut`: the first step of managing Keys, of changing the Account itself, so a leaked Key cannot
 * keep itself alive, and of starting a Turn, so a Turn starts no other.
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

/**
 * The name of one of the Account's Keys, by its id, read outside any request: none once the Key is
 * revoked. What the timeline calls a write that Key proved.
 */
export const keyName = (accountId: string, keyId: string) =>
  Auth.use((auth) => auth.apiKeyName(accountId, keyId))

/**
 * Issues the Key of a Turn the request's Session starts, bound to its Account and to the Turn and its
 * Conversation, proving them until `expiresAt`. Its secret is in the answer only, redacted so no log
 * shows it: the code that starts the Turn hands it to the sandbox's processes and nothing else.
 */
export const issueTurnKey = (turn: TurnBinding, expiresAt: Date) =>
  Effect.flatMap(sessionOnly, ({ account }) =>
    TurnKeys.use((keys) => keys.issue({ accountId: account.id, ...turn }, expiresAt)),
  ).pipe(Effect.map((secret): IssuedTurnKey => ({ secret: Redacted.make(secret), expiresAt })))

/**
 * Revokes the Key of one of the Account's Turns, once the Turn ended: it proves nothing again. Read
 * outside any request, so it needs no Session; a Key already gone is no error.
 */
export const revokeTurnKey = (accountId: string, turnId: string) =>
  TurnKeys.use((keys) => keys.revoke(accountId, turnId))

type Entitlement = typeof Entitlement.Type

/** Whether the Account has the Entitlement: for now, whether a list kept by hand names its email. */
export const entitled = (account: Account, entitlement: Entitlement) =>
  Allowlist.use((allowlist) => Effect.succeed(allowlist.allows(entitlement, account.email)))

/** Nothing when the Account has the Entitlement, else `EntitlementMissing`. */
export const entitledOnly = (account: Account, entitlement: Entitlement) =>
  Effect.flatMap(entitled(account, entitlement), (has) =>
    has ? Effect.void : Effect.fail(new EntitlementMissing({ entitlement })),
  )
