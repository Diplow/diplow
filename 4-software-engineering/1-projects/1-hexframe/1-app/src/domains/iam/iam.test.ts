import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Option } from 'effect'

import { browser, TestAuth } from '#/repositories/auth/testing'

import { CurrentSession, proven, signIn, signOut, signUp, signedIn } from './iam'

const ada = { email: 'ada@example.com', password: 'correct horse battery' }

layer(TestAuth)('IAM on Better Auth', (it) => {
  it.effect('signs a new Account up, and the device it signed up on holds its Session', () =>
    Effect.gen(function* () {
      const device = browser()
      const account = yield* device.request(signUp(ada))
      expect(account.email).toBe(ada.email)
      expect(account.id).not.toBe('')
      const session = yield* device.request(proven)
      expect(Option.getOrThrow(session).account).toEqual(account)
      expect(Option.getOrThrow(session).expiresAt.getTime()).toBeGreaterThan(Date.now())
    }),
  )

  it.effect('refuses a second Account with the same email, on the email field', () =>
    Effect.gen(function* () {
      const error = yield* browser().request(signUp(ada)).pipe(Effect.flip)
      expect(error).toMatchObject({ _tag: 'EmailTaken', kind: 'Invalid', fields: ['email'] })
    }),
  )

  it.effect('signs an Account in on another device, which proves nothing before', () =>
    Effect.gen(function* () {
      const device = browser()
      expect(yield* device.request(proven)).toEqual(Option.none())
      const account = yield* device.request(signIn(ada))
      expect(Option.getOrThrow(yield* device.request(proven)).account).toEqual(account)
    }),
  )

  it.effect('rejects a wrong password without saying which of the two is wrong', () =>
    Effect.gen(function* () {
      const wrong = yield* browser()
        .request(signIn({ ...ada, password: 'incorrect horse' }))
        .pipe(Effect.flip)
      const unknown = yield* browser()
        .request(signIn({ ...ada, email: 'bob@example.com' }))
        .pipe(Effect.flip)
      expect(wrong).toMatchObject({ _tag: 'CredentialsRejected', fields: ['password'] })
      expect(unknown).toEqual(wrong)
    }),
  )

  it.effect('refuses a malformed email and a short password, on their fields', () =>
    Effect.gen(function* () {
      const email = yield* browser()
        .request(signUp({ ...ada, email: 'ada' }))
        .pipe(Effect.flip)
      const password = yield* browser()
        .request(signUp({ email: 'grace@example.com', password: 'short' }))
        .pipe(Effect.flip)
      expect(email).toMatchObject({ _tag: 'EmailMalformed', fields: ['email'] })
      expect(password).toMatchObject({ _tag: 'PasswordLengthInvalid', fields: ['password'] })
    }),
  )

  it.effect('ends the Session on sign-out, and its cookie with it', () =>
    Effect.gen(function* () {
      const device = browser()
      yield* device.request(signIn(ada))
      yield* device.request(signOut)
      expect(yield* device.request(proven)).toEqual(Option.none())
      expect(device.cookies()).toEqual([])
    }),
  )
})

describe('signedIn', () => {
  const session = { account: { id: 'a-1', email: ada.email }, expiresAt: new Date() }

  it.effect('is the request’s Session when there is one', () =>
    Effect.gen(function* () {
      expect(
        yield* signedIn.pipe(Effect.provideService(CurrentSession, Option.some(session))),
      ).toBe(session)
    }),
  )

  it.effect('fails SignedOut, of kind Unauthenticated, when there is none', () =>
    Effect.gen(function* () {
      const error = yield* signedIn.pipe(
        Effect.provideService(CurrentSession, Option.none()),
        Effect.flip,
      )
      expect(error).toMatchObject({ _tag: 'SignedOut', kind: 'Unauthenticated' })
    }),
  )
})
