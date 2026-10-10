// The programs behind Assistant's server functions (./assistant.ts): each runs for the Account the
// request's Session proves, or fails with IAM's `SessionRequired` or `SignedOut`, and a write in the
// transaction it opens. They sit in a module of their own because they reach the domains and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import type { Day, Navigation } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { transactional } from '#/repositories/database/database'

/**
 * Runs an operation for the Account the request's Session proves: the Conversation is the user's,
 * so a Key, even one a script sends from the page's origin, reads and writes none of it.
 */
const forSession = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) => operation(account.id))

/**
 * A day of the Account's Conversation, today when no date is asked: the day, its Entries oldest
 * first, and the Titles of the Tiles its navigations went to, as the System holds them now, by id. A
 * navigation keeps a Tile's id alone; a Tile the System no longer holds has no Title there.
 */
export const conversationDay = ({
  date,
  offset,
}: Partial<Pick<Day, 'date'>> & Pick<Day, 'offset'>) =>
  forSession((accountId) =>
    Effect.gen(function* () {
      const day = date === undefined ? yield* Assistant.today(offset) : { date, offset }
      const entries = yield* Assistant.day(accountId, day)
      const visited = entries.flatMap((entry) =>
        entry._tag === 'Navigation' ? entry.steps.map(({ tile }) => tile) : [],
      )
      const titles = yield* Mapping.titles(accountId, [...new Set(visited)])
      return { day, entries, titles }
    }),
  )

/** Posts the user's Message in their Conversation, and answers its Entry. No agent answers yet. */
export const postMessage = ({ text }: { readonly text: string }) =>
  forSession((accountId) =>
    transactional(Assistant.record(accountId, { _tag: 'Message', author: 'user', text })),
  )

/**
 * Records where the user went, consecutive navigations merged into one Entry by the browser, dated
 * from its last gesture, `sinceLast` milliseconds before the server received it.
 */
export const recordNavigation = ({
  navigation,
  sinceLast,
}: {
  readonly navigation: Navigation
  readonly sinceLast: number
}) => forSession((accountId) => transactional(Assistant.record(accountId, navigation, sinceLast)))
