// Where the API layer composes Assistant's Mode and Proposal with Mapping. For a write made with a
// Turn's Key, Assistant answers whether its Turn drafts or applies, and the MCP's write is routed on
// that answer: applied as any Key's, or drafted into the Conversation's Proposal, decided by Mapping on
// the System the Proposal makes and written nowhere. The reads made with that Key, and the files its
// Turn starts with, show the same Proposal over the System. The user switches the Mode, and accepts a
// Proposal, its writes run by Mapping in one transaction as the Assistant's, or discards it, from a
// Session. They sit in a module of their own because they reach the domains and the database.
import { Effect, Schema } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import { type Mode, routeOf, type Turn } from '#/domains/assistant/entities'
import { type OpenProposal, writesOf } from '#/domains/assistant/operations'
import * as Iam from '#/domains/iam/iam'
import type { Field } from '#/domains/mapping/entities'
import * as Mapping from '#/domains/mapping/mapping'
import { Batched, type Operation } from '#/domains/mapping/operations'
import { transactional } from '#/repositories/database/database'

import * as MappingPrograms from '../../mapping/programs'
import { actingAs } from '../../server/bus'

const decodedBatch = Schema.decodeUnknownEffect(Schema.Array(Batched))

const encodedBatched = Schema.encodeSync(Batched)

/**
 * A Proposal's writes as Mapping batched them, none without one. A write Mapping cannot read back is
 * a defect: the API layer encoded every one by the same schema.
 */
const batchOf = (open: OpenProposal | undefined) =>
  open === undefined ? Effect.succeed([]) : Effect.orDie(decodedBatch(writesOf(open)))

/**
 * The batch a Turn shows over the System, in its reads and its files: its Conversation's open
 * Proposal for a Turn that drafts, none for one that applies.
 */
export const shownTo = (accountId: string, turn: Pick<Turn, 'mode'>) =>
  routeOf(turn) === 'apply'
    ? Effect.succeed([])
    : Effect.flatMap(Assistant.openProposal(accountId), batchOf)

/**
 * The batch the request's reads show over the System: the Proposal its Turn drafts into, for a request
 * a Turn's Key proves; none for a Session or an Account's Key, which read the System as it stands.
 */
const shownOver = Effect.gen(function* () {
  const { account, by } = yield* Iam.signedIn
  if (by._tag !== 'TurnKey') return []
  return yield* shownTo(account.id, yield* Assistant.turn(account.id, by.turnId))
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
 * A write made through the MCP, routed by what Assistant decides: drafted into the Proposal when a
 * Turn's Key that drafts made it, `apply`d otherwise, the write's own program given the same
 * Operation, so the two never part. The tool table names the Operation and its program, and never asks
 * the Mode.
 */
export const written = <O extends Operation, A, E, R>(
  operation: O,
  apply: (operation: O) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const { account, by } = yield* Iam.signedIn
    if (by._tag !== 'TurnKey') return yield* apply(operation)
    if ((yield* Assistant.route(account.id, by.turnId)) === 'apply') return yield* apply(operation)
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
 * Turn whose write opened it; refused as Mapping refuses the first that no longer applies, a Tile
 * changed since (`TileChanged`, by the Version it names) or gone, the accept rolled back with it.
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
        yield* actingAs(assistant)(Mapping.runBatch(account.id, yield* batchOf(accepted)))
        return null
      }),
    ),
  )

/** Discards the Account's open Proposal of this id: `ProposalClosed` once it is open no longer. */
export const discardProposal = ({ proposal }: { readonly proposal: string }) =>
  forSession((accountId) =>
    Effect.as(transactional(Assistant.discardProposal(accountId, proposal)), null),
  )
