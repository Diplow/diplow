// Assistant: a conversation with an agent that builds a System on the user's behalf. For now its
// Conversation alone, one per Account: a continuous timeline of Entries, read a day at a time, which
// records the Messages, every change to the System whoever made it, the imports, and where the user
// went. The conversations repository keeps the Entries (src/repositories/database/conversations/);
// Assistant decides what each Entry says and when it dates from. It knows no Tile: the API layer hands
// it Mapping's summary of each change, and Assistant records it as it came, with who acted. Every
// write runs in the transaction the API layer opens around it: its type requires one.
import { Clock, Effect, Schema } from 'effect'

import { Conversations } from '#/repositories/database/conversations/conversations'

import {
  type Actor,
  type Day,
  dayAt,
  type Entry,
  EntryContent,
  type Navigation,
  spanOf,
  type Summarized,
  within,
} from './entities'

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
  Conversations.use((conversations) => conversations.lastWritten(accountId))

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
