// The programs behind Assistant's server functions (./assistant.ts): each runs for the Account the
// request's Session proves, or fails with IAM's `SessionRequired` or `SignedOut`, and a write in the
// transaction it opens. They sit in a module of their own because they reach the domains and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import { visitedTiles } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import { tileLink } from '../mapping/files/download'

import type { DayAsked, MergedNavigation, NewMessage } from './assistant'

/**
 * Runs an operation for the Account the request's Session proves: the Conversation is the user's,
 * so a Key, even one a script sends from the page's origin, reads and writes none of it.
 */
const forSession = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) => operation(account.id))

/**
 * A day of the Account's Conversation, today when no date is asked: the day, its Entries oldest
 * first, and the Titles of the Tiles its navigations went to, as the System holds them now, by id. A
 * navigation keeps a Tile's id alone; a Tile the System no longer holds has no Title there. With
 * them, `earlier`, the instant of the latest Entry before the day, where a reader scrolling back goes
 * next, and `lastEntry`, the Entry last recorded in the Conversation, which the page's poll compares
 * with its own (`latest`). It is read first: an Entry recorded meanwhile is among the day's, and the
 * next poll reads the day again for nothing rather than never.
 */
export const conversationDay = ({ date, ...offsets }: typeof DayAsked.Type) =>
  forSession((accountId) =>
    Effect.gen(function* () {
      const lastEntry = yield* Assistant.lastEntry(accountId)
      const day = { date: date ?? (yield* Assistant.today(offsets.offset)).date, ...offsets }
      const entries = yield* Assistant.day(accountId, day)
      const titles = yield* Mapping.titles(accountId, visitedTiles(entries))
      const earlier = yield* Assistant.before(accountId, day)
      return {
        day,
        entries,
        titles,
        ...(earlier !== undefined && { earlier }),
        ...(lastEntry !== undefined && { lastEntry }),
      }
    }),
  )

/**
 * The latest of what home shows, the smallest reads there are, which the page polls: the System's
 * Version, and the id of the Entry last recorded in the Conversation, none before the first. The page
 * reads the System again once the Version moved, and the Conversation once its last Entry is another.
 */
export const latest = forSession((accountId) =>
  Effect.gen(function* () {
    const version = yield* Mapping.systemVersion(accountId)
    const lastEntry = yield* Assistant.lastEntry(accountId)
    return { version, ...(lastEntry !== undefined && { lastEntry }) }
  }),
)

/** Posts the user's Message in their Conversation, and answers its Entry. No agent answers yet. */
export const postMessage = ({ text }: typeof NewMessage.Type) =>
  forSession((accountId) => transactional(Assistant.postMessage(accountId, text)))

/**
 * Records where the user went, consecutive navigations merged into one Entry by the browser, dated
 * from its last gesture, `sinceLast` milliseconds before the server received it.
 */
export const recordNavigation = ({ navigation, sinceLast }: typeof MergedNavigation.Type) =>
  forSession((accountId) =>
    transactional(Assistant.recordNavigation(accountId, navigation, sinceLast)),
  )

/**
 * The Account's System written into its sandbox, the files of Mapping's export of its Root, whatever
 * the sandbox held before gone: what a Turn reads at its start. Answers where each Tile lives in those
 * files, by id, from the same read, so a Turn starts in a Tile's folder and the prompt names a Tile's
 * path. A Reference whose Tile is gone links it on the site the request reached.
 */
export const systemInSandbox = (accountId: string) =>
  Effect.gen(function* () {
    const { url } = yield* HttpExchange
    const { files, places } = yield* Mapping.systemFiles(accountId, tileLink(url))
    yield* Assistant.writeSystem(accountId, files)
    return places
  })
