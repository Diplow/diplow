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
// (src/repositories/agent/anthropic/), and what it cost, recorded on the Turn (./spending/).
import { Clock, Effect, Result, Schema } from 'effect'

import { Anthropic, type Endpoint, type Relayed } from '#/repositories/agent/anthropic/anthropic'
import { Sandbox, type SandboxFile } from '#/repositories/agent/sandbox/sandbox'
import type { InTransaction } from '#/repositories/database/database'
import { Conversations } from '#/repositories/database/conversations/conversations'
import { type TurnRow, Turns } from '#/repositories/database/conversations/turns'

import {
  type Actor,
  type Day,
  dayAt,
  deadlineOf,
  type Entry,
  EntryContent,
  type Navigation,
  spanOf,
  type Summarized,
  type Turn,
  TurnEnd,
  within,
} from './entities'
import { TurnRunning } from './errors'
import { settings } from './settings'
import { allowedCall, type CallRefused } from './spending/call'
import { type Limit, limitReached, monthOf, priced } from './spending/limits'

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
 * start; what changed since, it reads through the MCP.
 */
export const writeSystem = (accountId: string, files: ReadonlyArray<SandboxFile>) =>
  Effect.flatMap(
    Sandbox.use((sandbox) => sandbox.ensure(accountId)),
    (box) => box.replaceSystem(files),
  )

const decodedEnd = Schema.decodeUnknownEffect(TurnEnd)

/** A Turn as its row keeps it. One whose end Assistant cannot read back is a defect: it wrote it. */
const turnOf = (row: TurnRow) =>
  Effect.gen(function* () {
    const { id, conversationId, messageId, location, startedAt, spent, endedAt, end } = row
    const turn: Turn = { id, conversationId, message: messageId, location, startedAt, spent }
    if (endedAt === null) return turn
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
 * Starts a Turn answering one of the Account's Messages, by its Entry's id, in the Tile `location`
 * names, and answers it; `TurnRunning` while another runs in its Conversation, one at a time. One
 * still running past its deadline, which nothing ended, ends first, by its time, so a lost Turn never
 * holds its Conversation.
 */
export const startTurn = (accountId: string, start: { message: string; location: string }) =>
  Effect.gen(function* () {
    const startedAt = new Date(yield* Clock.currentTimeMillis)
    const running = yield* runningTurn(accountId)
    if (running !== undefined && deadline(running) <= startedAt) {
      yield* endTurn(accountId, running.id, 'time')
    }
    const row = yield* Turns.use((turns) =>
      turns.start(accountId, { messageId: start.message, location: start.location, startedAt }),
    )
    if (row === undefined) return yield* new TurnRunning()
    return yield* turnOf(row)
  })

/**
 * Ends one of the Account's Turns, saying how, and answers it; none for one that already ended, or
 * that is not the Account's. Nothing it did is rolled back.
 */
export const endTurn = (accountId: string, turnId: string, how: TurnEnd) =>
  Effect.gen(function* () {
    const at = new Date(yield* Clock.currentTimeMillis)
    const row = yield* Turns.use((turns) => turns.end(accountId, turnId, { end: how, at }))
    return row === undefined ? undefined : yield* turnOf(row)
  })

/** A model call a Turn's agent asks the proxy for: its endpoint, Anthropic's headers, its body's text. */
export interface AskedCall {
  readonly endpoint: Endpoint
  readonly version: string | undefined
  readonly betas: string | undefined
  readonly body: string
}

/**
 * What becomes of a model call: refused, by its body or its betas; held back by a limit the Turn
 * reached, its ceiling or the month's allowance; refused since the Turn is no longer running; or
 * relayed, the answer as it comes, with what records its cost on the Turn once its body has ended.
 */
export type CallAnswer =
  | ({ readonly _tag: 'Refused' } & CallRefused)
  | { readonly _tag: 'Limited'; readonly limit: Limit }
  | { readonly _tag: 'TurnOver' }
  | {
      readonly _tag: 'Relayed'
      readonly relayed: Omit<Relayed, 'usage'>
      /** Records what the call cost on the Turn, once its body has ended: in a transaction. */
      readonly metered: Effect.Effect<void, never, Turns | InTransaction>
    }

/**
 * Decides whether a call of one of the Account's Turns may go, and relays it when it may: its body
 * and betas as the settings let them through, `max_tokens` capped; the Turn still running, below its
 * ceiling, and its Account's Turns this month below the allowance. The relay knows no limit: it is
 * asked only once Assistant has said the Turn may spend.
 */
export const modelCall = (accountId: string, turnId: string, asked: AskedCall) =>
  Effect.gen(function* () {
    const allowed = allowedCall(asked.body, asked.betas)
    if (Result.isFailure(allowed)) return { _tag: 'Refused', ...allowed.failure } satisfies CallAnswer
    const now = new Date(yield* Clock.currentTimeMillis)
    const spent = yield* Turns.use((turns) => turns.spending(accountId, turnId, monthOf(now)))
    if (spent.turn === undefined) return { _tag: 'TurnOver' } satisfies CallAnswer
    const limit = limitReached({ turn: spent.turn, month: spent.month })
    if (limit !== undefined) return { _tag: 'Limited', limit } satisfies CallAnswer
    const { body, model } = allowed.success
    const { usage, ...relayed } = yield* Anthropic.use((anthropic) =>
      anthropic.relay({ endpoint: asked.endpoint, version: asked.version, betas: asked.betas, body }),
    )
    const metered = Effect.flatMap(usage, (used) => {
      const cost = used === undefined ? 0 : priced(model, used)
      return cost === 0 ? Effect.void : Turns.use((turns) => turns.spend(accountId, turnId, cost))
    })
    const answer: CallAnswer = { _tag: 'Relayed', relayed, metered }
    return answer
  })
