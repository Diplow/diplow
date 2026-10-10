// The programs behind Assistant's server functions (./assistant.ts): each runs for the Account the
// request's Session proves, or fails with IAM's `SessionRequired` or `SignedOut`, and a write in the
// transaction it opens. A Message sent starts a Turn answering it, its Key's secret going to the
// sandbox alone, never to a browser; a Stop ends the Turn running; and the Turn's events, which its
// sandbox posts through the events door, are followed. They sit in a module of their own because they
// reach the domains and the database: the client imports the server functions, and only their
// handlers import this module, which Start strips from the client.
import { Effect } from 'effect'
import type { Redacted } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import { type TurnEnd, visitedTiles } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import type { Turn } from '#/domains/assistant/entities'
import { TileNotFound } from '#/domains/mapping/errors'
import * as Mapping from '#/domains/mapping/mapping'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import { tileLink } from '../mapping/files/download'
import { WaitUntil } from '../server/bus'

import type { DayAsked, MergedNavigation, NewMessage, SentMessage } from './assistant'

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
 * Version, the id of the Entry last recorded in the Conversation, none before the first, and the Turn
 * running before its deadline, by its id, with its agent's step now. The page reads the System again
 * once the Version moved, and the Conversation once its last Entry is another, and follows closely
 * while a Turn runs.
 */
export const latest = forSession((accountId) =>
  Effect.gen(function* () {
    const version = yield* Mapping.systemVersion(accountId)
    const lastEntry = yield* Assistant.lastEntry(accountId)
    const live = yield* Assistant.liveTurn(accountId)
    const turn =
      live === undefined
        ? undefined
        : { id: live.id, ...(live.step !== undefined && { step: live.step }) }
    return {
      version,
      ...(lastEntry !== undefined && { lastEntry }),
      ...(turn !== undefined && { turn }),
    }
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
 * path, and the sandbox, where the Turn then starts. A Reference whose Tile is gone links it on the
 * site the request reached.
 */
export const systemInSandbox = (accountId: string) =>
  Effect.gen(function* () {
    const { url } = yield* HttpExchange
    const { files, places } = yield* Mapping.systemFiles(accountId, tileLink(url))
    const box = yield* Assistant.writeSystem(accountId, files)
    return { places, box }
  })

/**
 * Whether the Account the request's Session proves may use the Assistant: its `assistant`
 * Entitlement, which the composer tells the user of when it is missing.
 */
export const assistantAvailable = Effect.flatMap(Iam.sessionOnly, ({ account }) =>
  Iam.entitled(account, 'assistant'),
)

/** Mapping's `TileNotFound` unless the id is a Tile of the Account's own System. */
const ownTile = (accountId: string, id: string) =>
  Effect.flatMap(Mapping.titles(accountId, [id]), (titled) =>
    id in titled ? Effect.void : Effect.fail(new TileNotFound()),
  )

/**
 * Starts a Turn answering one of the Account's Messages and issues its Key, inside the transaction
 * the caller opened: a Turn still running past its deadline ended first, by its time, its Key revoked;
 * then Assistant's `startTurn`, refused while another runs or once the month's allowance is spent;
 * then its Key, proving it until its maximum length has passed. Answers the Turn, its Key, and the
 * Turn ended by its time, if one was.
 */
const turnStarted = (accountId: string, start: { message: string; location: string }) =>
  Effect.gen(function* () {
    const overdue = yield* Assistant.endOverdueTurn(accountId)
    if (overdue !== undefined) yield* Iam.revokeTurnKey(accountId, overdue.id)
    const turn = yield* Assistant.startTurn(accountId, start)
    const binding = { conversationId: turn.conversationId, turnId: turn.id }
    const key = yield* Iam.issueTurnKey(binding, Assistant.deadline(turn))
    return { turn, key, ...(overdue !== undefined && { overdue }) }
  })

/**
 * Starts a Turn answering one of the Account's Messages, by its Entry's id, in the Tile `location`
 * names, and issues its Key, in one transaction: from a Session only, so neither a Key nor a Turn
 * starts one; for an Account with the `assistant` Entitlement, else `EntitlementMissing`; in a Tile of
 * the Account's own System, else Mapping's `TileNotFound`; under the month's allowance, else
 * `AllowanceSpent`; and while no other runs in its Conversation, else `TurnRunning`. Answers the Turn
 * and its Key, whose secret goes to the sandbox's processes alone, and which proves the Turn until its
 * maximum length has passed. `sendMessage` starts one this way, its Message posted in the same
 * transaction.
 */
export const startTurn = (start: { message: string; location: string }) =>
  Effect.gen(function* () {
    const { account } = yield* Iam.sessionOnly
    yield* Iam.entitledOnly(account, 'assistant')
    yield* ownTile(account.id, start.location)
    const { turn, key } = yield* transactional(turnStarted(account.id, start))
    return { turn, key }
  })

/**
 * Ends one of the Account's Turns, saying how, and revokes its Key, in one transaction: needing no
 * Session, since the Turn ends wherever it runs. Answers the Turn, none for one that had already
 * ended, whose Key is revoked all the same.
 */
export const endTurn = (accountId: string, turnId: string, how: TurnEnd) =>
  transactional(
    Effect.gen(function* () {
      const turn = yield* Assistant.endTurn(accountId, turnId, how)
      yield* Iam.revokeTurnKey(accountId, turnId)
      return turn
    }),
  )

/**
 * Work the platform's `waitUntil` keeps the function up for, run once the answer has gone, with the
 * services the program had.
 */
const afterAnswering = <R>(work: Effect.Effect<void, never, R>) =>
  Effect.gen(function* () {
    const services = yield* Effect.context<R>()
    const waitUntil = yield* WaitUntil
    waitUntil(Effect.provideContext(work, services))
  })

/** What a Turn's agent starts with, beside the Turn and its Key. */
type Started = Pick<typeof SentMessage.Type, 'text' | 'view' | 'offset'>

/**
 * Starts a Turn's agent in the Account's sandbox: the System written into it, whatever it held gone;
 * the Turn's prompt made of today's latest Entries, the Titles their navigations went to, and the
 * Title and Preview of the Tiles on screen; its agent started in the centered Tile's folder, reaching
 * the app where the sandbox reaches it.
 */
const agentStarted = (
  accountId: string,
  turn: Turn,
  key: Redacted.Redacted,
  { text, view, offset }: Started,
) =>
  Effect.gen(function* () {
    const { url } = yield* HttpExchange
    const { places, box } = yield* systemInSandbox(accountId)
    const entries = yield* Assistant.latestToday(accountId, offset)
    const titles = yield* Mapping.titles(accountId, visitedTiles(entries))
    const onScreen = yield* Mapping.glimpses(accountId, [view.center, ...view.shown])
    const title = onScreen.find(({ id }) => id === view.center)?.title ?? ''
    yield* Assistant.startAgent(box, {
      turn,
      key,
      origin: new URL(url).origin,
      location: { id: view.center, title, folder: places.get(view.center)?.folder ?? '' },
      message: text,
      conversation: { entries, titles },
      onScreen,
      help: Mapping.helpRoot,
    })
  })

/** Stops a Turn's agent in its sandbox, once its Turn ended; a failure is reported, never thrown. */
const agentStopped = (accountId: string, turnId: string) =>
  Assistant.stopAgent(accountId, turnId).pipe(
    Effect.catchCause((cause) => Effect.logError("A Turn's agent was not stopped", cause)),
  )

/**
 * Posts the user's Message in their Conversation and, when the Account may use the Assistant, starts a
 * Turn answering it, in the centered Tile, all in one transaction: refused with `TileNotFound` for a
 * center its System does not hold, `AllowanceSpent` once the month's allowance is spent and
 * `TurnRunning` while another Turn runs, nothing posted. An Account without the `assistant`
 * Entitlement has its Message kept and no Turn, as the composer tells it. Its agent starts once the
 * answer has gone, through the platform's `waitUntil`; should it fail to, the Turn ends by its
 * sandbox. Answers the Message's Entry, and the Turn by its id when one started.
 */
export const sendMessage = (sent: typeof SentMessage.Type) =>
  Effect.gen(function* () {
    const { account } = yield* Iam.sessionOnly
    if (!(yield* Iam.entitled(account, 'assistant'))) {
      return { entry: yield* transactional(Assistant.postMessage(account.id, sent.text)) }
    }
    yield* ownTile(account.id, sent.view.center)
    const { entry, turn, key, overdue } = yield* transactional(
      Effect.gen(function* () {
        const posted = yield* Assistant.postMessage(account.id, sent.text)
        const start = { message: posted.id, location: sent.view.center }
        return { entry: posted, ...(yield* turnStarted(account.id, start)) }
      }),
    )
    yield* afterAnswering(
      Effect.gen(function* () {
        if (overdue !== undefined) yield* agentStopped(account.id, overdue.id)
        yield* agentStarted(account.id, turn, key.secret, sent).pipe(
          Effect.catchCause((cause) =>
            Effect.andThen(
              Effect.logError("A Turn's agent did not start", cause),
              Effect.ignore(endTurn(account.id, turn.id, 'sandbox')),
            ),
          ),
        )
      }),
    )
    return { entry, turn: { id: turn.id } }
  })

/**
 * Stops the Turn running in the Account's Conversation, from a Session: it ends, an Entry saying the
 * user stopped it, and its Key is revoked, in one transaction; then, once the answer has gone, its
 * agent is interrupted, so it ends cleanly, and killed past a grace. Nothing when none runs. Nothing it
 * did is rolled back.
 */
export const stopTurn = forSession((accountId) =>
  Effect.gen(function* () {
    const running = yield* Assistant.runningTurn(accountId)
    if (running === undefined) return null
    yield* endTurn(accountId, running.id, 'stopped')
    yield* afterAnswering(agentStopped(accountId, running.id))
    return null
  }),
)

/**
 * Follows one line its sandbox posts of what a Turn's agent says, for the Turn the request's Turn's
 * Key proves, the Account and the Turn taken from that Key, never from the line: Assistant's
 * `followTurn`, in a transaction, and the Key revoked in the same one once the line ended the Turn.
 * Answers whether the line was an event.
 */
export const turnEvent = (line: string) =>
  Effect.gen(function* () {
    const { account, turn } = yield* Iam.turnOnly
    return yield* transactional(
      Effect.gen(function* () {
        const followed = yield* Assistant.followTurn(account.id, turn.turnId, line)
        if (followed._tag === 'Followed' && followed.ended !== undefined) {
          yield* Iam.revokeTurnKey(account.id, turn.turnId)
        }
        return followed._tag
      }),
    )
  })

/**
 * A model call of the Turn the request's Turn's Key proves, the Account and the Turn taken from that
 * Key, never from the call. Assistant admits it or not in a transaction of its own, which ends a Turn
 * held back by its ceiling or the month's allowance, its Key revoked with it. An admitted call is
 * relayed as it comes, outside any transaction, and settled once its answer has ended, in a
 * transaction of its own, through the platform's `waitUntil`, so the function stays up until it is
 * written; a call the relay failed to make releases what it reserved at once.
 */
export const modelCall = (asked: Assistant.AskedCall) =>
  Effect.gen(function* () {
    const { account, turn } = yield* Iam.turnOnly
    const admission = yield* transactional(
      Effect.gen(function* () {
        const admitted = yield* Assistant.admitCall(account.id, turn.turnId, asked)
        if (admitted._tag === 'Limited') yield* Iam.revokeTurnKey(account.id, turn.turnId)
        return admitted
      }),
    )
    if (admission._tag !== 'Admitted') return admission
    const settle = (charged: number) =>
      transactional(
        Assistant.settleCall(account.id, turn.turnId, { reserved: admission.reserved, charged }),
      )
    const { relayed, charged } = yield* Assistant.relayCall(admission).pipe(
      Effect.onError(() => settle(0)),
    )
    yield* afterAnswering(
      Effect.flatMap(charged, settle).pipe(
        // An error line with its cause: Sentry gets it. The Turn keeps what the call reserved.
        Effect.catchCause((cause) => Effect.logError("A Turn's call was not settled", cause)),
      ),
    )
    return { _tag: 'Relayed', relayed } as const
  })
