// Assistant's application service: the Conversation, one per Account. Its Entries, a continuous
// timeline read a day at a time, which records the Messages, every change to the System whoever made
// it, the imports, and where the user went; the conversations repository keeps them
// (src/repositories/database/conversations/), and Assistant decides what each says and when it dates
// from. It knows no Tile: the API layer hands it Mapping's summary of each change, and Assistant
// records it as it came, with who acted. Its Turns, each a run of the agent answering one of its
// Messages, one at a time, through the Turns repository. And its Mode and its open Proposal, the
// writes its Turns draft in ask, decided by its Decider (./operations/) on the Conversation it locked
// (src/repositories/database/conversations/proposals.ts), an accepted Proposal kept with what undoes
// it. Every write runs in the transaction the API layer opens around it: its type requires one, and
// each locks the Conversation's row first. The sub-models that run on it sit in concept folders the
// API layer calls as directly: how a Turn's agent runs (./agent/agent.ts), what a Turn spends on the
// model (./spending/admission.ts), and what the Assistant applied, undone once (./undo/undo.ts).
import { Clock, Effect, Result, Schema } from 'effect'

import { Applied } from '#/repositories/database/conversations/applied'
import { Conversations } from '#/repositories/database/conversations/conversations'
import { type ConversationRow, Proposals } from '#/repositories/database/conversations/proposals'
import { type TurnRow, Turns } from '#/repositories/database/conversations/turns'

import {
  type Day,
  dayAt,
  elsewhereOf,
  deadlineOf,
  type Entry,
  overdue,
  EntryContent,
  type Fate,
  firstMode,
  isBadEnd,
  Mode,
  type Navigation,
  type OwnActor,
  ProposedChange,
  routeOf,
  type Shared,
  spanOf,
  stillRunning,
  type Summarized,
  type Turn,
  TurnEnd,
  TurnStep,
  offeredNow,
  offeringEntry,
  within,
} from './entities'
import { AllowanceSpent, TurnRunning } from './errors'
import {
  AcceptProposal,
  changesOf,
  continuedBy,
  type ConversationEvent,
  type ConversationState,
  type Decided,
  decide,
  DiscardProposal,
  Draft,
  type DraftedWrite,
  evolve,
  type OpenProposal,
  SetMode,
} from './operations'
import { settings } from './settings'
import { allowanceSpent, monthOf } from './spending/limits'

const decoded = Schema.decodeUnknownEffect(EntryContent)

const encoded = Schema.encodeSync(EntryContent)

/** The Entries of one day of the Account's Conversation, oldest first: none before its first. */
export const day = (accountId: string, asked: Day) =>
  Effect.flatMap(
    Conversations.use((conversations) => conversations.between(accountId, spanOf(asked))),
    (rows) =>
      Effect.forEach(rows, ({ id, at, content }) =>
        // A row Assistant cannot read back is a defect: it wrote every one through the same schema.
        Effect.map(Effect.orDie(decoded(content)), (entry): Entry => ({ ...entry, id, at })),
      ),
  )

/**
 * The instant of the latest Entry before a day, which an earlier day of the reader's holds: where a
 * reader scrolling back goes next, the days in between empty. None before the first Entry.
 */
export const before = (accountId: string, asked: Day) =>
  Conversations.use((conversations) => conversations.latestBefore(accountId, spanOf(asked).from))

/**
 * The id of the Entry last recorded in the Account's Conversation, whatever instant it dates from,
 * a navigation dated back included: what a reader compares with the one it read, to know the
 * Conversation moved. None before the first.
 */
export const lastEntry = (accountId: string) =>
  Conversations.use((conversations) => conversations.lastEntry(accountId))

/** Today, for a reader whose clock stands `offset` minutes ahead of UTC. */
export const today = (offset: number) =>
  Effect.map(Clock.currentTimeMillis, (now) => dayAt(new Date(now), offset))

/**
 * Records an Entry in the Account's Conversation, its first adding it, and answers it. It dates from
 * now, or from `ago` milliseconds before, a day at most and never ahead. Exported for the concept
 * folders that record one, the agent's Messages among them.
 */
export const record = (accountId: string, content: EntryContent, ago = 0) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const at = new Date(now - within(ago))
    const id = yield* Conversations.use((conversations) =>
      conversations.append(accountId, { at, content: encoded(content) }),
    )
    const entry: Entry = { ...content, id, at }
    return entry
  })

/** Posts the user's Message in their Conversation, and answers its Entry. */
export const postMessage = (accountId: string, text: string) =>
  record(accountId, { _tag: 'Message', author: 'user', text })

/**
 * Records where the user went, consecutive navigations the browser merged into one Entry. It dates
 * from its last gesture, `ago` milliseconds before it reached the server: only the browser's clock
 * saw it, so the browser says how long ago that was rather than when, and two clocks never disagree
 * on the order of the timeline.
 */
export const recordNavigation = (accountId: string, navigation: Navigation, ago: number) =>
  record(accountId, navigation, ago)

/**
 * Records a change to a System, or an import, as Mapping summarized it, with who acted: an Entry of
 * the Conversation of the Account that made it, in its own System or, `elsewhere`, in someone else's,
 * which the Entry then says, its Tiles standing there.
 */
export const recordChange = (
  accountId: string,
  summarized: Summarized,
  actor: OwnActor,
  { elsewhere = false }: { readonly elsewhere?: boolean } = {},
) =>
  record(
    accountId,
    elsewhere && summarized._tag === 'Change'
      ? { ...summarized, actor, elsewhere }
      : { ...summarized, actor },
  )

/**
 * Records a Tile shared with the Account, in its own Conversation, as the API layer tells it: who
 * shared it, the Tile as it was then, and what the Account may do there. The one Entry an Account's
 * Conversation holds of a change it did not make: the owner of the Tile made it, in their System.
 */
export const recordShared = (accountId: string, shared: Omit<Shared, '_tag'>) =>
  record(accountId, { _tag: 'Shared', ...shared })

/**
 * Rewrites one of the Account's Entries as `change` says, the Entry as Assistant decoded it. An Entry
 * Assistant cannot read back, or that `change` has nothing for, is a defect: Assistant wrote it.
 * Exported for `./undo/`, whose undo says so in the Entry that offered it.
 */
export const rewritten = (
  accountId: string,
  entry: string,
  change: (content: EntryContent) => EntryContent | undefined,
) =>
  Effect.gen(function* () {
    const content = yield* Conversations.use((conversations) =>
      conversations.entry(accountId, entry),
    )
    const after = change(yield* Effect.orDie(decoded(content)))
    if (after === undefined) return yield* Effect.die(new Error('An Entry took no such change'))
    yield* Conversations.use((conversations) =>
      conversations.rewrite(accountId, entry, encoded(after)),
    )
  })

/**
 * Locks the Account's Conversation's row until the transaction ends, adding the Conversation when it
 * has none, and answers it as its row keeps it, its Mode and its open Proposal: the one lock every
 * write of the Conversation, its Turns', its Proposal's and what it applied takes first, in one
 * order, so two of them never decide on what the other is changing, and never wait on each other.
 */
export const lockConversation = (accountId: string) =>
  Proposals.use((proposals) => proposals.locked(accountId))

/**
 * Locks the Conversations of these Accounts until the transaction ends, each as `lockConversation`
 * locks it, in the order of their ids, whatever order they are given in: what a write that takes two
 * locks first, a Turn's in someone else's System, its own Account's Conversation and the owner's, so
 * two such writes, each in the other's System, never wait on each other. A lock taken again in the
 * same transaction is held already.
 */
export const lockConversations = (accountIds: ReadonlyArray<string>) =>
  Effect.forEach([...new Set(accountIds)].sort(), lockConversation, { discard: true })

const decodedEnd = Schema.decodeUnknownEffect(TurnEnd)

const decodedMode = Schema.decodeUnknownEffect(Mode)

const decodedStep = Schema.decodeUnknownEffect(TurnStep)

/**
 * A Turn as its row keeps it. One whose end or step Assistant cannot read back is a defect: it wrote
 * them.
 */
const turnOf = (row: TurnRow) =>
  Effect.gen(function* () {
    const { id, conversationId, messageId, location, startedAt, spent, endedAt, end } = row
    const mode = yield* Effect.orDie(decodedMode(row.mode))
    const turn: Turn = {
      id,
      conversationId,
      message: messageId,
      location,
      ...elsewhereOf(row.elsewhere),
      mode,
      startedAt,
      spent,
    }
    if (endedAt === null) {
      if (row.step === null) return turn
      return { ...turn, step: yield* Effect.orDie(decodedStep(row.step)) }
    }
    const how = yield* Effect.orDie(decodedEnd(end))
    return { ...turn, ended: { at: endedAt, how } }
  })

/** The Turn running in the Account's Conversation, if one does. */
export const runningTurn = (accountId: string) =>
  Effect.flatMap(
    Turns.use((turns) => turns.running(accountId)),
    (row) => (row === undefined ? Effect.succeed(undefined) : turnOf(row)),
  )

/** The latest a Turn may run until, by the Assistant's settings: what its Key proves it for. */
export const deadline = (turn: Turn) => deadlineOf(turn, settings.turn.longest)

/**
 * The Turn running in the Account's Conversation before its deadline, if one does: what the page
 * shows running. One past it is over, whatever its row says, and ends by its time once another starts.
 */
export const liveTurn = (accountId: string) =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis)
    const running = yield* runningTurn(accountId)
    return running === undefined || overdue(running, settings.turn.longest, now)
      ? undefined
      : running
  })

/**
 * Ends the Turn running in the Account's Conversation past its deadline, which nothing ended, by its
 * time, and answers it; none when none runs, or the one running is still in time. So a lost Turn
 * never holds its Conversation. In the transaction the API layer opened.
 */
export const endOverdueTurn = (accountId: string) =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis)
    const running = yield* runningTurn(accountId)
    if (running === undefined || !overdue(running, settings.turn.longest, now)) return undefined
    return yield* endTurn(accountId, running.id, 'time')
  })

/**
 * Starts a Turn answering one of the Account's Messages, by its Entry's id, in the Tile `location`
 * names, of the System `elsewhere` names when it is someone else's, by its star, which Assistant
 * keeps as it came, in the Mode its Conversation is in, and answers it: `AllowanceSpent` once the Account's Turns
 * spent the month's allowance; `TurnRunning` while another runs in its Conversation, one at a time,
 * one past its deadline included until `endOverdueTurn` ended it, which the caller does first, so it
 * revokes its Key with it.
 */
export const startTurn = (
  accountId: string,
  start: { message: string; location: string; elsewhere?: string | undefined },
) =>
  Effect.gen(function* () {
    const startedAt = new Date(yield* Clock.currentTimeMillis)
    const month = yield* Turns.use((turns) => turns.spentSince(accountId, monthOf(startedAt)))
    if (allowanceSpent(month.spent)) return yield* new AllowanceSpent()
    const { mode } = yield* conversationState(accountId)
    const row = yield* Turns.use((turns) =>
      turns.start(accountId, {
        messageId: start.message,
        location: start.location,
        elsewhere: start.elsewhere,
        mode,
        startedAt,
      }),
    )
    if (row === undefined) return yield* new TurnRunning()
    return yield* turnOf(row)
  })

/**
 * Ends one of the Account's Turns, saying how, and answers it; none for one that already ended, or
 * that is not the Account's. Its step is dropped, and an Entry says how it ended unless by its
 * answer, one ended by its time dated from its deadline. Nothing it did is rolled back.
 */
export const endTurn = (accountId: string, turnId: string, how: TurnEnd) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const at = new Date(now)
    const row = yield* Turns.use((turns) => turns.end(accountId, turnId, { end: how, at }))
    if (row === undefined) return undefined
    const ended = yield* turnOf(row)
    if (isBadEnd(how)) {
      const ago = how === 'time' ? now - deadline(ended).getTime() : 0
      yield* record(accountId, { _tag: 'TurnEnded', how }, ago)
    }
    yield* offerUndo(accountId, turnId, { ended: true })
    return ended
  })

/**
 * Records what one of the Account's Turns applied in an Entry that offers to undo it, when
 * `offeredNow` says so. The Conversation locked first, as a write of the Turn locks it
 * (`./undo/`'s `applyInTurn`), so a write that lands as the Turn ends is offered by one or the other.
 */
const offerUndo = (accountId: string, turnId: string, turnState: { readonly ended: boolean }) =>
  Effect.gen(function* () {
    yield* lockConversation(accountId)
    const kept = yield* Applied.use((applied) => applied.locked(accountId, turnId))
    if (kept === undefined || !offeredNow(kept, turnState)) return
    const { changes } = kept
    const entry = yield* record(accountId, {
      _tag: 'TurnApplied',
      turn: turnId,
      changes,
      undone: false,
    })
    yield* Applied.use((applied) => applied.offer(accountId, turnId, entry.id))
  })

const Drafts = Schema.Array(
  Schema.Struct({ write: Schema.Unknown, changes: Schema.Array(ProposedChange) }),
)

const decodedDrafts = Schema.decodeUnknownEffect(Drafts)

const encodedDrafts = Schema.encodeSync(Drafts)

/**
 * A Conversation as its row keeps it, as the Decider decides on it, with its open Proposal's Entry.
 * A Mode or drafts Assistant cannot read back is a defect: it wrote them.
 */
const stateOf = (row: ConversationRow | undefined) =>
  Effect.gen(function* () {
    if (row === undefined) return { state: { mode: firstMode } satisfies ConversationState }
    const mode = yield* Effect.orDie(decodedMode(row.mode))
    if (row.open === undefined) return { state: { mode } satisfies ConversationState }
    const { id, entryId, turnId, drafts, elsewhere } = row.open
    const open: OpenProposal = {
      id,
      turn: turnId,
      drafts: yield* Effect.orDie(decodedDrafts(drafts)),
      ...elsewhereOf(elsewhere),
    }
    return { state: { mode, open } satisfies ConversationState, entry: entryId }
  })

/**
 * The Account's Conversation as it stands, in one read: the Mode its next Turn takes, and its open
 * Proposal, if one is, what the page shows; `ask` and none before its first Entry.
 */
export const conversationState = (accountId: string) =>
  Effect.map(
    Effect.flatMap(
      Proposals.use((proposals) => proposals.current(accountId)),
      stateOf,
    ),
    ({ state }) => state,
  )

/**
 * The Account's open Proposal, if one is, as it stands: what the reads and the files of a Turn that
 * drafts show over the System.
 */
export const openProposal = (accountId: string) =>
  Effect.map(conversationState(accountId), ({ open }) => open)

/** A Proposal's Entry, as the timeline shows it: its changes, and how it stands. */
const proposalEntry = (
  proposal: string,
  drafts: ReadonlyArray<DraftedWrite>,
  fate: Fate,
): EntryContent => ({ _tag: 'Proposal', proposal, changes: changesOf({ drafts }), fate })

/** What one event writes, the Conversation before and after it, and its open Proposal's Entry. */
interface Written {
  readonly event: ConversationEvent
  readonly before: ConversationState
  readonly after: ConversationState
  readonly entry: string | undefined
}

/**
 * Writes one event of a Conversation: the one change to its rows it stands for, and its Proposal's
 * Entry following it. Answers the open Proposal's Entry after it.
 */
const written = (accountId: string, { event, before, after, entry }: Written) =>
  Effect.gen(function* () {
    const proposals = yield* Proposals
    const rewrite = (id: string, content: EntryContent) =>
      Conversations.use((conversations) => conversations.rewrite(accountId, id, encoded(content)))
    const now = new Date(yield* Clock.currentTimeMillis)
    switch (event._tag) {
      case 'ModeSet':
        yield* proposals.setMode(accountId, event.mode)
        return entry
      case 'ProposalOpened': {
        const opened = yield* record(accountId, proposalEntry(event.id, [], 'open'))
        const opening = {
          id: event.id,
          entryId: opened.id,
          turnId: event.turn,
          elsewhere: event.elsewhere,
          at: now,
        }
        yield* proposals.open(accountId, { ...opening, drafts: encodedDrafts([]) })
        return opened.id
      }
      case 'Drafted': {
        const drafts = after.open?.drafts ?? []
        yield* proposals.write(accountId, event.proposal, encodedDrafts(drafts))
        if (entry !== undefined)
          yield* rewrite(entry, proposalEntry(event.proposal, drafts, 'open'))
        return entry
      }
      case 'ProposalDecided': {
        yield* proposals.decide(accountId, event.proposal, { fate: event.fate, at: now })
        const drafts = before.open?.drafts ?? []
        if (entry !== undefined)
          yield* rewrite(entry, proposalEntry(event.proposal, drafts, event.fate))
        return undefined
      }
    }
  })

/**
 * Runs an Operation on the Account's Conversation: locks it, loads it, asks `decide` through
 * `decided`, then writes one change per event, as `evolve` leaves the Conversation after it, and
 * answers the Conversation as it stood before and as they leave it. What `decide` refuses is refused
 * here, nothing written. In the transaction the API layer opened.
 */
const operate = <E>(accountId: string, decided: (state: ConversationState) => Decided<E>) =>
  Effect.gen(function* () {
    const loaded = yield* stateOf(yield* lockConversation(accountId))
    const events = yield* Effect.fromResult(decided(loaded.state))
    let state = loaded.state
    let entry = loaded.entry
    for (const event of events) {
      const after = evolve(state, event)
      entry = yield* written(accountId, { event, before: state, after, entry })
      state = after
    }
    return { before: loaded.state, after: state, entry: loaded.entry }
  })

/** Switches the Mode of the Account's Conversation: the Turns started from then on take it. */
export const setMode = (accountId: string, mode: Mode) =>
  Effect.map(
    operate(accountId, (state) => decide(state, new SetMode({ mode }))),
    ({ after }) => after.mode,
  )

/** A write a Turn drafts, as the API layer hands it: the write, opaque, and the changes it makes. */
export interface Drafting {
  readonly write: unknown
  readonly changes: ReadonlyArray<ProposedChange>
}

/**
 * Drafts a write one of the Account's Turns made in ask into the Conversation's open Proposal, in the
 * one order it holds in: the Conversation locked until the transaction ends, so no other draft, accept
 * nor discard decides on the Proposal meanwhile; the Turn read once the lock is held, as its end takes
 * it, `TurnOver` once it ended (`stillRunning`), so a write proven just before a Stop finds the Turn
 * over rather than a Proposal the user decided on since; then the open Proposal the write continues,
 * if one is, `ProposalElsewhere` when the one open changes another System than the Turn works in
 * (`continuedBy`), given to `step`, which decides the write on the System the Proposal makes and
 * answers it, opaque, with the changes it makes there (Mapping's, in the API layer); then the write
 * kept in the Proposal, which it opens with its Entry when none is, over the Turn's System. Answers
 * the Proposal as the draft leaves it, and what `step` answered. What `step` refuses is refused,
 * nothing kept. In the transaction the API layer opened.
 */
export const draft = <A extends Drafting, E, R>(
  accountId: string,
  turnId: string,
  step: (open: OpenProposal | undefined) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const { state } = yield* stateOf(yield* lockConversation(accountId))
    const { elsewhere } = yield* writingTurn(accountId, turnId)
    const drafted = yield* step(yield* Effect.fromResult(continuedBy(state, elsewhere)))
    const { write, changes } = drafted
    const proposal = crypto.randomUUID()
    const { after } = yield* operate(accountId, (locked) =>
      decide(locked, new Draft({ turn: turnId, write, changes, ...elsewhereOf(elsewhere) }), {
        proposal,
      }),
    )
    if (after.open === undefined) return yield* Effect.die(new Error('A draft left no Proposal'))
    return { proposal: after.open, drafted }
  })

/** What the Assistant applied, as the API layer hands it: what undoes it, opaque, and its changes. */
export interface Applying {
  readonly undo: unknown
  readonly changes: number
}

/**
 * What an accepted Proposal applied, as the API layer hands it: its changes, and what undoes them,
 * opaque, which a Proposal over the Account's own System must answer and one over someone else's
 * (`elsewhere`) need not, its owner holding the Undo of each write.
 */
export interface Accepting {
  readonly undo?: unknown
  readonly changes: number
}

/**
 * Accepts the Account's open Proposal of this id, whole, in the one order it holds in: decided,
 * `ProposalClosed` when it is open no longer, as `decide` rules; then `run` given it as it stood,
 * which runs its writes on the System (Mapping's, in the API layer) and answers what undoes them and
 * the changes they made; and that kept with the Proposal, offered by its Entry, which then says it may
 * be undone (`offeringEntry`), so a Proposal accepted before undos were kept offers none; nor does
 * a Proposal over someone else's System (`elsewhere`), whose owner is offered the Undo of each write
 * instead. Answers what `run` answered. What `run` refuses rolls the
 * accept back with the transaction. In the transaction the API layer opened.
 */
export const acceptProposal = <A extends Accepting, E, R>(
  accountId: string,
  proposal: string,
  run: (accepted: OpenProposal) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const { before, entry } = yield* operate(accountId, (state) =>
      decide(state, new AcceptProposal({ proposal })),
    )
    const accepted = before.open
    if (accepted === undefined || entry === undefined) {
      return yield* Effect.die(new Error('A Proposal was accepted that was not open'))
    }
    const ran = yield* run(accepted)
    const { undo, changes } = ran
    // Over someone else's System, each write's Undo is its owner's: the Proposal keeps none.
    if (accepted.elsewhere !== undefined) return ran
    if (undo === undefined) {
      return yield* Effect.die(new Error("A Proposal over the Account's own System kept no undo"))
    }
    yield* Applied.use((applied) =>
      applied.keep(accountId, accepted.id, { undo, changes, entryId: entry }),
    )
    yield* rewritten(accountId, entry, offeringEntry)
    return ran
  })

/** Discards the Account's open Proposal of this id: refused `ProposalClosed` when it is open no longer. */
export const discardProposal = (accountId: string, proposal: string) =>
  Effect.asVoid(operate(accountId, (state) => decide(state, new DiscardProposal({ proposal }))))

/**
 * One of the Account's Turns, by its id, running or ended: what a write it makes and its route read.
 * A Turn of no Conversation of the Account's is a defect: the caller takes its id from the Turn's
 * Key, which proves it.
 */
const turn = (accountId: string, turnId: string) =>
  Effect.gen(function* () {
    const row = yield* Turns.use((turns) => turns.byId(accountId, turnId))
    if (row === undefined) return yield* Effect.die(new Error("A Turn's Key proved no Turn"))
    return yield* turnOf(row)
  })

/**
 * One of the Account's Turns as a write it makes needs it, drafted or applied, read once the
 * Conversation's lock is held: still running, or `TurnOver` once it ended (`stillRunning`). Exported
 * for `./undo/`'s `applyInTurn`.
 */
export const writingTurn = (accountId: string, turnId: string) =>
  Effect.flatMap(turn(accountId, turnId), (read) => Effect.fromResult(stillRunning(read)))

/**
 * What becomes of a write one of the Account's Turns makes, which the API layer routes on: drafted
 * into the Conversation's Proposal by a Turn that started in ask, applied by one that started in apply.
 */
export const route = (accountId: string, turnId: string) =>
  Effect.map(turn(accountId, turnId), routeOf)

/**
 * The star of the System one of the Account's Turns started in, by its id, when it is someone
 * else's (`elsewhere`), read on every call: what its Key reads and writes alone. None for the
 * Account's own, and none for a Turn of no Conversation of the Account's, whose Key would then reach
 * the Account's own System, as every Turn's did before one could start elsewhere.
 */
export const startedElsewhere = (accountId: string, turnId: string) =>
  Effect.map(
    Turns.use((turns) => turns.byId(accountId, turnId)),
    (row) => row?.elsewhere ?? undefined,
  )

/**
 * The open Proposal one of the Account's Turns shows over the System it reads, by its route and the
 * System it works in: the open one for a Turn that drafts, when it changes that System; none for a
 * Turn that applies, or when it changes another (`continuedBy`), which the Turn drafts nothing into.
 */
export const shownProposal = (accountId: string, turnId: string) =>
  Effect.gen(function* () {
    const read = yield* turn(accountId, turnId)
    if (routeOf(read) === 'apply') return undefined
    const state = yield* conversationState(accountId)
    return Result.getOrUndefined(continuedBy(state, read.elsewhere))
  })
