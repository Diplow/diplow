import { expect, layer } from '@effect/vitest'
import { Effect, Option } from 'effect'

import { browser, keyClient, TestAuth } from '#/repositories/auth/testing'

import {
  CurrentKey,
  CurrentSession,
  issueKey,
  keyName,
  keyProven,
  keys,
  proven,
  revokeKey,
  signUp,
  signedIn,
} from './iam'

// An Account's Keys on Better Auth for real, over PGlite. Each request is put together as its door
// does it: a server function's carries the Session its cookie proves and no Key, `/mcp`'s the Key its
// Bearer header proves and no Session.

let accounts = 0

/** Someone who just signed up, on a device that holds their Session. */
const someone = Effect.gen(function* () {
  accounts += 1
  const device = browser()
  const credentials = { email: `keys-${String(accounts)}@example.com`, password: 'lovelace1815' }
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

/** Runs `program` as `/mcp` does for a client holding `secret`: the Key it proves, no Session. */
const asKey =
  (secret: string) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    keyClient(secret).request(
      Effect.flatMap(keyProven, (key) =>
        program.pipe(
          Effect.provideService(CurrentSession, Option.none()),
          Effect.provideService(CurrentKey, key),
        ),
      ),
    )

layer(TestAuth)("an Account's Keys", (it) => {
  it.effect('issues a Key whose secret is shown once, and lists it without it', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const issued = yield* asSession(issueKey('Claude Code'))
      expect(issued.secret).toMatch(/^hf_[A-Za-z]{64}$/)
      expect(issued.key).toMatchObject({ name: 'Claude Code', lastUsedAt: null })
      expect(issued.secret.startsWith(issued.key.start)).toBe(true)

      const listed = yield* asSession(keys)
      expect(listed).toEqual([issued.key])
      expect(JSON.stringify(listed)).not.toContain(issued.secret.slice(issued.key.start.length))
    }),
  )

  it.effect('lists the newest Key first', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      yield* asSession(issueKey('first'))
      yield* asSession(issueKey('second'))
      expect((yield* asSession(keys)).map(({ name }) => name)).toEqual(['second', 'first'])
    }),
  )

  it.effect('signs a request in as the Account its Key proves, and records the use', () =>
    Effect.gen(function* () {
      const { account, asSession } = yield* someone
      const { key, secret } = yield* asSession(issueKey('script'))
      expect(yield* asKey(secret)(signedIn)).toEqual({
        account,
        by: { _tag: 'Key', keyId: key.id },
      })
      expect(Option.getOrThrow(yield* keyClient(secret).request(keyProven))).toEqual({
        account,
        keyId: key.id,
      })
      const [used] = yield* asSession(keys)
      expect(used?.lastUsedAt).toBeInstanceOf(Date)
    }),
  )

  it.effect('proves nothing from a wrong secret, another scheme, or a cookie', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const { secret } = yield* asSession(issueKey('script'))
      expect(yield* keyClient(`${secret}x`).request(keyProven)).toEqual(Option.none())
      expect(yield* keyClient(secret, 'Basic').request(keyProven)).toEqual(Option.none())
      expect(yield* asSession(keyProven)).toEqual(Option.none())
      const refused = yield* asKey(`${secret}x`)(signedIn).pipe(Effect.flip)
      expect(refused).toMatchObject({ _tag: 'SignedOut', kind: 'Unauthenticated' })
    }),
  )

  it.effect('revokes a Key, which proves nothing again and leaves the list', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const kept = yield* asSession(issueKey('kept'))
      const { key, secret } = yield* asSession(issueKey('revoked'))
      yield* asSession(revokeKey(key.id))
      expect(yield* keyClient(secret).request(keyProven)).toEqual(Option.none())
      expect(yield* asSession(keys)).toEqual([kept.key])
    }),
  )

  it.effect("cannot revoke another Account's Key, nor one that is gone", () =>
    Effect.gen(function* () {
      const owner = yield* someone
      const other = yield* someone
      const { key, secret } = yield* owner.asSession(issueKey('mine'))
      const refused = yield* other.asSession(revokeKey(key.id)).pipe(Effect.flip)
      expect(refused).toMatchObject({ _tag: 'KeyNotFound', kind: 'NotFound' })
      expect(Option.isSome(yield* keyClient(secret).request(keyProven))).toBe(true)
      const gone = yield* owner.asSession(revokeKey('nosuchkey')).pipe(Effect.flip)
      expect(gone).toMatchObject({ _tag: 'KeyNotFound' })
    }),
  )

  it.effect('refuses to let a Key issue, list or revoke Keys: that takes a Session', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      const { key, secret } = yield* asSession(issueKey('leaked'))
      const asLeaked = asKey(secret)
      const refusals = [
        yield* asLeaked(issueKey('another')).pipe(Effect.flip),
        yield* asLeaked(keys).pipe(Effect.flip),
        yield* asLeaked(revokeKey(key.id)).pipe(Effect.flip),
      ]
      for (const refused of refusals) {
        expect(refused).toMatchObject({ _tag: 'SessionRequired', kind: 'Forbidden' })
      }
      expect(yield* asSession(keys)).toHaveLength(1)
    }),
  )

  it.effect('refuses a Key with no name, or one longer than 32 characters, on the name', () =>
    Effect.gen(function* () {
      const { asSession } = yield* someone
      for (const name of ['', 'x'.repeat(33)]) {
        const refused = yield* asSession(issueKey(name)).pipe(Effect.flip)
        expect(refused).toMatchObject({ _tag: 'KeyNameInvalid', kind: 'Invalid', fields: ['name'] })
      }
      expect((yield* asSession(issueKey('x'.repeat(32)))).key.name).toHaveLength(32)
    }),
  )

  it.effect('names a Key by its id outside any request, for its own Account only, until revoked', () =>
    Effect.gen(function* () {
      const { account, asSession } = yield* someone
      const other = yield* someone
      const { key } = yield* asSession(issueKey('Claude Code'))
      expect(yield* keyName(account.id, key.id)).toEqual(Option.some('Claude Code'))
      expect(yield* keyName(other.account.id, key.id)).toEqual(Option.none())
      yield* asSession(revokeKey(key.id))
      expect(yield* keyName(account.id, key.id)).toEqual(Option.none())
    }),
  )

  it.effect('sends nobody signed in to sign in', () =>
    Effect.gen(function* () {
      const nobody = browser().request(
        issueKey('script').pipe(
          Effect.provideService(CurrentSession, Option.none()),
          Effect.provideService(CurrentKey, Option.none()),
        ),
      )
      expect(yield* Effect.flip(nobody)).toMatchObject({ _tag: 'SignedOut' })
    }),
  )
})
