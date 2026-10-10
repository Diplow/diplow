// Assistant: a conversation with an agent that builds a System on the user's behalf. For now its
// Conversation alone, one per Account: a continuous timeline of Entries, read a day at a time, which
// records the Messages, every change to the System whoever made it, the imports, and where the user
// went. The conversations repository keeps the Entries (src/repositories/database/conversations/);
// Assistant decides what one says and when it dates from. It knows no Tile: the API layer hands it
// Mapping's summary of each change, and Assistant records it as it came. Every write runs in the
// transaction the API layer opens around it: its type requires one.
import { Clock, Effect, Schema } from 'effect'

import { Conversations } from '#/repositories/database/conversations/conversations'

import { type Day, type Entry, EntryContent, spanOf } from './entities'

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

/** The most a recorded Entry may date back: a day. */
const longestAgo = 24 * 60 * 60_000

/**
 * Records an Entry in the Account's Conversation, its first adding it, and answers it. It dates from
 * now, or from `ago` milliseconds before, a day at most: a merged navigation reaches the server once
 * the user did something else, and dates from its last gesture, which only the browser's clock saw,
 * so it says how long ago that was rather than when, and two clocks never disagree on the order.
 */
export const record = (accountId: string, content: EntryContent, ago = 0) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const at = new Date(now - Math.min(Math.max(ago, 0), longestAgo))
    const id = yield* Conversations.use((conversations) =>
      conversations.append(accountId, { at, content: encoded(content) }),
    )
    const entry: Entry = { ...content, id, at }
    return entry
  })
