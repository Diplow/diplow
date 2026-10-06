import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Option } from 'effect'

import { browser, TestAuth } from '#/repositories/auth/testing'

import {
  CurrentKey,
  CurrentSession,
  proven,
  sessionOnly,
  signIn,
  signOut,
  signUp,
  signedIn,
} from './iam'

let accounts = 0

/** Credentials no other test uses, so each test stands on its own. */
function someone() {
  accounts += 1
  return { email: `someone-${String(accounts)}@example.com`, password: 'correct horse battery' }
}

/** Someone who signed up on a device of their own, then left it. */
const signedUpElsewhere = Effect.gen(function* () {
  const credentials = someone()
  const account = yield* browser().request(signUp(credentials))
  return { credentials, account }
})

layer(TestAuth)('IAM on Better Auth', (it) => {
  it.effect('signs a new Account up, and the device it signed up on holds its Session', () =>
    Effect.gen(function* () {
      const credentials = someone()
      const device = browser()
      const account = yield* device.request(signUp(credentials))
      expect(account.email).toBe(credentials.email)
      expect(account.id).not.toBe('')
      const session = yield* device.request(proven)
      expect(Option.getOrThrow(session).account).toEqual(account)
      expect(Option.getOrThrow(session).expiresAt.getTime()).toBeGreaterThan(Date.now())
    }),
  )

  it.effect('refuses a second Account with the same email, on the email field', () =>
    Effect.gen(function* () {
      const { credentials } = yield* signedUpElsewhere
      const error = yield* browser().request(signUp(credentials)).pipe(Effect.flip)
      expect(error).toMatchObject({ _tag: 'EmailTaken', kind: 'Invalid', fields: ['email'] })
    }),
  )

  it.effect('signs an Account in on another device, which proves nothing before', () =>
    Effect.gen(function* () {
      const { credentials, account } = yield* signedUpElsewhere
      const device = browser()
      expect(yield* device.request(proven)).toEqual(Option.none())
      expect(yield* device.request(signIn(credentials))).toEqual(account)
      expect(Option.getOrThrow(yield* device.request(proven)).account).toEqual(account)
    }),
  )

  it.effect('rejects a wrong password without saying which of the two is wrong', () =>
    Effect.gen(function* () {
      const { credentials } = yield* signedUpElsewhere
      const wrong = yield* browser()
        .request(signIn({ ...credentials, password: 'incorrect horse' }))
        .pipe(Effect.flip)
      const unknown = yield* browser()
        .request(signIn({ ...credentials, email: 'nobody@example.com' }))
        .pipe(Effect.flip)
      expect(wrong).toMatchObject({ _tag: 'CredentialsRejected', fields: ['password'] })
      expect(unknown).toEqual(wrong)
    }),
  )

  it.effect('refuses a malformed email and a short password, on their fields', () =>
    Effect.gen(function* () {
      const email = yield* browser()
        .request(signUp({ ...someone(), email: 'ada' }))
        .pipe(Effect.flip)
      const password = yield* browser()
        .request(signUp({ ...someone(), password: 'short' }))
        .pipe(Effect.flip)
      expect(email).toMatchObject({ _tag: 'EmailMalformed', fields: ['email'] })
      expect(password).toMatchObject({ _tag: 'PasswordLengthInvalid', fields: ['password'] })
    }),
  )

  it.effect('refuses a fourth attempt from one place within ten seconds', () =>
    Effect.gen(function* () {
      const { credentials } = yield* signedUpElsewhere
      const device = browser()
      const wrong = signIn({ ...credentials, password: 'incorrect horse' })
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const error = yield* device.request(wrong).pipe(Effect.flip)
        expect(error._tag).toBe('CredentialsRejected')
      }
      const refused = yield* device.request(signIn(credentials)).pipe(Effect.flip)
      expect(refused).toMatchObject({ _tag: 'TooManyAttempts', kind: 'Forbidden' })
      expect(yield* browser().request(signIn(credentials))).toMatchObject({
        email: credentials.email,
      })
    }),
  )

  it.effect('ends the Session on sign-out, and its cookie with it', () =>
    Effect.gen(function* () {
      const { credentials } = yield* signedUpElsewhere
      const device = browser()
      yield* device.request(signIn(credentials))
      yield* device.request(signOut)
      expect(yield* device.request(proven)).toEqual(Option.none())
      expect(device.cookies()).toEqual([])
    }),
  )
})

describe('signedIn and sessionOnly', () => {
  const account = { id: 'a-1', email: 'ada@example.com' }
  const session = { account, expiresAt: new Date() }
  const key = { account, keyId: 'k-1' }

  /** Runs `program` on a request proven by a Session, a Key, both or neither. */
  const on = <A, E>(
    program: Effect.Effect<A, E, CurrentSession | CurrentKey>,
    proofs: { session?: typeof session; key?: typeof key },
  ) =>
    program.pipe(
      Effect.provideService(CurrentSession, Option.fromNullishOr(proofs.session)),
      Effect.provideService(CurrentKey, Option.fromNullishOr(proofs.key)),
    )

  it.effect('signedIn is the Account a Session proves, or the one a Key proves, and by which', () =>
    Effect.gen(function* () {
      expect(yield* on(signedIn, { session })).toEqual({ account, by: { _tag: 'Session' } })
      expect(yield* on(signedIn, { key })).toEqual({ account, by: { _tag: 'Key', keyId: 'k-1' } })
    }),
  )

  it.effect('signedIn takes the Session when a Session and a Key both prove the request', () =>
    Effect.gen(function* () {
      const other = { id: 'a-2', email: 'grace@example.com' }
      const both = yield* on(signedIn, { session, key: { account: other, keyId: 'k-2' } })
      expect(both).toEqual({ account, by: { _tag: 'Session' } })
    }),
  )

  it.effect('signedIn fails SignedOut, of kind Unauthenticated, when nothing proves it', () =>
    Effect.gen(function* () {
      const error = yield* on(signedIn, {}).pipe(Effect.flip)
      expect(error).toMatchObject({ _tag: 'SignedOut', kind: 'Unauthenticated' })
    }),
  )

  it.effect('sessionOnly is the Session, refuses a Key alone, and sends nobody to sign in', () =>
    Effect.gen(function* () {
      expect(yield* on(sessionOnly, { session })).toBe(session)
      const byKey = yield* on(sessionOnly, { key }).pipe(Effect.flip)
      expect(byKey).toMatchObject({ _tag: 'SessionRequired', kind: 'Forbidden' })
      expect(yield* on(sessionOnly, {}).pipe(Effect.flip)).toMatchObject({ _tag: 'SignedOut' })
    }),
  )
})
