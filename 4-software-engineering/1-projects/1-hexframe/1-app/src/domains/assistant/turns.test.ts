import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { layer as appliedLayer } from '#/repositories/database/conversations/applied'
import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { layer as proposalsLayer } from '#/repositories/database/conversations/proposals'
import { conversationLockedHere } from '#/repositories/database/conversations/testing'
import { Turns, layer as turnsLayer } from '#/repositories/database/conversations/turns'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'

import { followTurn } from './agent/agent'
import {
  day,
  deadline,
  endOverdueTurn,
  endTurn,
  liveTurn,
  postMessage,
  runningTurn,
  startTurn,
} from './assistant'
import { settings } from './settings'

// The Turns over the conversations and Turns repositories, for real, over PGlite: started and ended
// as the API layer does, in a transaction, one running at most per Conversation. The clock is the
// test's, so every instant is the one written.

const TestLayer = Layer.mergeAll(conversationsLayer, turnsLayer, proposalsLayer, appliedLayer).pipe(
  Layer.provideMerge(TestDatabase),
)

/** An Account no other test uses, with a Message posted, which a Turn answers. */
const someone = Effect.gen(function* () {
  const account = crypto.randomUUID()
  const message = yield* transactional(postMessage(account, 'Lay out my vault.'))
  const ask = (text: string) =>
    Effect.map(transactional(postMessage(account, text)), ({ id }) => id)
  return { account, message: message.id, ask }
})

/** A Tile a Turn starts in. */
const location = 'tile-1'

/** The 10th of October 2026, UTC, where these tests' clock stands when they set it. */
const tenth = { date: '2026-10-10', offset: 0 }

/** What the day's Entries are, by kind, and how a Turn ended for those that say so. */
const told = (account: string) =>
  Effect.map(day(account, tenth), (entries) =>
    entries.map((entry) => (entry._tag === 'TurnEnded' ? `ended: ${entry.how}` : entry._tag)),
  )

/** A line of the agent's stream, as Claude Code writes it. */
const said = (text: string) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const running = (name: string, input: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })
const result = (subtype: string) => JSON.stringify({ type: 'result', subtype })

layer(TestLayer)('the Turns, over PGlite', (it) => {
  it.effect('starts a Turn answering a Message, in a Tile, running until it ends', () =>
    Effect.gen(function* () {
      const { account, message } = yield* someone
      yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
      const turn = yield* transactional(startTurn(account, { message, location }))
      expect(turn).toMatchObject({
        message,
        location,
        startedAt: new Date('2026-10-10T09:00:00Z'),
        spent: 0,
      })
      expect(turn.ended).toBeUndefined()
      expect(yield* runningTurn(account)).toEqual(turn)

      yield* TestClock.adjust('3 minutes')
      const ended = yield* transactional(endTurn(account, turn.id, 'answered'))
      expect(ended).toEqual({
        ...turn,
        ended: { at: new Date('2026-10-10T09:03:00Z'), how: 'answered' },
      })
      expect(yield* runningTurn(account)).toBeUndefined()
    }),
  )

  it.effect('runs one Turn at most per Conversation: another waits for its end', () =>
    Effect.gen(function* () {
      const { account, message, ask } = yield* someone
      const first = yield* transactional(startTurn(account, { message, location }))
      const next = yield* ask('And Games?')
      const refused = yield* transactional(startTurn(account, { message: next, location })).pipe(
        Effect.flip,
      )
      expect(refused).toMatchObject({ _tag: 'TurnRunning', kind: 'Conflict' })
      expect(yield* runningTurn(account)).toEqual(first)

      yield* transactional(endTurn(account, first.id, 'stopped'))
      const second = yield* transactional(startTurn(account, { message: next, location }))
      expect(yield* runningTurn(account)).toEqual(second)
    }),
  )

  it.effect(
    'ends, by its time, a Turn nothing ended past its deadline, so the next one starts',
    () =>
      Effect.gen(function* () {
        const { account, message, ask } = yield* someone
        yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
        const lost = yield* transactional(startTurn(account, { message, location }))
        const next = yield* ask('Are you there?')
        yield* TestClock.adjust('14 minutes')
        const early = yield* transactional(startTurn(account, { message: next, location })).pipe(
          Effect.flip,
        )
        expect(early).toMatchObject({ _tag: 'TurnRunning' })

        yield* TestClock.adjust('1 minute')
        const late = yield* transactional(startTurn(account, { message: next, location })).pipe(
          Effect.flip,
        )
        expect(late).toMatchObject({ _tag: 'TurnRunning' })
        expect((yield* transactional(endOverdueTurn(account)))?.id).toBe(lost.id)
        const started = yield* transactional(startTurn(account, { message: next, location }))
        expect(yield* runningTurn(account)).toEqual(started)
        const ended = yield* transactional(endTurn(account, lost.id, 'answered'))
        expect(ended).toBeUndefined()
      }),
  )

  it.effect("lets another Account's Conversation run a Turn of its own meanwhile", () =>
    Effect.gen(function* () {
      const ada = yield* someone
      const grace = yield* someone
      yield* transactional(startTurn(ada.account, { message: ada.message, location }))
      const theirs = yield* transactional(
        startTurn(grace.account, { message: grace.message, location }),
      )
      expect(yield* runningTurn(grace.account)).toEqual(theirs)
    }),
  )

  it.effect("ends a Turn once, and never another Account's", () =>
    Effect.gen(function* () {
      const { account, message } = yield* someone
      const other = yield* someone
      const turn = yield* transactional(startTurn(account, { message, location }))
      expect(yield* transactional(endTurn(other.account, turn.id, 'stopped'))).toBeUndefined()
      expect(yield* runningTurn(account)).toEqual(turn)

      const ended = yield* transactional(endTurn(account, turn.id, 'time'))
      expect(ended?.ended?.how).toBe('time')
      expect(yield* transactional(endTurn(account, turn.id, 'answered'))).toBeUndefined()
    }),
  )

  it.effect(
    "keeps every way a Turn ends: its answer, a Stop, its ceiling, the month's, its time, the sandbox",
    () =>
      Effect.gen(function* () {
        const { account, message, ask } = yield* someone
        const ends = ['answered', 'stopped', 'ceiling', 'allowance', 'time', 'sandbox'] as const
        for (const [index, how] of ends.entries()) {
          const answered = index === 0 ? message : yield* ask(`Message ${String(index)}`)
          const turn = yield* transactional(startTurn(account, { message: answered, location }))
          const ended = yield* transactional(endTurn(account, turn.id, how))
          expect(ended?.ended?.how).toBe(how)
        }
      }),
  )

  it.effect("refuses, as a defect, a Turn answering a Message of another Account's", () =>
    Effect.gen(function* () {
      const { account } = yield* someone
      const other = yield* someone
      const exit = yield* transactional(
        startTurn(account, { message: other.message, location }),
      ).pipe(Effect.exit)
      expect(exit._tag).toBe('Failure')
      expect(yield* runningTurn(account)).toBeUndefined()
    }),
  )

  it.effect("runs until its start and the settings' maximum length", () =>
    Effect.gen(function* () {
      const { account, message } = yield* someone
      yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
      const turn = yield* transactional(startTurn(account, { message, location }))
      expect(deadline(turn)).toEqual(new Date(turn.startedAt.getTime() + settings.turn.longest))
    }),
  )
})

layer(TestLayer)('a Turn as it runs, over PGlite', (it) => {
  it.effect(
    'tells in an Entry how a Turn ended when not by its answer, one ended by its time dated from its deadline',
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
        const { account, message, ask } = yield* someone
        const answered = yield* transactional(startTurn(account, { message, location }))
        yield* transactional(endTurn(account, answered.id, 'answered'))
        const stopped = yield* transactional(
          startTurn(account, { message: yield* ask('Two'), location }),
        )
        yield* TestClock.adjust('2 minutes')
        yield* transactional(endTurn(account, stopped.id, 'stopped'))
        const lost = yield* transactional(
          startTurn(account, { message: yield* ask('Three'), location }),
        )
        expect(yield* liveTurn(account)).toEqual(lost)

        yield* TestClock.adjust('20 minutes')
        expect(yield* liveTurn(account)).toBeUndefined()
        const ended = yield* transactional(endOverdueTurn(account))
        expect(ended?.ended?.how).toBe('time')
        expect(yield* transactional(endOverdueTurn(account))).toBeUndefined()
        const entries = yield* day(account, tenth)
        const timeUp = entries.find((entry) => entry._tag === 'TurnEnded' && entry.how === 'time')
        expect(timeUp?.at).toEqual(deadline(lost))
        expect(yield* told(account)).toEqual([
          'Message',
          'Message',
          'ended: stopped',
          'Message',
          'ended: time',
        ])
      }),
  )

  it.effect("refuses a Turn once the month's allowance is spent, until the next month", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
      const { account, message, ask } = yield* someone
      const spender = yield* transactional(startTurn(account, { message, location }))
      yield* transactional(
        Turns.use((turns) =>
          turns.charge(account, spender.id, { spent: settings.month.allowance, reserved: 0 }),
        ),
      )
      yield* transactional(endTurn(account, spender.id, 'answered'))
      const next = yield* ask('One more?')
      const refused = yield* transactional(startTurn(account, { message: next, location })).pipe(
        Effect.flip,
      )
      expect(refused).toMatchObject({ _tag: 'AllowanceSpent', kind: 'Forbidden' })
      expect(yield* runningTurn(account)).toBeUndefined()

      yield* TestClock.setTime(Date.parse('2026-11-01T00:00:00Z'))
      const started = yield* transactional(startTurn(account, { message: next, location }))
      expect(yield* runningTurn(account)).toEqual(started)
    }),
  )

  it.effect(
    'follows what the agent says: its text as its Messages, its step, then its result ending the Turn',
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
        const { account, message } = yield* someone
        const turn = yield* transactional(startTurn(account, { message, location }))
        const follow = (line: string) => transactional(followTurn(account, turn.id, line))

        expect(yield* follow(running('Read', { file_path: 'CLAUDE.md' }))).toEqual({
          _tag: 'Followed',
        })
        expect((yield* runningTurn(account))?.step).toEqual({ tool: 'Read', detail: 'CLAUDE.md' })
        yield* follow(said('  Your vault holds three Tiles.  '))
        expect((yield* runningTurn(account))?.step).toBeUndefined()
        expect(yield* follow('{ not json')).toEqual({ _tag: 'Malformed' })

        const finished = yield* follow(result('success'))
        expect(finished).toMatchObject({ _tag: 'Followed', ended: { ended: { how: 'answered' } } })
        expect(yield* follow(said('Too late.'))).toEqual({ _tag: 'Followed' })
        const entries = yield* day(account, tenth)
        expect(entries.map((entry) => (entry._tag === 'Message' ? entry : entry._tag))).toEqual([
          expect.objectContaining({ author: 'user' }),
          expect.objectContaining({ author: 'agent', text: 'Your vault holds three Tiles.' }),
        ])
      }),
  )

  it.effect(
    'ends a Turn by its ceiling when its agent spent its budget, and by its sandbox when it exited without a result',
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
        const { account, message, ask } = yield* someone
        const budget = yield* transactional(startTurn(account, { message, location }))
        yield* transactional(followTurn(account, budget.id, result('error_max_budget_usd')))
        const exited = yield* transactional(
          startTurn(account, { message: yield* ask('Two'), location }),
        )
        yield* transactional(followTurn(account, exited.id, running('Bash', { command: 'ls' })))
        yield* transactional(followTurn(account, exited.id, '{"type":"hexframe_exit","code":1}'))
        expect(yield* runningTurn(account)).toBeUndefined()
        expect(yield* told(account)).toEqual([
          'Message',
          'ended: ceiling',
          'Message',
          'ended: sandbox',
        ])
      }),
  )

  it.effect("follows no other Account's Turn", () =>
    Effect.gen(function* () {
      const { account, message } = yield* someone
      const other = yield* someone
      const turn = yield* transactional(startTurn(account, { message, location }))
      expect(yield* transactional(followTurn(other.account, turn.id, result('success')))).toEqual({
        _tag: 'Followed',
      })
      expect(yield* runningTurn(account)).toEqual(turn)
    }),
  )

  // Two transactions locking the same two rows in opposite orders deadlock, which one connection to
  // PGlite cannot show: a Said line records the agent's Message, the Conversation's row locked, then
  // drops the step, the Turn's; a Stop or a limit ends the Turn, then records how. So every write of a
  // Turn locks its Conversation first, which a transaction holding nothing else shows.
  it.effect("locks the Conversation's row before a Turn's on every write of the Turn", () =>
    Effect.gen(function* () {
      const { account, message } = yield* someone
      const turn = yield* transactional(startTurn(account, { message, location }))
      const locks = <A, R>(write: Effect.Effect<A, never, R>) =>
        transactional(Effect.andThen(write, conversationLockedHere(account)))

      expect(yield* locks(runningTurn(account))).toBe(false)
      expect(yield* locks(Turns.use((turns) => turns.step(account, turn.id, null)))).toBe(true)
      expect(
        yield* locks(Turns.use((turns) => turns.spending(account, turn.id, new Date(0)))),
      ).toBe(true)
      expect(
        yield* locks(
          Turns.use((turns) => turns.charge(account, turn.id, { spent: 0, reserved: 0 })),
        ),
      ).toBe(true)
      expect(
        yield* locks(
          Turns.use((turns) => turns.end(account, turn.id, { end: 'stopped', at: new Date(0) })),
        ),
      ).toBe(true)
    }),
  )
})
