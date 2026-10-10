// IAM's Turn's Keys: the `turn_key` table (../schema.ts), which Better Auth does not keep. A key is a
// random secret, `hft_` and 43 characters, kept as its SHA-256 alone, bound to a user and to the
// Conversation and the Turn it was issued for, until it expires or is revoked. The secret leaves this
// folder once, in what `issue` answers.
import { and, eq, gt, lte } from 'drizzle-orm'
import { Context, Effect, Encoding, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { turnKey, user } from '../schema'

/** What a Turn's Key is bound to: its user, and the Conversation and the Turn it was issued for. */
export interface TurnKeyBinding {
  readonly accountId: string
  readonly conversationId: string
  readonly turnId: string
}

/** Whose Turn's Key a secret is, and what it is bound to: the user, by id and email. */
export interface ProvenTurnKey {
  readonly user: { readonly id: string; readonly email: string }
  readonly conversationId: string
  readonly turnId: string
}

export class TurnKeys extends Context.Service<
  TurnKeys,
  {
    /**
     * Issues a key bound to a user, a Conversation and a Turn, proving it until `expiresAt`, and
     * answers its secret: the one time it is known. The user's keys expired by `now` go meanwhile.
     * Inside a transaction.
     */
    readonly issue: (
      binding: TurnKeyBinding,
      when: { readonly expiresAt: Date; readonly now: Date },
    ) => Effect.Effect<string, never, InTransaction>
    /**
     * Whose key a secret is, and what it is bound to, if it is one and has not expired by `now`. The
     * caller asks of a secret shaped as one (`isTurnKeySecret`).
     */
    readonly proven: (secret: string, now: Date) => Effect.Effect<ProvenTurnKey | undefined>
    /**
     * Revokes the key issued for one of a user's Turns, if it still exists: it proves nothing again.
     * Inside a transaction.
     */
    readonly revoke: (
      accountId: string,
      turnId: string,
    ) => Effect.Effect<void, never, InTransaction>
  }
>()('hexframe/TurnKeys') {}

/** What a Turn's Key's secret starts with, so it reads as one, and as no Key of Better Auth's. */
const prefix = 'hft_'

/** Whether a secret is shaped as a Turn's Key's, so no other keeper of keys need be asked about it. */
export const isTurnKeySecret = (secret: string) => secret.startsWith(prefix)

/** The secret's random part, in bytes: 32, as 43 characters of base64url. */
const randomBytes = 32

/** A new secret: the prefix, then 32 random bytes. */
const newSecret = () =>
  prefix + Encoding.encodeBase64Url(crypto.getRandomValues(new Uint8Array(randomBytes)))

/** What is kept of a secret: its SHA-256, in hex. A random secret needs no salt nor stretching. */
const hashOf = (secret: string) =>
  Effect.promise(() => crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))).pipe(
    Effect.map((digest) => Encoding.encodeHex(new Uint8Array(digest))),
  )

const make = Effect.gen(function* () {
  const database = yield* Database

  const issue = (binding: TurnKeyBinding, { expiresAt, now }: { expiresAt: Date; now: Date }) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const secret = newSecret()
        yield* database
          .delete(turnKey)
          .where(and(eq(turnKey.accountId, binding.accountId), lte(turnKey.expiresAt, now)))
          .pipe(Effect.orDie)
        yield* database
          .insert(turnKey)
          .values({ id: crypto.randomUUID(), ...binding, hash: yield* hashOf(secret), expiresAt })
          .pipe(Effect.orDie)
        return secret
      }),
    )

  const proven = (secret: string, now: Date) =>
    Effect.gen(function* () {
      const [found] = yield* database
        .select({
          id: user.id,
          email: user.email,
          conversationId: turnKey.conversationId,
          turnId: turnKey.turnId,
        })
        .from(turnKey)
        .innerJoin(user, eq(turnKey.accountId, user.id))
        .where(and(eq(turnKey.hash, yield* hashOf(secret)), gt(turnKey.expiresAt, now)))
        .pipe(Effect.orDie)
      if (found === undefined) return undefined
      const { id, email, conversationId, turnId } = found
      return { user: { id, email }, conversationId, turnId }
    })

  const revoke = (accountId: string, turnId: string) =>
    InTransaction.use(() =>
      database
        .delete(turnKey)
        .where(and(eq(turnKey.accountId, accountId), eq(turnKey.turnId, turnId)))
        .pipe(Effect.orDie, Effect.asVoid),
    )

  return TurnKeys.of({ issue, proven, revoke })
})

/** The Turn's Keys repository, over the `Database` it is given. */
export const layer = Layer.effect(TurnKeys)(make)
