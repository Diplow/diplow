// What the Turn's tests set and read below Assistant and IAM, which no program of the app does: a Turn
// that started earlier than it did, so its deadline passed without waiting for it; an Account's Turns
// having spent the month's allowance; and whether a Turn's Key is still kept, its secret never known
// to the test. For tests only.
import { eq, inArray } from 'drizzle-orm'
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
