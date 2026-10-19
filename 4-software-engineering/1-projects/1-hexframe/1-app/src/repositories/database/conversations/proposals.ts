// Assistant's Proposals and its Conversations' Modes: the `proposal` table and the `conversation`
// table's `mode` (../schema.ts), read and written by Account. It speaks rows: a Mode and a fate are
// words Assistant decides and decodes, and a Proposal's drafts a JSON value Assistant encodes, which
// nobody here reads. One Proposal is open at most per Conversation, which the table's
// `proposal_open_idx` holds, and a change locks the Conversation's row first, so two drafts never
// decide on the same Proposal at once.
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { conversation, proposal } from '../schema'

/**
 * An open Proposal's row: its id, its Entry, the Turn that opened it, its drafts, as encoded, and the
 * star of the System they change when it is someone else's, null otherwise.
 */
interface ProposalRow {
  readonly id: string
  readonly entryId: string
  readonly turnId: string
  readonly drafts: unknown
  readonly elsewhere: string | null
}

/** A Conversation as a change decides on it: its Mode, as Assistant named it, and its open Proposal. */
export interface ConversationRow {
  readonly mode: string
  readonly open: ProposalRow | undefined
}

/**
 * A Proposal as it opens: its id, its Entry, the Turn whose write opened it, its drafts, the star of
 * the System they change when it is someone else's, and when.
 */
export interface Opening {
  readonly id: string
  readonly entryId: string
  readonly turnId: string
  readonly drafts: unknown
  readonly elsewhere?: string | undefined
  readonly at: Date
}

export class Proposals extends Context.Service<
  Proposals,
  {
    /**
     * The Account's Conversation, added when it has none, its row locked until the transaction ends,
     * so no other change decides on it meanwhile: its Mode and its open Proposal. Inside a transaction.
     */
    readonly locked: (accountId: string) => Effect.Effect<ConversationRow, never, InTransaction>
    /** The Account's Conversation's Mode and open Proposal, as they stand; none without one. */
    readonly current: (accountId: string) => Effect.Effect<ConversationRow | undefined>
    /** Sets the Mode of the Account's Conversation, which `locked` added. Inside a transaction. */
    readonly setMode: (accountId: string, mode: string) => Effect.Effect<void, never, InTransaction>
    /**
     * Opens a Proposal in the Account's Conversation; one open already conflicts on
     * `proposal_open_idx`, a defect, since the caller decided on the locked Conversation. Inside a
     * transaction.
     */
    readonly open: (
      accountId: string,
      opening: Opening,
    ) => Effect.Effect<void, never, InTransaction>
    /** Sets the drafts of one of the Account's open Proposals, whole. Inside a transaction. */
    readonly write: (
      accountId: string,
      proposalId: string,
      drafts: unknown,
    ) => Effect.Effect<void, never, InTransaction>
    /**
     * Closes one of the Account's open Proposals, `fate` saying how the user decided it, at `at`.
     * Inside a transaction.
     */
    readonly decide: (
      accountId: string,
      proposalId: string,
      decided: { readonly fate: string; readonly at: Date },
    ) => Effect.Effect<void, never, InTransaction>
  }
>()('hexframe/Proposals') {}

const openColumns = {
  id: proposal.id,
  entryId: proposal.entryId,
  turnId: proposal.turnId,
  drafts: proposal.drafts,
  elsewhere: proposal.elsewhere,
}

const make = Effect.gen(function* () {
  const database = yield* Database

  /** The Account's Conversation, by its id, as a subquery. */
  const conversationOf = (accountId: string) =>
    database
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.accountId, accountId))

  /** The open Proposal of a Conversation, if one is. */
  const openIn = (conversationId: string) =>
    database
      .select(openColumns)
      .from(proposal)
      .where(and(eq(proposal.conversationId, conversationId), isNull(proposal.decidedAt)))
      .pipe(
        Effect.orDie,
        Effect.map(([row]) => row),
      )

  const locked = (accountId: string) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        // An upsert locks the row it adds or finds: one statement, two at once safe.
        const [found] = yield* database
          .insert(conversation)
          .values({ id: crypto.randomUUID(), accountId })
          .onConflictDoUpdate({ target: conversation.accountId, set: { accountId } })
          .returning({ id: conversation.id, mode: conversation.mode })
          .pipe(Effect.orDie)
        if (found === undefined) {
          return yield* Effect.die(new Error('A Conversation was neither added nor found'))
        }
        return { mode: found.mode, open: yield* openIn(found.id) }
      }),
    )

  const current = (accountId: string) =>
    Effect.gen(function* () {
      const [found] = yield* database
        .select({ id: conversation.id, mode: conversation.mode })
        .from(conversation)
        .where(eq(conversation.accountId, accountId))
        .pipe(Effect.orDie)
      if (found === undefined) return undefined
      return { mode: found.mode, open: yield* openIn(found.id) }
    })

  const setMode = (accountId: string, mode: string) =>
    InTransaction.use(() =>
      database
        .update(conversation)
        .set({ mode })
        .where(eq(conversation.accountId, accountId))
        .pipe(Effect.orDie, Effect.asVoid),
    )

  const open = (accountId: string, { id, entryId, turnId, drafts, elsewhere, at }: Opening) =>
    InTransaction.use(() =>
      Effect.gen(function* () {
        const [found] = yield* conversationOf(accountId).pipe(Effect.orDie)
        if (found === undefined) {
          return yield* Effect.die(new Error('A Proposal opened in no Conversation'))
        }
        yield* database
          .insert(proposal)
          .values({
            id,
            conversationId: found.id,
            entryId,
            turnId,
            drafts,
            elsewhere: elsewhere ?? null,
            openedAt: at,
          })
          .pipe(Effect.orDie)
      }),
    )

  /** One of the Account's open Proposals, by its id. */
  const openOf = (accountId: string, proposalId: string) =>
    and(
      eq(proposal.id, proposalId),
      inArray(proposal.conversationId, conversationOf(accountId)),
      isNull(proposal.decidedAt),
    )

  const write = (accountId: string, proposalId: string, drafts: unknown) =>
    InTransaction.use(() =>
      database
        .update(proposal)
        .set({ drafts })
        .where(openOf(accountId, proposalId))
        .pipe(Effect.orDie, Effect.asVoid),
    )

  const decide = (accountId: string, proposalId: string, decided: { fate: string; at: Date }) =>
    InTransaction.use(() =>
      database
        .update(proposal)
        .set({ fate: decided.fate, decidedAt: decided.at })
        .where(openOf(accountId, proposalId))
        .pipe(Effect.orDie, Effect.asVoid),
    )

  return Proposals.of({ locked, current, setMode, open, write, decide })
})

/** The Proposals repository, over the `Database` it is given. */
export const layer = Layer.effect(Proposals)(make)
