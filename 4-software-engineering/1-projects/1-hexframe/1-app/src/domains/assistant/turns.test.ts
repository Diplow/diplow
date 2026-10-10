import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { layer as turnsLayer } from '#/repositories/database/conversations/turns'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'

import { deadline, endTurn, postMessage, runningTurn, startTurn } from './assistant'
import { settings } from './settings'

// The Turns over the conversations and Turns repositories, for real, over PGlite: started and ended
// as the API layer does, in a transaction, one running at most per Conversation. The clock is the
// test's, so every instant is the one written.

const TestLayer = Layer.mergeAll(conversationsLayer, turnsLayer).pipe(
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
      expect(deadline(turn)).toEqual(new Date('2026-10-10T09:15:00Z'))
      expect(settings.turn.longest).toBe(15 * 60_000)
    }),
  )
})
