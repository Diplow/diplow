import { describe, expect, it, layer } from '@effect/vitest'
import { Clock, Effect, Layer, Option, Redacted } from 'effect'
import { TestClock } from 'effect/testing'

import { Allowlist, allowing } from '#/repositories/auth/allowlist'
import { browser, keyClient, TestAuth } from '#/repositories/auth/testing'
import { layer as turnKeysLayer } from '#/repositories/database/turn-keys/turn-keys'

import {
  CurrentKey,
  CurrentSession,
  entitled,
  entitledOnly,
  issueKey,
  issueTurnKey,
  keyProven,
  keys,
  proven,
  revokeKey,
  revokeTurnKey,
  sessionOnly,
  signUp,
  signedIn,
} from './iam'

// A Turn's Key, over PGlite, Better Auth for real beside it: issued from a Session, proving its
// Account, Conversation and Turn at a door that reads a Bearer header, until it expires or is revoked,
// and refused wherever only a Session may act. Then the `assistant` Entitlement, from a list kept by
// hand. The clock is the test's: a Key's expiry is read by it.

const TestLayer = Layer.provideMerge(turnKeysLayer, TestAuth)

let accounts = 0

/**
 * Someone who just signed up, on a device that holds their Session, the test's clock set to now, as
 * the repository's own is when it drops the Account's expired Keys.
 */
const someone = Effect.gen(function* () {
  yield* TestClock.setTime(Date.now())
  accounts += 1
  const device = browser()
  const credentials = { email: `turns-${String(accounts)}@example.com`, password: 'lovelace1815' }
  const account = yield* device.request(signUp(credentials))
  /** Runs `program` as a server function from this device: its Session, no Key. */
  const asSession = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    device.request(
      Effect.flatMap(proven, (session) =>
        program.pipe(
          Effect.provideService(CurrentSession, session),
          Effect.provideService(CurrentKey, Option.none()),
        ),
      ),
    )
  return { account, asSession }
})

/** Runs `program` as a door reading a Bearer header does: the Key it proves, no Session. */
const asBearer =
  (secret: Redacted.Redacted) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    keyClient(Redacted.value(secret)).request(
      Effect.flatMap(keyProven, (key) =>
        program.pipe(
          Effect.provideService(CurrentSession, Option.none()),
          Effect.provideService(CurrentKey, key),
        ),
      ),
    )

/** What a Turn's Key is bound to, for a Turn no other test uses. */
const aTurn = () => ({ conversationId: crypto.randomUUID(), turnId: crypto.randomUUID() })

/** Fifteen minutes from now, by the test's clock. */
const inFifteenMinutes = Effect.map(Clock.currentTimeMillis, (now) => new Date(now + 900_000))

layer(TestLayer)("a Turn's Key", (it) => {
  it.effect('is issued from a Session, its secret shown once, redacted', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const expiresAt = yield* inFifteenMinutes
      const issued = yield* asSession(issueTurnKey(aTurn(), expiresAt))
      expect(Redacted.value(issued.secret)).toMatch(/^hft_[A-Za-z0-9_-]{43}$/)
      expect(issued.expiresAt).toEqual(expiresAt)
      expect(JSON.stringify(issued)).not.toContain(Redacted.value(issued.secret))
    }),
  )

  it.effect('proves its Account, Conversation and Turn, and signs the request in by it', () =>
    Effect.gen(function* () {
      const { account, asSession } = yield* someone
      const turn = aTurn()
      const { secret } = yield* asSession(issueTurnKey(turn, yield* inFifteenMinutes))
      const by = { _tag: 'TurnKey', ...turn }
      expect(
        Option.getOrThrow(yield* keyClient(Redacted.value(secret)).request(keyProven)),
      ).toEqual({ account, by })
      expect(yield* asBearer(secret)(signedIn)).toEqual({ account, by })
    }),
  )

  it.effect('proves nothing once it expired, by the clock', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const { secret } = yield* asSession(issueTurnKey(aTurn(), yield* inFifteenMinutes))
      yield* TestClock.adjust('14 minutes')
      expect(Option.isSome(yield* keyClient(Redacted.value(secret)).request(keyProven))).toBe(true)
      yield* TestClock.adjust('1 minute')
      expect(yield* keyClient(Redacted.value(secret)).request(keyProven)).toEqual(Option.none())
      const refused = yield* asBearer(secret)(signedIn).pipe(Effect.flip)
      expect(refused).toMatchObject({ _tag: 'SignedOut' })
    }),
  )

  it.effect('proves nothing once revoked, with no Session needed, and only its own Turn', () =>
    Effect.gen(function* () {
      const { account, asSession } = yield* someone
      const turn = aTurn()
      const other = aTurn()
      const { secret } = yield* asSession(issueTurnKey(turn, yield* inFifteenMinutes))
      const kept = yield* asSession(issueTurnKey(other, yield* inFifteenMinutes))
      yield* revokeTurnKey(account.id, turn.turnId)
      expect(yield* keyClient(Redacted.value(secret)).request(keyProven)).toEqual(Option.none())
      expect(Option.isSome(yield* keyClient(Redacted.value(kept.secret)).request(keyProven))).toBe(
        true,
      )
      // A Key already gone is no error.
      yield* revokeTurnKey(account.id, turn.turnId)
    }),
  )

  it.effect("is revoked only by its own Account's", () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const stranger = yield* someone
      const turn = aTurn()
      const { secret } = yield* asSession(issueTurnKey(turn, yield* inFifteenMinutes))
      yield* revokeTurnKey(stranger.account.id, turn.turnId)
      expect(Option.isSome(yield* keyClient(Redacted.value(secret)).request(keyProven))).toBe(true)
    }),
  )

  it.effect('manages no Key, starts no Turn, and is never listed among the Keys', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const { secret } = yield* asSession(issueTurnKey(aTurn(), yield* inFifteenMinutes))
      const refusedBy = <A, E, R>(program: Effect.Effect<A, E, R>) =>
        Effect.map(asBearer(secret)(program).pipe(Effect.flip), (refused) => {
          expect(refused).toMatchObject({ _tag: 'SessionRequired', kind: 'Forbidden' })
        })
      yield* refusedBy(sessionOnly)
      yield* refusedBy(issueKey('mine now'))
      yield* refusedBy(keys)
      yield* refusedBy(revokeKey('any'))
      yield* refusedBy(issueTurnKey(aTurn(), yield* inFifteenMinutes))
      expect(yield* asSession(keys)).toEqual([])
    }),
  )

  it.effect('is issued from a Session only: a Key alone, or nobody, issues none', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const { secret } = yield* asSession(issueKey('script'))
      const byKey = yield* keyClient(secret)
        .request(
          Effect.flatMap(keyProven, (key) =>
            issueTurnKey(aTurn(), new Date()).pipe(
              Effect.provideService(CurrentSession, Option.none()),
              Effect.provideService(CurrentKey, key),
            ),
          ),
        )
        .pipe(Effect.flip)
      expect(byKey).toMatchObject({ _tag: 'SessionRequired' })
      const byNobody = yield* issueTurnKey(aTurn(), new Date()).pipe(
        Effect.provideService(CurrentSession, Option.none()),
        Effect.provideService(CurrentKey, Option.none()),
        Effect.flip,
      )
      expect(byNobody).toMatchObject({ _tag: 'SignedOut' })
    }),
  )

  it.effect("leaves an Account's own Keys proving as they did", () =>
    Effect.gen(function* () {
      const { account, asSession } = yield* someone
      yield* asSession(issueTurnKey(aTurn(), yield* inFifteenMinutes))
      const { key, secret } = yield* asSession(issueKey('script'))
      expect(Option.getOrThrow(yield* keyClient(secret).request(keyProven))).toEqual({
        account,
        by: { _tag: 'Key', keyId: key.id },
      })
      expect(yield* keyClient('hft_not-a-key').request(keyProven)).toEqual(Option.none())
    }),
  )
})

describe('the assistant Entitlement', () => {
  const ada = { id: 'a-1', email: 'ada@example.com' }
  const grace = { id: 'a-2', email: 'grace@example.com' }
  const listing = (emails: ReadonlyArray<string>) =>
    Effect.provideService(Allowlist, allowing({ assistant: emails }))

  it.effect('is an Account whose email the list names, whatever its case and spacing', () =>
    Effect.gen(function* () {
      const list = listing([' Ada@Example.com ', ''])
      expect(yield* entitled(ada, 'assistant').pipe(list)).toBe(true)
      yield* entitledOnly(ada, 'assistant').pipe(list)
    }),
  )

  it.effect('is missing for any other, refused as Forbidden', () =>
    Effect.gen(function* () {
      const list = listing(['ada@example.com'])
      expect(yield* entitled(grace, 'assistant').pipe(list)).toBe(false)
      const refused = yield* entitledOnly(grace, 'assistant').pipe(list, Effect.flip)
      expect(refused).toMatchObject({
        _tag: 'EntitlementMissing',
        kind: 'Forbidden',
        entitlement: 'assistant',
      })
    }),
  )

  it.effect('is missing for everyone when the list is empty', () =>
    Effect.gen(function* () {
      expect(yield* entitled(ada, 'assistant').pipe(listing(['']))).toBe(false)
    }),
  )
})
