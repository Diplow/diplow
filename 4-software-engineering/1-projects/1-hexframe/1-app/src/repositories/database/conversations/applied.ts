// What the Assistant applied to an Account's System, an applied Turn's writes or an accepted
// Proposal's, and what undoes them: the `applied` table (../schema.ts), read and written by Account. It
// speaks rows: what undoes them is a JSON value Assistant was handed, which nobody here reads. The
// Entry that offers to undo them is set once there is one, and they are undone once at most, which
// `undone` holds by its condition on the row it locked.
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { applied, conversation } from '../schema'

/** What one Turn or Proposal applied: what undoes it, its changes, its Entry, and when it was undone. */
export interface AppliedRow {
  readonly undo: unknown
  readonly changes: number
  readonly entryId: string | null
  readonly undoneAt: Date | null
}

/** What a Turn or a Proposal applied, as it is kept: what undoes it, its changes, and its Entry once one is. */
export interface Kept {
  readonly undo: unknown
  readonly changes: number
  readonly entryId?: string
}

export class Applied extends Context.Service<
  Applied,
  {
    /**
     * What one of the Account's Turns or Proposals applied, by its id, its row locked until the
     * transaction ends; none before it applied anything. Inside a transaction.
     */
    readonly locked: (
      accountId: string,
      id: string,
    ) => Effect.Effect<AppliedRow | undefined, never, InTransaction>
    /**
     * Keeps what one of the Account's Turns or Proposals applied, by its id, in its Conversation:
     * added, or set whole over what was kept. Inside a transaction.
     */
    readonly keep: (
      accountId: string,
      id: string,
      kept: Kept,
    ) => Effect.Effect<void, never, InTransaction>
    /** Sets the Entry that offers to undo what one of them applied. Inside a transaction. */
    readonly offer: (
      accountId: string,
      id: string,
      entryId: string,
    ) => Effect.Effect<void, never, InTransaction>
    /**
     * Marks what one of them applied undone, at `at`, and answers what undoes it and its Entry; none
     * when it was undone already, offers no Entry yet, or is no Account's own. Inside a transaction.
     */
    readonly undone: (
      accountId: string,
      id: string,
      at: Date,
    ) => Effect.Effect<
      { readonly undo: unknown; readonly entryId: string } | undefined,
      never,
      InTransaction
    >
  }
>()('hexframe/Applied') {}

const make = Effect.gen(function* () {
  const database = yield* Database

  /** The Account's Conversation, by its id, as a subquery. */
  const conversationOf = (accountId: string) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.accountId, accountId))

  /** One of the Account's rows, by its id. */
  const ofTheAccount = (accountId: string, id: string) =>
    and(eq(applied.id, id), inArray(applied.conversationId, conversationOf(accountId)))

  const locked = (accountId: string, id: string) =>
    InTransaction.use(() =>
      database
        .select({
          undo: applied.undo,
          changes: applied.changes,
          entryId: applied.entryId,
          undoneAt: applied.undoneAt,
        })
        .from(applied)
        .where(ofTheAccount(accountId, id))
        .for('update')
        .pipe(
          Effect.orDie,
          Effect.map(([row]) => row),
        ),
    )

  const keep = (accountId: string, id: string, { undo, changes, entryId }: Kept) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const [found] = yield* conversationOf(accountId).pipe(Effect.orDie)
        if (found === undefined) {
          return yield* Effect.die(new Error('Something was applied in no Conversation'))
        }
        const set = { undo, changes, ...(entryId !== undefined && { entryId }) }
        yield* database
          .insert(applied)
          .values({ id, conversationId: found.id, ...set })
          .onConflictDoUpdate({
            target: applied.id,
            set,
            where: eq(applied.conversationId, found.id),
          })
          .pipe(Effect.orDie)
      }),
    )

  const offer = (accountId: string, id: string, entryId: string) =>
    InTransaction.use(() =>
      database
        .update(applied)
        .set({ entryId })
        .where(ofTheAccount(accountId, id))
        .pipe(Effect.orDie, Effect.asVoid),
    )

  const undone = (accountId: string, id: string, at: Date) =>
    InTransaction.use(() =>
      database
        .update(applied)
        .set({ undoneAt: at })
        .where(
          and(ofTheAccount(accountId, id), isNull(applied.undoneAt), isNotNull(applied.entryId)),
        )
        .returning({ undo: applied.undo, entryId: applied.entryId })
        .pipe(
          Effect.orDie,
          Effect.map(([row]) =>
            row?.entryId == null ? undefined : { undo: row.undo, entryId: row.entryId },
          ),
        ),
    )

  return Applied.of({ locked, keep, offer, undone })
})

/** The repository of what the Assistant applied, over the `Database` it is given. */
export const layer = Layer.effect(Applied)(make)
