// Assistant's Turns: the `turn` table (../schema.ts), each a run of the agent answering one Message of
// an Account's Conversation, in the Mode it started in, read and written by Account. It speaks rows: how a Turn ended is a word
// Assistant decides and decodes, which the repository keeps as it is given. One Turn runs at most per
// Conversation, which the table's `turn_running_idx` holds, so two starts at once never both run. Its
// step, what its agent is doing now, is kept as Assistant encodes it, and dropped as it ends. What
// a Turn spent, and what its calls under way reserved, are sums of millionths of a dollar Assistant
// prices; a month's are the sums of its Turns'.
import { and, eq, gte, inArray, isNull, sum } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { conversation, conversationEntry, turn } from '../schema'

/** A Turn's row: how it ended and when, both null while it runs. */
export interface TurnRow {
  readonly id: string
  readonly conversationId: string
  readonly messageId: string
  readonly location: string
  /** The Mode it started in, as Assistant names it. */
  readonly mode: string
  readonly startedAt: Date
  readonly spent: number
  /** What its agent is doing now, as Assistant encoded it; null between steps and once it ended. */
  readonly step: unknown
  readonly endedAt: Date | null
  readonly end: string | null
}

/** What one of an Account's Turns, then all its Turns of a month, spent, and their calls under way reserved. */
export interface Spending {
  readonly turn: { readonly spent: number; readonly reserved: number }
  readonly month: { readonly spent: number; readonly reserved: number }
}

/**
 * A Turn as it starts: the Message it answers, by its Entry's id, the Tile it starts in, the Mode it
 * starts in, and when.
 */
export interface TurnStart {
  readonly messageId: string
  readonly location: string
  readonly mode: string
  readonly startedAt: Date
}

export class Turns extends Context.Service<
  Turns,
  {
    /**
     * Starts a Turn answering one of the Account's Messages, in its Conversation, and answers its
     * row; none while another runs there. Inside a transaction. A Message of no Conversation of the
     * Account's is a defect: the caller hands the Entry it just recorded.
     */
    readonly start: (
      accountId: string,
      start: TurnStart,
    ) => Effect.Effect<TurnRow | undefined, never, InTransaction>
    /**
     * Ends one of the Account's Turns, `end` saying how, at `at`, and answers its row; none for a Turn
     * that already ended, or that is not the Account's. Inside a transaction.
     */
    readonly end: (
      accountId: string,
      turnId: string,
      ended: { readonly end: string; readonly at: Date },
    ) => Effect.Effect<TurnRow | undefined, never, InTransaction>
    /**
     * Sets what one of the Account's running Turns is doing now, as Assistant encoded it, or drops it
     * with null; nothing for a Turn that ended, or another's. Inside a transaction.
     */
    readonly step: (
      accountId: string,
      turnId: string,
      step: unknown,
    ) => Effect.Effect<void, never, InTransaction>
    /** The Turn running in the Account's Conversation, if one does. */
    readonly running: (accountId: string) => Effect.Effect<TurnRow | undefined>
    /** One of the Account's Turns, by its id, running or ended; none for another's. */
    readonly byId: (accountId: string, turnId: string) => Effect.Effect<TurnRow | undefined>
    /**
     * What one of the Account's running Turns spent and its calls under way reserved, and the same
     * summed over all its Turns started since `since`, that one included, which no counter keeps. None
     * when the Turn is not running. Inside a transaction, the Turn's row locked until it ends, so two
     * calls of one Turn decide one at a time; one Turn runs at a time in an Account's Conversation, so
     * its lock holds the month's sums too.
     */
    readonly spending: (
      accountId: string,
      turnId: string,
      since: Date,
    ) => Effect.Effect<Spending | undefined, never, InTransaction>
    /**
     * What all the Account's Turns started since `since` spent, and what their calls under way
     * reserved, summed, which no counter keeps.
     */
    readonly spentSince: (
      accountId: string,
      since: Date,
    ) => Effect.Effect<{ readonly spent: number; readonly reserved: number }>
    /**
     * Adds to what one of the Account's Turns spent and to what its calls reserved, either less than
     * nothing, ended or not: a call that started before it ended still cost what it cost. Nothing for
     * another's Turn. Inside a transaction, the row locked while it adds.
     */
    readonly charge: (
      accountId: string,
      turnId: string,
      added: { readonly spent: number; readonly reserved: number },
    ) => Effect.Effect<void, never, InTransaction>
  }
>()('hexframe/Turns') {}

const columns = {
  id: turn.id,
  conversationId: turn.conversationId,
  messageId: turn.messageId,
  location: turn.location,
  mode: turn.mode,
  startedAt: turn.startedAt,
  spent: turn.spent,
  step: turn.step,
  endedAt: turn.endedAt,
  end: turn.end,
}

const make = Effect.gen(function* () {
  const database = yield* Database

  /** The Account's Conversation, by its id, as a subquery. */
  const conversationOf = (accountId: string) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.accountId, accountId))

  const start = (accountId: string, { messageId, location, mode, startedAt }: TurnStart) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const [message] = yield* database
          .select({ conversationId: conversationEntry.conversationId })
          .from(conversationEntry)
          .where(
            and(
              eq(conversationEntry.id, messageId),
              inArray(conversationEntry.conversationId, conversationOf(accountId)),
            ),
          )
          .pipe(Effect.orDie)
        if (message === undefined) {
          return yield* Effect.die(new Error("A Turn answers a Message of its Account's own"))
        }
        // Another running in the Conversation conflicts on `turn_running_idx`: nothing is added.
        const [started] = yield* database
          .insert(turn)
          .values({
            id: crypto.randomUUID(),
            conversationId: message.conversationId,
            messageId,
            location,
            mode,
            startedAt,
          })
          .onConflictDoNothing()
          .returning(columns)
          .pipe(Effect.orDie)
        return started
      }),
    )

  const end = (accountId: string, turnId: string, ended: { end: string; at: Date }) =>
    InTransaction.use(() =>
      database
        .update(turn)
        .set({ end: ended.end, endedAt: ended.at, step: null })
        .where(
          and(
            eq(turn.id, turnId),
            inArray(turn.conversationId, conversationOf(accountId)),
            isNull(turn.endedAt),
          ),
        )
        .returning(columns)
        .pipe(
          Effect.orDie,
          Effect.map(([row]) => row),
        ),
    )

  const step = (accountId: string, turnId: string, doing: unknown) =>
    InTransaction.use(() =>
      database
        .update(turn)
        .set({ step: doing })
        .where(
          and(
            eq(turn.id, turnId),
            inArray(turn.conversationId, conversationOf(accountId)),
            isNull(turn.endedAt),
          ),
        )
        .pipe(Effect.orDie, Effect.asVoid),
    )

  const running = (accountId: string) =>
    database
      .select(columns)
      .from(turn)
      .where(and(inArray(turn.conversationId, conversationOf(accountId)), isNull(turn.endedAt)))
      .pipe(
        Effect.orDie,
        Effect.map(([row]) => row),
      )

  const byId = (accountId: string, turnId: string) =>
    database
      .select(columns)
      .from(turn)
      .where(and(eq(turn.id, turnId), inArray(turn.conversationId, conversationOf(accountId))))
      .pipe(
        Effect.orDie,
        Effect.map(([row]) => row),
      )

  const spentSince = (accountId: string, since: Date) =>
    Effect.map(
      database
        .select({ spent: sum(turn.spent), reserved: sum(turn.reserved) })
        .from(turn)
        .where(
          and(inArray(turn.conversationId, conversationOf(accountId)), gte(turn.startedAt, since)),
        )
        .pipe(Effect.orDie),
      ([sums]) => ({ spent: Number(sums?.spent ?? 0), reserved: Number(sums?.reserved ?? 0) }),
    )

  const spentBy = (accountId: string, turnId: string, since: Date) =>
    Effect.gen(function* () {
      const [ofTheTurn] = yield* database
        .select({ spent: turn.spent, reserved: turn.reserved })
        .from(turn)
        .where(
          and(
            eq(turn.id, turnId),
            inArray(turn.conversationId, conversationOf(accountId)),
            isNull(turn.endedAt),
          ),
        )
        .for('update')
        .pipe(Effect.orDie)
      if (ofTheTurn === undefined) return undefined
      const month = yield* spentSince(accountId, since)
      const spending: Spending = { turn: ofTheTurn, month }
      return spending
    })

  const spending = (accountId: string, turnId: string, since: Date) =>
    InTransaction.use(() => spentBy(accountId, turnId, since))

  const charge = (
    accountId: string,
    turnId: string,
    added: { readonly spent: number; readonly reserved: number },
  ) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const ofTheAccount = and(
          eq(turn.id, turnId),
          inArray(turn.conversationId, conversationOf(accountId)),
        )
        const [row] = yield* database
          .select({ spent: turn.spent, reserved: turn.reserved })
          .from(turn)
          .where(ofTheAccount)
          .for('update')
          .pipe(Effect.orDie)
        if (row === undefined) return
        yield* database
          .update(turn)
          .set({ spent: row.spent + added.spent, reserved: row.reserved + added.reserved })
          .where(ofTheAccount)
          .pipe(Effect.orDie)
      }),
    )

  return Turns.of({ start, end, step, running, byId, spending, spentSince, charge })
})

/** The Turns repository, over the `Database` it is given. */
export const layer = Layer.effect(Turns)(make)
