// How a Turn's agent runs, which the API layer calls as directly as the service: the System written
// into the Account's sandbox (src/repositories/agent/sandbox/), the Turn's prompt and launcher written
// beside it and its agent started there, stopped, and each line it says followed, kept as the
// Conversation's Messages and the Turn's step, its result ending the Turn through the service
// (../assistant.ts). The pure rules it runs are this folder's: what the agent is told (`./prompt.ts`),
// what it starts with (`./launch.ts`) and what Assistant keeps of what it says (`./stream.ts`).
import { Effect, Schema } from 'effect'

import { Sandbox, type SandboxFile } from '#/repositories/agent/sandbox/sandbox'
import { Turns } from '#/repositories/database/conversations/turns'

import { day, endTurn, record, runningTurn, today } from '../assistant'
import { agentText, type Entry, type Turn, TurnStep } from '../entities'
import { settings } from '../settings'
import { type Launch, launchOf, processOf } from './launch'
import { type Glimpse, type Linked, type PromptOf, promptOf } from './prompt'
import { type AgentEvent, readLine } from './stream'

const encodedStep = Schema.encodeSync(TurnStep)

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
  /** The rules of the System, as the API layer words them from the MCP's tools. */
  readonly systemRules: PromptOf['systemRules']
  /** Someone else's System the Turn works in, as the API layer tells it; none for the Account's own. */
  readonly elsewhere?: PromptOf['elsewhere']
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
      systemRules: start.systemRules,
      mode: start.turn.mode,
      elsewhere: start.elsewhere,
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
 * Follows one line of what one of the Account's running Turns' agent says (`./stream.ts`), its events
 * in order: its text kept as the agent's Messages, its step set, then dropped as it speaks again; its
 * result ending the Turn, by its answer, its ceiling or its sandbox; its exit, the stream over, ending
 * a Turn that gave no result by its sandbox. A line that is no event is `Malformed`, and changes
 * nothing. Nothing for a Turn that is not running, or not the Account's. In the transaction the API
 * layer opened.
 */
export const followTurn = (accountId: string, turnId: string, line: string) =>
  Effect.gen(function* () {
    const events = readLine(line)
    if (events === undefined) return { _tag: 'Malformed' } satisfies Followed
    const ended = yield* followed(accountId, turnId, events)
    const answer: Followed = { _tag: 'Followed', ...(ended !== undefined && { ended }) }
    return answer
  })
