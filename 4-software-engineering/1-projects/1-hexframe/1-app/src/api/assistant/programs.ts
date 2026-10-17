// The programs behind Assistant's server functions (./assistant.ts): each runs for the Account the
// request's Session proves, or fails with IAM's `SessionRequired` or `SignedOut`, and a write in the
// transaction it opens. A Message sent starts a Turn answering it, its Key's secret going to the
// sandbox alone, never to a browser; a Stop ends the Turn running; and the Turn's events, which its
// sandbox posts through the events door, are followed. They sit in a module of their own because they
// reach the domains and the database: the client imports the server functions, and only their
// handlers import this module, which Start strips from the client.
import { Effect } from 'effect'
import type { Redacted } from 'effect'

import * as Agent from '#/domains/assistant/agent/agent'
import * as Assistant from '#/domains/assistant/assistant'
import { linksOf, namedTiles, type TurnEnd, turnLocation } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import type { Turn } from '#/domains/assistant/entities'
import * as Spending from '#/domains/assistant/spending/admission'
import * as Mapping from '#/domains/mapping/mapping'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import { tileLink } from '../mapping/files/download'
import { WaitUntil } from '../server/bus'
import { systemRules } from '../server/mcp/tools'

import type { DayAsked, MergedNavigation, SentMessage } from './assistant'
import { conversationNow, proposalNow, shownTo } from './proposal/programs'
import { actingOnOwn } from '../mapping/programs'

/**
 * Runs an operation for the Account the request's Session proves: the Conversation is the user's,
 * so a Key, even one a script sends from the page's origin, reads and writes none of it.
 */
const forSession = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) => operation(account.id))

/**
 * A day of the Account's Conversation, today when no date is asked: the day, its Entries oldest
 * first, and the Titles of the Tiles its navigations went to and its Messages link, as the System
 * holds them now, by id. A navigation and a link keep a Tile's id alone; a Tile the System no longer
 * holds has no Title there. With them, `earlier`, the instant of the latest Entry before the day,
 * where a reader scrolling back goes next, and `lastEntry`, the Entry last recorded in the
 * Conversation, and `proposal`, its open Proposal, how many writes it holds, which the page's poll
 * compares with its own (`latest`), and the writes themselves, which the canvas draws (`proposalNow`).
 * Both are read first: an Entry recorded or a write drafted meanwhile is among the day's, and the
 * next poll reads the day again for nothing rather than never.
 */
export const conversationDay = ({ date, ...offsets }: typeof DayAsked.Type) =>
  forSession((accountId) =>
    Effect.gen(function* () {
      const lastEntry = yield* Assistant.lastEntry(accountId)
      const proposal = yield* proposalNow(accountId)
      const day = { date: date ?? (yield* Assistant.today(offsets.offset)).date, ...offsets }
      const entries = yield* Assistant.day(accountId, day)
      const titles = yield* Mapping.titles(
        yield* actingOnOwn(accountId, { session: false }),
        namedTiles(entries),
      )
      const earlier = yield* Assistant.before(accountId, day)
      return {
        day,
        entries,
        titles,
        ...(earlier !== undefined && { earlier }),
        ...(lastEntry !== undefined && { lastEntry }),
        ...(proposal !== undefined && { proposal }),
      }
    }),
  )

/**
 * The latest of what home shows, the smallest reads there are, which the page polls: the System's
 * Version, the id of the Entry last recorded in the Conversation, none before the first, the Turn
 * running before its deadline, by its id, with the Tile it works in, its location, and its agent's
 * step now, the Conversation's Mode, and its
 * open Proposal, by its id, with how many writes it holds. The page reads the System again once the
 * Version moved, and the Conversation once its last Entry or its Proposal is another, and follows
 * closely while a Turn runs.
 */
export const latest = forSession((accountId) =>
  Effect.gen(function* () {
    const version = yield* Mapping.systemVersion(yield* actingOnOwn(accountId, { session: false }))
    const lastEntry = yield* Assistant.lastEntry(accountId)
    const live = yield* Assistant.liveTurn(accountId)
    const { mode, proposal } = yield* conversationNow(accountId)
    const turn =
      live === undefined
        ? undefined
        : {
            id: live.id,
            location: live.location,
            ...(live.step !== undefined && { step: live.step }),
          }
    return {
      version,
      mode,
      ...(lastEntry !== undefined && { lastEntry }),
      ...(turn !== undefined && { turn }),
      ...(proposal !== undefined && { proposal }),
    }
  }),
)

/**
 * Records where the user went, consecutive navigations merged into one Entry by the browser, dated
 * from its last gesture, `sinceLast` milliseconds before the server received it.
 */
export const recordNavigation = ({ navigation, sinceLast }: typeof MergedNavigation.Type) =>
  forSession((accountId) =>
    transactional(Assistant.recordNavigation(accountId, navigation, sinceLast)),
  )

/**
 * Whether the Account the request's Session proves may use the Assistant: its `assistant`
 * Entitlement, which the composer tells the user of when it is missing.
 */
export const assistantAvailable = Effect.flatMap(Iam.sessionOnly, ({ account }) =>
  Iam.entitled(account, 'assistant'),
)

/**
 * Runs a step that may end one of the Account's Turns and, when its result says it ended one, by the
 * id `endedTurn` reads from it, revokes that Turn's Key in the same transaction: a Turn's Key proves a
 * running Turn alone, so every step that ends one goes through here, however it ended (Rules, "A
 * Turn's Key is revoked however it ended"). Answers the step's result.
 */
const revokingEnded = <A, E, R>(
  accountId: string,
  step: Effect.Effect<A, E, R>,
  endedTurn: (result: A) => string | undefined,
) =>
  Effect.tap(step, (result) => {
    const ended = endedTurn(result)
    return ended === undefined ? Effect.void : Iam.revokeTurnKey(accountId, ended)
  })

/**
 * Starts a Turn answering one of the Account's Messages and issues its Key, inside the transaction
 * the caller opened: a Turn still running past its deadline ended first, by its time, its Key revoked;
 * then Assistant's `startTurn`, refused while another runs or once the month's allowance is spent;
 * then its Key, proving it until its maximum length has passed. Answers the Turn, its Key, and the
 * Turn ended by its time, if one was.
 */
const turnStarted = (accountId: string, start: { message: string; location: string }) =>
  Effect.gen(function* () {
    const overdue = yield* revokingEnded(
      accountId,
      Assistant.endOverdueTurn(accountId),
      (ended) => ended?.id,
    )
    const turn = yield* Assistant.startTurn(accountId, start)
    const key = yield* Iam.issueTurnKey(turn.id, Assistant.deadline(turn))
    return { turn, key, ...(overdue !== undefined && { overdue }) }
  })

/**
 * Posts the user's Message in their Conversation and starts the Turn answering it in the Tile
 * `location` names, its Key issued: for an Account with the `assistant` Entitlement, else
 * `EntitlementMissing`; in a Tile of its own System, else Mapping's `TileNotFound`; then, in one
 * transaction (`turnStarted`), `AllowanceSpent` once the month's allowance is spent and `TurnRunning`
 * while another Turn runs, nothing posted. It checks what a Key needs itself, so no caller issues one
 * for an Account or a Tile it should not. What `sendMessage` runs for an Account it found entitled,
 * and what the tests start a Turn with, its Key in hand (`server/events/testing.ts`). Answers the
 * Message's Entry, the Turn, its Key, and the Turn ended by its time, if one was.
 */
export const messageAndTurn = (account: Iam.Session['account'], text: string, location: string) =>
  Effect.gen(function* () {
    yield* Iam.entitledOnly(account, 'assistant')
    yield* Mapping.ownTile(yield* actingOnOwn(account.id, { session: false }), location)
    return yield* transactional(
      Effect.gen(function* () {
        const posted = yield* Assistant.postMessage(account.id, text)
        const start = { message: posted.id, location }
        return { entry: posted, ...(yield* turnStarted(account.id, start)) }
      }),
    )
  })

/**
 * Ends one of the Account's Turns, saying how, and revokes its Key, in one transaction: needing no
 * Session, since the Turn ends wherever it runs. Answers the Turn, none for one that had already
 * ended, whose Key is revoked all the same.
 */
export const endTurn = (accountId: string, turnId: string, how: TurnEnd) =>
  transactional(revokingEnded(accountId, Assistant.endTurn(accountId, turnId, how), () => turnId))

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

/**
 * Where the app answers a Turn's sandbox, by path, as `front/routes/` serves them: the MCP, the model
 * proxy, and the Turn's events.
 */
const doors = { mcp: '/mcp', model: '/assistant/anthropic', events: '/assistant/events' }

/** What a Turn's agent starts with, beside the Turn and its Key. */
type Started = Pick<typeof SentMessage.Type, 'text' | 'view' | 'offset'>

/**
 * Starts a Turn's agent in the Account's sandbox: the System written into it, Mapping's export of its
 * Root, with the open Proposal folded over it for a Turn that drafts, so its files and its reads
 * agree (`shownTo`), a Reference whose Tile is gone linked on the site the request reached
 * (`tileLink`), whatever the sandbox held gone; the Turn's prompt made of today's latest Entries and the Titles of the Tiles
 * they name, the Title and Preview of the Tiles on screen, and the Tiles the Message links, each with
 * its file where Mapping places it in the same export, none once deleted; its agent started in the
 * folder of the Turn's location, the Tile the Message opens with a link to or the centered one,
 * reaching the app at its doors where the sandbox reaches it.
 */
const agentStarted = (
  accountId: string,
  turn: Turn,
  key: Redacted.Redacted,
  { text, view, offset }: Started,
) =>
  Effect.gen(function* () {
    const { url } = yield* HttpExchange
    const over = yield* shownTo(accountId, turn.id)
    const own = yield* actingOnOwn(accountId, { session: false })
    const { files, places } = yield* Mapping.systemFiles(own, tileLink(url), over)
    const entries = yield* Agent.latestToday(accountId, offset)
    const linked = linksOf(text)
    const titles = yield* Mapping.titles(own, [...namedTiles(entries), ...linked, turn.location])
    const onScreen = yield* Mapping.glimpses(own, [view.center, ...view.shown])
    const placeOf = (id: string) => {
      const title = titles[id]
      const place = places.get(id)
      return title === undefined || place === undefined ? undefined : { title, file: place.file }
    }
    yield* Agent.startAgent(accountId, {
      turn,
      key,
      system: files,
      origin: new URL(url).origin,
      doors,
      location: {
        id: turn.location,
        title: titles[turn.location] ?? '',
        folder: places.get(turn.location)?.folder ?? '',
      },
      message: text,
      links: linked.map((id) => {
        const place = placeOf(id)
        return place === undefined ? { id } : { id, place }
      }),
      conversation: { entries, titles },
      onScreen,
      systemRules,
    })
  })

/** Stops a Turn's agent in its sandbox, once its Turn ended; a failure is reported, never thrown. */
const agentStopped = (accountId: string, turnId: string) =>
  Agent.stopAgent(accountId, turnId).pipe(
    Effect.catchCause((cause) => Effect.logError("A Turn's agent was not stopped", cause)),
  )

/**
 * Posts the user's Message in their Conversation and, when the Account may use the Assistant, starts a
 * Turn answering it, all in one transaction, in the Tile the Message opens with a link to, else the
 * centered one: refused with `TileNotFound` for a Tile its System does not hold, `AllowanceSpent` once the month's allowance is spent and
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
    const location = turnLocation(sent.text, sent.view.center)
    const { entry, turn, key, overdue } = yield* messageAndTurn(account, sent.text, location)
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
 * `followTurn`, in a transaction, and the Key revoked in the same one once the line ended the Turn
 * (`revokingEnded`). Answers whether the line was an event.
 */
export const turnEvent = (line: string) =>
  Effect.gen(function* () {
    const { account, turnId } = yield* Iam.turnOnly
    const followed = yield* transactional(
      revokingEnded(account.id, Agent.followTurn(account.id, turnId, line), (result) =>
        result._tag === 'Followed' ? result.ended?.id : undefined,
      ),
    )
    return followed._tag
  })

/**
 * A model call of the Turn the request's Turn's Key proves, the Account and the Turn taken from that
 * Key, never from the call. Assistant admits it or not in a transaction of its own, which ends a Turn
 * held back by its ceiling or the month's allowance, its Key revoked with it (`revokingEnded`). An
 * admitted call is
 * relayed as it comes, outside any transaction, and settled once its answer has ended, in a
 * transaction of its own, through the platform's `waitUntil`, so the function stays up until it is
 * written; a call the relay failed to make releases what it reserved at once.
 */
export const modelCall = (asked: Spending.AskedCall) =>
  Effect.gen(function* () {
    const { account, turnId } = yield* Iam.turnOnly
    const admission = yield* transactional(
      revokingEnded(account.id, Spending.admitCall(account.id, turnId, asked), (admitted) =>
        admitted._tag === 'Limited' ? turnId : undefined,
      ),
    )
    if (admission._tag !== 'Admitted') return admission
    const settle = (charged: number) =>
      transactional(
        Spending.settleCall(account.id, turnId, { reserved: admission.reserved, charged }),
      )
    const { relayed, charged } = yield* Spending.relayCall(admission).pipe(
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
