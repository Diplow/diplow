// Assistant: a conversation with an agent that builds a System on the user's behalf. For now its
// Conversation alone, one per Account: a continuous timeline of Entries, read a day at a time, which
// records the Messages, every change to the System whoever made it, the imports, and where the user
// went. The conversations repository keeps the Entries (src/repositories/database/conversations/);
// Assistant decides what each Entry says and when it dates from. It knows no Tile: the API layer hands
// it Mapping's summary of each change, and Assistant records it as it came, with who acted. Every
// write runs in the transaction the API layer opens around it: its type requires one. And the
// Account's sandbox, where a Turn will run (src/repositories/agent/sandbox/), holding the System as
// the files Mapping writes it as, which Assistant keeps as they came. And the Turns, each a run of the
// agent answering a Message, one at a time per Conversation (src/repositories/database/conversations/).
// And what a Turn spends on the model: whether a call its agent makes may go, through the model relay
// (src/repositories/agent/anthropic/), and what it cost, recorded on the Turn (./spending/). And how a
// Turn runs: its prompt and its launcher written into the sandbox, its agent started there, and what
// its agent says as it runs, followed (./agent/). And the Conversation's Mode and its Proposal, the
// writes its agent drafts in ask, decided by its Decider (./operations/) on the Conversation it
// locked (src/repositories/database/conversations/proposals.ts).
import { Clock, Effect, Result, Schema } from 'effect'

import { Anthropic, type Endpoint } from '#/repositories/agent/anthropic/anthropic'
import { Sandbox, type SandboxFile } from '#/repositories/agent/sandbox/sandbox'
import { Conversations } from '#/repositories/database/conversations/conversations'
import { type ConversationRow, Proposals } from '#/repositories/database/conversations/proposals'
import { type TurnRow, Turns } from '#/repositories/database/conversations/turns'

import { type Launch, launchOf, processOf } from './agent/launch'
import { type Glimpse, type Linked, promptOf } from './agent/prompt'
import { type AgentEvent, readLine } from './agent/stream'
import {
  type Actor,
  agentText,
  type Day,
  dayAt,
  deadlineOf,
  type Entry,
  overdue,
  EntryContent,
  type Fate,
  firstMode,
  isBadEnd,
  Mode,
  type Navigation,
  ProposedChange,
  routeOf,
  spanOf,
  type Summarized,
  type Turn,
  TurnEnd,
  TurnStep,
  within,
} from './entities'
import { AllowanceSpent, TurnRunning } from './errors'
import {
  AcceptProposal,
  changesOf,
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
import { type Allowed, allowedCall, type CallRefused } from './spending/call'
import {
  allowanceSpent,
  charged,
  type Limit,
  limitReached,
  monthOf,
  mustWait,
  reserved,
} from './spending/limits'

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
 * now, or from `ago` milliseconds before, a day at most and never ahead.
 */
const record = (accountId: string, content: EntryContent, ago = 0) =>
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
 * Records a change to the System, or an import, as Mapping summarized it, with who acted: an Entry
 * of the Conversation of the Account it changed.
 */
export const recordChange = (accountId: string, summarized: Summarized, actor: Actor) =>
  record(accountId, { ...summarized, actor })

/**
 * Writes the System, as the files Mapping wrote it as, into the Account's sandbox, ensured first: the
 * whole of its System folder, whatever it held before gone, then read-only. What a Turn reads at its
 * start; what changed since, it reads through the MCP. Answers the sandbox, where a Turn then starts.
 */
export const writeSystem = (accountId: string, files: ReadonlyArray<SandboxFile>) =>
  Effect.flatMap(
    Sandbox.use((sandbox) => sandbox.ensure(accountId)),
    (box) => Effect.as(box.replaceSystem(files), box),
  )

const decodedEnd = Schema.decodeUnknownEffect(TurnEnd)

const decodedMode = Schema.decodeUnknownEffect(Mode)

const decodedStep = Schema.decodeUnknownEffect(TurnStep)

const encodedStep = Schema.encodeSync(TurnStep)

/**
 * A Turn as its row keeps it. One whose end or step Assistant cannot read back is a defect: it wrote
 * them.
 */
const turnOf = (row: TurnRow) =>
  Effect.gen(function* () {
    const { id, conversationId, messageId, location, startedAt, spent, endedAt, end } = row
    const mode = yield* Effect.orDie(decodedMode(row.mode))
    const turn: Turn = { id, conversationId, message: messageId, location, mode, startedAt, spent }
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
 * names, in the Mode its Conversation is in, and answers it: `AllowanceSpent` once the Account's Turns
 * spent the month's allowance; `TurnRunning` while another runs in its Conversation, one at a time,
 * one past its deadline included until `endOverdueTurn` ended it, which the caller does first, so it
 * revokes its Key with it.
 */
export const startTurn = (accountId: string, start: { message: string; location: string }) =>
  Effect.gen(function* () {
    const startedAt = new Date(yield* Clock.currentTimeMillis)
    const month = yield* Turns.use((turns) => turns.spentSince(accountId, monthOf(startedAt)))
    if (allowanceSpent(month.spent)) return yield* new AllowanceSpent()
    const { mode } = yield* conversationNow(accountId)
    const row = yield* Turns.use((turns) =>
      turns.start(accountId, {
        messageId: start.message,
        location: start.location,
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
    return ended
  })

/**
 * What became of a line of the agent's stream: no event, which no schema reads; or followed, and the
 * Turn it ended, if it did.
 */
type Followed =
  { readonly _tag: 'Malformed' } | { readonly _tag: 'Followed'; readonly ended?: Turn }

/** Follows the events of a line in order; answers the Turn once one of them ended it. */
const followed = (accountId: string, turnId: string, events: ReadonlyArray<AgentEvent>) =>
  Effect.gen(function* () {
    for (const event of events) {
      const running = yield* runningTurn(accountId)
      if (running?.id !== turnId) return undefined
      const step = (doing: TurnStep | null) =>
        Turns.use((turns) =>
          turns.step(accountId, turnId, doing === null ? null : encodedStep(doing)),
        )
      switch (event._tag) {
        case 'Said': {
          const text = agentText(event.text)
          if (text !== undefined)
            yield* record(accountId, { _tag: 'Message', author: 'agent', text })
          yield* step(null)
          break
        }
        case 'Stepping':
          yield* step(event.step)
          break
        case 'Finished':
          return yield* endTurn(accountId, turnId, event.how)
        case 'Exited':
          return yield* endTurn(accountId, turnId, 'sandbox')
      }
    }
    return undefined
  })

/**
 * Follows one line of what one of the Account's running Turns' agent says (`./agent/stream.ts`), its
 * events in order: its text kept as the agent's Messages, its step set, then dropped as it speaks
 * again; its result ending the Turn, by its answer, its ceiling or its sandbox; its exit, the stream
 * over, ending a Turn that gave no result by its sandbox. A line that is no event is `Malformed`, and
 * changes nothing. Nothing for a Turn that is not running, or not the Account's. In the transaction
 * the API layer opened.
 */
export const followTurn = (accountId: string, turnId: string, line: string) =>
  Effect.gen(function* () {
    const events = readLine(line)
    if (events === undefined) return { _tag: 'Malformed' } satisfies Followed
    const ended = yield* followed(accountId, turnId, events)
    const answer: Followed = { _tag: 'Followed', ...(ended !== undefined && { ended }) }
    return answer
  })

/**
 * Today's latest Entries of the Account's Conversation, for a reader whose clock stands `offset`
 * minutes ahead of UTC, oldest first: as many as a Turn's prompt holds.
 */
export const latestToday = (accountId: string, offset: number) =>
  Effect.flatMap(today(offset), (asked) =>
    Effect.map(day(accountId, asked), (entries) => entries.slice(-settings.turn.entries)),
  )

/** What starting a Turn's agent takes. */
export interface TurnStart {
  readonly turn: Turn
  readonly key: Launch['key']
  /** The System, as the files Mapping wrote it as. */
  readonly system: ReadonlyArray<SandboxFile>
  /** The origin the request that starts the Turn reached the app at, and the doors' paths there. */
  readonly origin: string
  readonly doors: Launch['doors']
  /** The Tile the Turn starts in, its Title, and its folder from the System folder. */
  readonly location: { readonly id: string; readonly title: string; readonly folder: string }
  /** The Message it answers. */
  readonly message: string
  /** The Tiles that Message links, where each lives now, in the order it links them. */
  readonly links: ReadonlyArray<Linked>
  /** Today's latest Entries, and the Titles of the Tiles they name by id (`namedTiles`). */
  readonly conversation: {
    readonly entries: ReadonlyArray<Entry>
    readonly titles: Readonly<Record<string, string>>
  }
  /** The Tiles on the user's screen, the centered one first. */
  readonly onScreen: ReadonlyArray<Glimpse>
  /** The id Help opens at. */
  readonly help: string
}

/**
 * Starts a Turn's agent in the Account's sandbox: the System written into it, whatever it held gone;
 * its prompt, its settings and its launcher written beside the System folder; then the launcher
 * started, detached, in the Tile's folder, the Turn's Key in its environment alone, reaching the app
 * where the sandbox reaches it. Should a Stop have ended the Turn while it started, its agent is
 * stopped at once: the Stop found nothing to stop yet.
 */
export const startAgent = (accountId: string, start: TurnStart) =>
  Effect.gen(function* () {
    const box = yield* writeSystem(accountId, start.system)
    const { agent, origin } = yield* Sandbox.use((sandbox) =>
      Effect.succeed({ agent: sandbox.agent, origin: sandbox.origin(start.origin) }),
    )
    const prompt = promptOf({
      ...start.conversation,
      onScreen: start.onScreen,
      location: start.location,
      links: start.links,
      help: start.help,
      mode: start.turn.mode,
    })
    const { files, run } = launchOf({
      turnId: start.turn.id,
      key: start.key,
      origin,
      doors: start.doors,
      home: box.home,
      agent,
      folder: start.location.folder,
      message: start.message,
      prompt,
    })
    yield* Effect.forEach(files, (file) => box.write(file), { discard: true })
    yield* box.start(run)
    if ((yield* runningTurn(accountId))?.id !== start.turn.id) yield* box.stop(run.name)
  })

/**
 * Stops the agent of one of the Account's Turns in its sandbox: interrupted, so it ends cleanly, then
 * killed past a grace; nothing when it no longer runs.
 */
export const stopAgent = (accountId: string, turnId: string) =>
  Effect.flatMap(
    Sandbox.use((sandbox) => sandbox.ensure(accountId)),
    (box) => box.stop(processOf(turnId)),
  )

/** A model call a Turn's agent asks the proxy for: its endpoint, Anthropic's headers, its body's text. */
export interface AskedCall {
  readonly endpoint: Endpoint
  readonly version: string | undefined
  readonly betas: string | undefined
  readonly body: string
}

/** A call let through and admitted on a Turn, with what it reserved of the Turn's spend. */
interface Admitted {
  readonly _tag: 'Admitted'
  readonly asked: AskedCall
  readonly call: Allowed
  readonly reserved: number
}

/**
 * What becomes of a model call before it goes: refused, by its body or its headers; refused since the
 * Turn is no longer running; held back by a limit the Turn reached, its ceiling or the month's
 * allowance, which ended the Turn so; asked to wait, until the calls under way settle, since with what
 * they reserved it would pass a limit; or admitted, the most it may cost reserved on the Turn.
 */
type Admission =
  | ({ readonly _tag: 'Refused' } & CallRefused)
  | { readonly _tag: 'TurnOver' }
  | { readonly _tag: 'Limited'; readonly limit: Limit }
  | { readonly _tag: 'Busy' }
  | Admitted

/**
 * Decides whether a call of one of the Account's Turns may go: its body and headers as the settings
 * let them through; the Turn still running, below its ceiling, and its Account's Turns this month
 * below the allowance. A call held back ends the Turn by the limit it reached. One admitted reserves
 * the most it may cost on the Turn, and one that would pass a limit with what the calls under way
 * reserved waits for them, so calls made at once stay under the limits. In the transaction the API
 * layer opens, the Turn's row locked until it commits, so they decide one after another.
 */
export const admitCall = (accountId: string, turnId: string, asked: AskedCall) =>
  Effect.gen(function* () {
    const allowed = allowedCall(asked)
    if (Result.isFailure(allowed)) {
      return { _tag: 'Refused', ...allowed.failure } satisfies Admission
    }
    const now = new Date(yield* Clock.currentTimeMillis)
    const spending = yield* Turns.use((turns) => turns.spending(accountId, turnId, monthOf(now)))
    if (spending === undefined) return { _tag: 'TurnOver' } satisfies Admission
    const limit = limitReached({ turn: spending.turn.spent, month: spending.month.spent })
    if (limit !== undefined) {
      yield* endTurn(accountId, turnId, limit)
      return { _tag: 'Limited', limit } satisfies Admission
    }
    const call = allowed.success
    const reserve = reserved(call.model, { maxTokens: call.maxTokens, length: asked.body.length })
    if (mustWait(spending, reserve)) return { _tag: 'Busy' } satisfies Admission
    yield* Turns.use((turns) => turns.charge(accountId, turnId, { spent: 0, reserved: reserve }))
    const admitted: Admission = { _tag: 'Admitted', asked, call, reserved: reserve }
    return admitted
  })

/**
 * Relays an admitted call through the model relay, which knows no limit, and answers Anthropic's
 * answer as it comes, with `charged`: what the call is charged once its answer has ended, been cut
 * short or failed.
 */
export const relayCall = ({ asked, call }: Admitted) =>
  Effect.gen(function* () {
    const { usage, ...relayed } = yield* Anthropic.use((anthropic) =>
      anthropic.relay({ ...asked, body: call.body }),
    )
    return {
      relayed,
      charged: Effect.map(usage, (used) => charged(call.model, call.maxTokens, used)),
    }
  })

/**
 * Settles an admitted call on its Turn, ended or not: what it reserved released, what it is charged
 * spent, since a call that started before the Turn ended still cost what it cost. In the transaction
 * the API layer opens.
 */
export const settleCall = (
  accountId: string,
  turnId: string,
  call: { readonly reserved: number; readonly charged: number },
) =>
  Turns.use((turns) =>
    turns.charge(accountId, turnId, { spent: call.charged, reserved: -call.reserved }),
  )

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
    const { id, entryId, turnId, drafts } = row.open
    const open: OpenProposal = {
      id,
      turn: turnId,
      drafts: yield* Effect.orDie(decodedDrafts(drafts)),
    }
    return { state: { mode, open } satisfies ConversationState, entry: entryId }
  })

/** The Account's Conversation's Mode and open Proposal, as they stand: `ask` and none before its first. */
const conversationNow = (accountId: string) =>
  Effect.map(
    Effect.flatMap(
      Proposals.use((proposals) => proposals.current(accountId)),
      stateOf,
    ),
    ({ state }) => state,
  )

/** The Mode the Account's Conversation is in: what its next Turn takes. */
export const conversationMode = (accountId: string) =>
  Effect.map(conversationNow(accountId), ({ mode }) => mode)

/**
 * The Account's open Proposal, if one is, as it stands: what the reads and the files of a Turn that
 * drafts show over the System, and the page.
 */
export const openProposal = (accountId: string) =>
  Effect.map(conversationNow(accountId), ({ open }) => open)

/**
 * The Account's open Proposal, if one is, its Conversation locked until the transaction ends, so no
 * other draft, accept nor discard decides on it meanwhile: what a draft folds over the System before
 * Assistant hears of it, and an accept runs. In the transaction the API layer opened.
 */
export const lockedProposal = (accountId: string) =>
  Effect.map(
    Effect.flatMap(
      Proposals.use((proposals) => proposals.locked(accountId)),
      stateOf,
    ),
    ({ state }) => state.open,
  )

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
        const opening = { id: event.id, entryId: opened.id, turnId: event.turn, at: now }
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
 * answers the Conversation they leave. What `decide` refuses is refused here, nothing written. In the
 * transaction the API layer opened.
 */
const operate = <E>(accountId: string, decided: (state: ConversationState) => Decided<E>) =>
  Effect.gen(function* () {
    const locked = yield* Proposals.use((proposals) => proposals.locked(accountId))
    const loaded = yield* stateOf(locked)
    const events = yield* Effect.fromResult(decided(loaded.state))
    let state = loaded.state
    let entry = loaded.entry
    for (const event of events) {
      const after = evolve(state, event)
      entry = yield* written(accountId, { event, before: state, after, entry })
      state = after
    }
    return state
  })

/** Switches the Mode of the Account's Conversation: the Turns started from then on take it. */
export const setMode = (accountId: string, mode: Mode) =>
  Effect.map(
    operate(accountId, (state) => decide(state, new SetMode({ mode }))),
    (state) => state.mode,
  )

/**
 * Drafts a write one of the Account's Turns made in ask into the Conversation's open Proposal, opening
 * one with its Entry when none is, and answers the Proposal: the write as the API layer encoded it,
 * opaque, and the changes it makes, as Mapping summarized them on the System the Proposal makes. In the
 * transaction the API layer opened, after `lockedProposal`.
 */
export const draft = (
  accountId: string,
  turnId: string,
  { write, changes }: { readonly write: unknown; readonly changes: ReadonlyArray<ProposedChange> },
) =>
  Effect.gen(function* () {
    const proposal = crypto.randomUUID()
    const state = yield* operate(accountId, (locked) =>
      decide(locked, new Draft({ turn: turnId, write, changes }), { proposal }),
    )
    if (state.open === undefined) return yield* Effect.die(new Error('A draft left no Proposal'))
    return state.open
  })

/**
 * Accepts the Account's open Proposal of this id, whole: refused `ProposalClosed` when it is open no
 * longer. The API layer runs its writes on the System in the same transaction, after `lockedProposal`,
 * and Assistant records that the user accepted it.
 */
export const acceptProposal = (accountId: string, proposal: string) =>
  Effect.asVoid(operate(accountId, (state) => decide(state, new AcceptProposal({ proposal }))))

/** Discards the Account's open Proposal of this id: refused `ProposalClosed` when it is open no longer. */
export const discardProposal = (accountId: string, proposal: string) =>
  Effect.asVoid(operate(accountId, (state) => decide(state, new DiscardProposal({ proposal }))))

/**
 * One of the Account's Turns, by its id, running or ended. A Turn of no Conversation of the Account's
 * is a defect: the caller takes its id from the Turn's Key, which proves it.
 */
export const turn = (accountId: string, turnId: string) =>
  Effect.gen(function* () {
    const row = yield* Turns.use((turns) => turns.byId(accountId, turnId))
    if (row === undefined) return yield* Effect.die(new Error("A Turn's Key proved no Turn"))
    return yield* turnOf(row)
  })

/**
 * What becomes of a write one of the Account's Turns makes, which the API layer routes on: drafted
 * into the Conversation's Proposal by a Turn that started in ask, applied by one that started in apply.
 */
export const route = (accountId: string, turnId: string) =>
  Effect.map(turn(accountId, turnId), routeOf)
