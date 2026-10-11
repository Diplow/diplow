// What the Turn's tests set and read below Assistant and IAM, which no program of the app does: a Turn
// that started earlier than it did, so its deadline passed without waiting for it; an Account's Turns
// having spent the month's allowance; whether a Turn's Key is still kept, its secret never known to
// the test; the Tile a Turn started in; and whether the transaction a test runs in locked an Account's
// Conversation's row. For tests only.
import { eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'

import { Database } from '../database'
import { conversation, turn, turnKey } from '../schema'

/** Sets when a Turn started. */
export const startedAt = (turnId: string, at: Date) =>
  Database.use((database) =>
    database
      .update(turn)
      .set({ startedAt: at })
      .where(eq(turn.id, turnId))
      .pipe(Effect.orDie, Effect.asVoid),
  )

/** Sets what each of an Account's Turns spent. */
export const everyTurnSpent = (accountId: string, spent: number) =>
  Database.use((database) =>
    database
      .update(turn)
      .set({ spent })
      .where(
        inArray(
          turn.conversationId,
          database
            .select({ id: conversation.id })
            .from(conversation)
            .where(eq(conversation.accountId, accountId)),
        ),
      )
      .pipe(Effect.orDie, Effect.asVoid),
  )

/** Whether the Key issued for a Turn is still kept: revoked, it is not. */
export const turnKeyKept = (turnId: string) =>
  Database.use((database) =>
    database
      .select({ id: turnKey.id })
      .from(turnKey)
      .where(eq(turnKey.turnId, turnId))
      .pipe(
        Effect.orDie,
        Effect.map((rows) => rows.length > 0),
      ),
  )

/** The Tile a Turn started in, by its id; none for a Turn there is not. */
export const startedIn = (turnId: string) =>
  Database.use((database) =>
    database
      .select({ location: turn.location })
      .from(turn)
      .where(eq(turn.id, turnId))
      .pipe(
        Effect.orDie,
        Effect.map(([row]) => row?.location),
      ),
  )

/**
 * Whether the transaction this runs in holds a lock on the Account's Conversation's row: the row's
 * `xmax` names the transaction that last locked or deleted it, this one's while it holds the lock.
 */
export const conversationLockedHere = (accountId: string) =>
  Database.use((database) =>
    database
      .select({
        // The `sql` tag, no lint rule to disable: the query builder names no system column (`xmax`)
        // and no transaction id. Test-only, it takes no input; the Account's id goes through `eq`.
        lockedBy: sql<string>`${conversation}.xmax::text`,
        here: sql<string>`pg_current_xact_id()::xid::text`,
      })
      .from(conversation)
      .where(eq(conversation.accountId, accountId))
      .pipe(
        Effect.orDie,
        Effect.map(([row]) => row !== undefined && row.lockedBy === row.here),
      ),
  )
