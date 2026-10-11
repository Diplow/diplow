// Where the API layer composes Assistant's Mode and Proposal with Mapping. For a write made with a
// Turn's Key, Assistant answers whether its Turn drafts or applies, and the MCP's write is routed on
// that answer: applied, Mapping answering what undoes it, which Assistant keeps with the Turn, or
// drafted into the Conversation's Proposal, decided by Mapping on the System the Proposal makes and
// written nowhere. The reads made with that Key, and the files its Turn starts with, show the same
// Proposal over the System. The user switches the Mode, and accepts a Proposal, its writes run by
// Mapping in one transaction as the Assistant's, what undoes them kept, or discards it; and undoes an
// applied Turn or an accepted Proposal, once, as themselves, from a Session. They sit in a module of
// their own because they reach the domains and the database.
import { Effect, Schema } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import type { Mode } from '#/domains/assistant/entities'
import { type OpenProposal, writesOf } from '#/domains/assistant/operations'
import * as Iam from '#/domains/iam/iam'
import type { Field } from '#/domains/mapping/entities'
import * as Mapping from '#/domains/mapping/mapping'
import { Batched, type Operation, Undo } from '#/domains/mapping/operations'
import { transactional } from '#/repositories/database/database'

import * as MappingPrograms from '../../mapping/programs'
import { actingAs } from '../../server/bus'

const decodedBatch = Schema.decodeUnknownEffect(Schema.Array(Batched))

const encodedBatched = Schema.encodeSync(Batched)

const decodedUndo = Schema.decodeUnknownEffect(Undo)

const encodedUndo = Schema.encodeSync(Undo)

/**
 * What undoes what the Assistant applied, as Mapping answered it, none before anything was. One
 * Mapping cannot read back is a defect: the API layer encoded every one by the same schema.
 */
const undoOf = (kept: unknown) =>
  kept === undefined ? Effect.succeed(undefined) : Effect.orDie(decodedUndo(kept))

/**
 * A Proposal's writes as Mapping batched them, none without one. A write Mapping cannot read back is
 * a defect: the API layer encoded every one by the same schema.
 */
const batchOf = (open: OpenProposal | undefined) =>
  open === undefined ? Effect.succeed([]) : Effect.orDie(decodedBatch(writesOf(open)))

/**
 * The batch one of the Account's Turns shows over the System, in its reads and its files, by
 * Assistant's `route`, as its writes are routed: its Conversation's open Proposal for a Turn that
 * drafts, none for one that applies.
 */
export const shownTo = (accountId: string, turnId: string) =>
  Effect.flatMap(Assistant.route(accountId, turnId), (route) =>
    route === 'apply'
      ? Effect.succeed([])
      : Effect.flatMap(Assistant.openProposal(accountId), batchOf),
  )

/**
 * The batch the request's reads show over the System: the Proposal its Turn drafts into, for a request
 * a Turn's Key proves; none for a Session or an Account's Key, which read the System as it stands.
 */
const shownOver = Effect.gen(function* () {
  const { account, by } = yield* Iam.signedIn
  if (by._tag !== 'TurnKey') return []
  return yield* shownTo(account.id, by.turnId)
})

/** The MCP's `map`: a Tile read to a depth, the System as the request's Turn sees it (`shownOver`). */
export const readTile = <F extends Field>(
  input: Omit<Parameters<typeof MappingPrograms.readTile<F>>[0], 'over'>,
) => Effect.flatMap(shownOver, (over) => MappingPrograms.readTile({ ...input, over }))

/** The MCP's `open_tile`: a Tile opened, the System as the request's Turn sees it (`shownOver`). */
export const openTile = <F extends Field>(
  input: Omit<Parameters<typeof MappingPrograms.openTile<F>>[0], 'over'>,
) => Effect.flatMap(shownOver, (over) => MappingPrograms.openTile({ ...input, over }))

/**
 * Drafts an Operation into the Account's open Proposal, in one transaction: the Conversation locked,
 * the Operation decided by Mapping on the System the Proposal makes, refused as it would be there, and
 * written into the Proposal, which the draft opens when none is. Answers, for a create or an edit, the
 * Tile as the Proposal makes it, with its Version, as the write applied would.
 */
const drafted = <O extends Operation>(accountId: string, turnId: string, operation: O) =>
  transactional(
    Effect.gen(function* () {
      const over = yield* batchOf(yield* Assistant.lockedProposal(accountId))
      const draft = yield* Mapping.draft(accountId, over, operation)
      const write = encodedBatched(draft.batched)
      yield* Assistant.draft(accountId, turnId, { write, changes: draft.changes })
      return draft.tile
    }),
  )

/**
 * Applies an Operation one of the Account's Turns wrote in apply, in one transaction: the Conversation
 * locked, what undoes the Turn's writes so far read, the Operation run by Mapping as its own function
 * runs it, and what undoes them all, this one's included, kept with the Turn, with the changes it
 * made. Answers, for a create or an edit, the Tile as it now stands, with its Version, as the write's
 * own program would.
 */
const applied = <O extends Operation>(accountId: string, turnId: string, operation: O) =>
  transactional(
    Effect.gen(function* () {
      const earlier = yield* undoOf(yield* Assistant.appliedSoFar(accountId, turnId))
      const run = yield* Mapping.applied(accountId, operation, earlier)
      const undo = encodedUndo(run.undo)
      yield* Assistant.turnApplied(accountId, turnId, { undo, changes: run.changes })
      return run.tile
    }),
  )

/**
 * A write made through the MCP, routed by what Assistant decides: drafted into the Proposal when a
 * Turn's Key that drafts made it, applied with what undoes it kept when one that applies did, and
 * `apply`d otherwise, the write's own program given the same Operation. The tool table names the
 * Operation and its program, and never asks the Mode.
 */
export const written = <O extends Operation, A, E, R>(
  operation: O,
  apply: (operation: O) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const { account, by } = yield* Iam.signedIn
    if (by._tag !== 'TurnKey') return yield* apply(operation)
    if ((yield* Assistant.route(account.id, by.turnId)) === 'apply') {
      return yield* applied(account.id, by.turnId, operation)
    }
    return yield* drafted(account.id, by.turnId, operation)
  })

/**
 * Runs an operation for the Account the request's Session proves: the Conversation, its Mode and its
 * Proposals are the user's, so neither a Key nor a Turn's Key switches, accepts or discards.
 */
const forSession = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) => operation(account.id))

/** Switches the Mode of the Account's Conversation, and answers it. */
export const setMode = ({ mode }: { readonly mode: Mode }) =>
  forSession((accountId) => transactional(Assistant.setMode(accountId, mode)))

/**
 * The Account's Conversation as the page follows it: its Mode, and its open Proposal by its id and how
 * many writes it holds, none when none is open, which the poll and each day of the Conversation
 * answer, so a draft reads the Conversation again. One read.
 */
export const conversationNow = (accountId: string) =>
  Effect.map(Assistant.conversationState(accountId), ({ mode, open }) => ({
    mode,
    ...(open !== undefined && { proposal: { id: open.id, drafts: open.drafts.length } }),
  }))

/**
 * Accepts the Account's open Proposal of this id, whole, in one transaction: Assistant accepts it,
 * `ProposalClosed` once it is open no longer, then its writes run by Mapping on the System as it
 * stands, under the Root's lock, all of them or none, each event published as the Assistant's, by the
 * Turn whose write opened it, and what undoes them kept with it, which its Entry then offers;
 * `BatchOutdated` once one of them no longer applies, a Tile changed since, by the Version it names,
 * or gone, the accept rolled back with it.
 */
export const acceptProposal = ({ proposal }: { readonly proposal: string }) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) =>
    transactional(
      Effect.gen(function* () {
        const accepted = yield* Assistant.acceptProposal(account.id, proposal)
        const { conversationId, id } = yield* Assistant.turn(account.id, accepted.turn)
        const assistant: Iam.SignedIn = {
          account,
          by: { _tag: 'TurnKey', conversationId, turnId: id },
        }
        const batch = yield* batchOf(accepted)
        const run = yield* actingAs(assistant)(Mapping.runBatch(account.id, batch))
        const undo = encodedUndo(run.undo)
        yield* Assistant.proposalApplied(account.id, accepted, { undo, changes: run.changes })
        return null
      }),
    ),
  )

/** Discards the Account's open Proposal of this id: `ProposalClosed` once it is open no longer. */
export const discardProposal = ({ proposal }: { readonly proposal: string }) =>
  forSession((accountId) =>
    Effect.as(transactional(Assistant.discardProposal(accountId, proposal)), null),
  )

/**
 * Undoes what one of the Account's Turns applied, or a Proposal it accepted, by its id, whole and
 * once, in one transaction: Assistant marks it undone, its Entry saying so, `NothingToUndo` once it
 * was undone already or never applied anything, then Mapping runs what undoes it on the System as it
 * stands, under the Root's lock, each event published as the user's, the Session's; `BatchOutdated`
 * once a Tile it touched changed since, the undo rolled back with it.
 */
export const undo = ({ applied: id }: { readonly applied: string }) =>
  forSession((accountId) =>
    transactional(
      Effect.gen(function* () {
        const undone = yield* Effect.orDie(decodedUndo(yield* Assistant.undo(accountId, id)))
        yield* Mapping.undo(accountId, undone)
        return null
      }),
    ),
  )
