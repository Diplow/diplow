// Assistant's repository: the `conversation` and `conversation_entry` tables (../schema.ts), one
// Conversation per Account, read and written by Account. It speaks rows: an Entry's content is a JSON
// value Assistant encodes, decodes and bounds, which the repository keeps as it is given.
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { conversation, conversationEntry } from '../schema'

/** An Entry's row: its id, the instant it dates from, and its content, as Assistant encoded it. */
export interface EntryRow {
  readonly id: string
  readonly at: Date
  readonly content: unknown
}

/** The instants a read covers: from `from`, included, to `to`, excluded. */
export interface Span {
  readonly from: Date
  readonly to: Date
}

export class Conversations extends Context.Service<
  Conversations,
  {
    /**
     * Adds an Entry to the Account's Conversation, the Conversation first when it has none, and
     * answers the Entry's id. Inside a transaction, so the two never part.
     */
    readonly append: (
      accountId: string,
      entry: Omit<EntryRow, 'id'>,
    ) => Effect.Effect<string, never, InTransaction>
    /** The Entries of the Account's Conversation within a span, oldest first; none without one. */
    readonly between: (accountId: string, span: Span) => Effect.Effect<ReadonlyArray<EntryRow>>
    /** The instant of the Account's latest Entry before an instant, excluded; none without one. */
    readonly latestBefore: (accountId: string, before: Date) => Effect.Effect<Date | undefined>
    /**
     * The id of the Entry last written in the Account's Conversation, whatever instant it dates
     * from; none without one.
     */
    readonly lastEntry: (accountId: string) => Effect.Effect<string | undefined>
  }
>()('hexframe/Conversations') {}

const make = Effect.gen(function* () {
  const database = yield* Database

  /** The id of the Account's Conversation, added when it has none: one statement, two at once safe. */
  const conversationOf = (accountId: string) =>
    database
      .insert(conversation)
      .values({ id: crypto.randomUUID(), accountId })
      .onConflictDoUpdate({ target: conversation.accountId, set: { accountId } })
      .returning({ id: conversation.id })
      .pipe(
        Effect.orDie,
        Effect.flatMap(([added]) =>
          added === undefined
            ? Effect.die(new Error('A Conversation was neither added nor found'))
            : Effect.succeed(added.id),
        ),
      )

  const append = (accountId: string, { at, content }: Omit<EntryRow, 'id'>) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const conversationId = yield* conversationOf(accountId)
        const id = crypto.randomUUID()
        yield* database
          .insert(conversationEntry)
          .values({ id, conversationId, at, content })
          .pipe(Effect.orDie)
        return id
      }),
    )

  const between = (accountId: string, { from, to }: Span) =>
    database
      .select({
        id: conversationEntry.id,
        at: conversationEntry.at,
        content: conversationEntry.content,
      })
      .from(conversationEntry)
      .innerJoin(conversation, eq(conversationEntry.conversationId, conversation.id))
      .where(
        and(
          eq(conversation.accountId, accountId),
          gte(conversationEntry.at, from),
          lt(conversationEntry.at, to),
        ),
      )
      .orderBy(asc(conversationEntry.at), asc(conversationEntry.seq))
      .pipe(Effect.orDie)

  const latestBefore = (accountId: string, before: Date) =>
    database
      .select({ at: conversationEntry.at })
      .from(conversationEntry)
      .innerJoin(conversation, eq(conversationEntry.conversationId, conversation.id))
      .where(and(eq(conversation.accountId, accountId), lt(conversationEntry.at, before)))
      .orderBy(desc(conversationEntry.at))
      .limit(1)
      .pipe(
        Effect.orDie,
        Effect.map(([found]) => found?.at),
      )

  const lastEntry = (accountId: string) =>
    database
      .select({ id: conversationEntry.id })
      .from(conversationEntry)
      .innerJoin(conversation, eq(conversationEntry.conversationId, conversation.id))
      .where(eq(conversation.accountId, accountId))
      .orderBy(desc(conversationEntry.seq))
      .limit(1)
      .pipe(
        Effect.orDie,
        Effect.map(([found]) => found?.id),
      )

  return Conversations.of({ append, between, latestBefore, lastEntry })
})

/** The conversations repository, over the `Database` it is given. */
export const layer = Layer.effect(Conversations)(make)
