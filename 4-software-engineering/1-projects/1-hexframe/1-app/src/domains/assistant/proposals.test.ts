import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { layer as proposalsLayer } from '#/repositories/database/conversations/proposals'
import { layer as turnsLayer } from '#/repositories/database/conversations/turns'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'

import {
  acceptProposal,
  conversationState,
  day,
  discardProposal,
  draft,
  endTurn,
  lockedProposal,
  openProposal,
  postMessage,
  route,
  setMode,
  startTurn,
} from './assistant'
import type { Entry, ProposedChange } from './entities'
import { changesOf, writesOf } from './operations'

// The Mode and the Proposal over the conversations, Turns and Proposals repositories, for real, over
// PGlite: a Conversation in ask until switched, a Turn taking the Mode it started in, which its writes
// are routed by; a draft opening the one Proposal, with its Entry, and every later draft, a later
// Turn's included, continuing it; the Proposal accepted or discarded once, its Entry following it.
// The rules themselves are `./operations/decider.test.ts`'s; what an accepted Proposal does to the
// System is the API layer's (`api/assistant/proposal/`).

const TestLayer = Layer.mergeAll(conversationsLayer, turnsLayer, proposalsLayer).pipe(
  Layer.provideMerge(TestDatabase),
)

/** An Account no other test uses, and a Turn of it started from a Message, in the Mode it is in. */
const someone = Effect.sync(() => {
  const account = crypto.randomUUID()
  const turn = (text: string) =>
    Effect.gen(function* () {
      const message = yield* transactional(postMessage(account, text))
      return yield* transactional(startTurn(account, { message: message.id, location: 'tile-1' }))
    })
  return { account, turn }
})

const change = (title: string): ProposedChange => ({
  _tag: 'Change',
  verb: 'TileCreated',
  tile: { id: title.toLowerCase(), title },
})

/** Drafts a write making one change into the Account's Proposal, as the API layer does. */
const drafted = (account: string, turn: string, title: string) =>
  transactional(
    Effect.andThen(
      lockedProposal(account),
      draft(account, turn, { write: { title }, changes: [change(title)] }),
    ),
  )

/** The 10th of October 2026, UTC, where these tests' clock stands. */
const tenth = { date: '2026-10-10', offset: 0 }

/** The day's Proposal Entries. */
const proposalsOn = (account: string) =>
  Effect.map(day(account, tenth), (entries) =>
    entries.filter(
      (entry): entry is Extract<Entry, { _tag: 'Proposal' }> => entry._tag === 'Proposal',
    ),
  )

layer(TestLayer)('the Mode and the Proposal, over PGlite', (it) => {
  it.effect(
    'keeps a Conversation in ask until switched, and a Turn in the Mode it started in',
    () =>
      Effect.gen(function* () {
        const { account, turn } = yield* someone
        expect((yield* conversationState(account)).mode).toBe('ask')
        const asking = yield* turn('Draft it.')
        expect(asking.mode).toBe('ask')
        expect(yield* route(account, asking.id)).toBe('draft')

        expect(yield* transactional(setMode(account, 'apply'))).toBe('apply')
        expect((yield* conversationState(account)).mode).toBe('apply')
        // A Turn keeps the Mode it started in.
        expect(yield* route(account, asking.id)).toBe('draft')
        yield* transactional(endTurn(account, asking.id, 'answered'))
        const applying = yield* turn('Write it.')
        expect(yield* route(account, applying.id)).toBe('apply')
      }),
  )

  it.effect('switches the Mode of a Conversation that has no Entry yet', () =>
    Effect.gen(function* () {
      const account = crypto.randomUUID()
      yield* transactional(setMode(account, 'apply'))
      expect((yield* conversationState(account)).mode).toBe('apply')
      expect(yield* openProposal(account)).toBeUndefined()
    }),
  )

  it.effect('opens one Proposal with the first draft, and continues it with every later one', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T09:00:00Z'))
      const { account, turn } = yield* someone
      const first = yield* turn('Lay out Work.')
      const opened = yield* drafted(account, first.id, 'Work')
      yield* drafted(account, first.id, 'Team')
      yield* transactional(endTurn(account, first.id, 'answered'))

      const second = yield* turn('And Games.')
      const continued = yield* drafted(account, second.id, 'Games')
      expect(continued.id).toBe(opened.id)
      expect(continued.turn).toBe(first.id)

      const open = yield* openProposal(account)
      expect(open && writesOf(open)).toEqual([
        { title: 'Work' },
        { title: 'Team' },
        { title: 'Games' },
      ])
      const [entry, ...others] = yield* proposalsOn(account)
      expect(others).toEqual([])
      expect(entry).toMatchObject({
        proposal: opened.id,
        changes: [change('Work'), change('Team'), change('Games')],
        fate: 'open',
      })
    }),
  )

  it.effect(
    'accepts the open Proposal once, its Entry saying so; the next draft opens another',
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse('2026-10-10T10:00:00Z'))
        const { account, turn } = yield* someone
        const asking = yield* turn('Lay out Work.')
        const opened = yield* drafted(account, asking.id, 'Work')
        yield* transactional(acceptProposal(account, opened.id))
        expect(yield* openProposal(account)).toBeUndefined()
        const again = yield* transactional(acceptProposal(account, opened.id)).pipe(Effect.flip)
        expect(again).toMatchObject({ _tag: 'ProposalClosed', kind: 'Conflict' })
        const discarded = yield* transactional(discardProposal(account, opened.id)).pipe(
          Effect.flip,
        )
        expect(discarded._tag).toBe('ProposalClosed')

        const next = yield* drafted(account, asking.id, 'Games')
        expect(next.id).not.toBe(opened.id)
        expect(changesOf(next)).toEqual([change('Games')])
        const fates = (yield* proposalsOn(account)).map(({ proposal, fate }) => [proposal, fate])
        expect(fates).toEqual([
          [opened.id, 'accepted'],
          [next.id, 'open'],
        ])
      }),
  )

  it.effect('discards the open Proposal, and keeps it open through a switch to apply', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T11:00:00Z'))
      const { account, turn } = yield* someone
      const asking = yield* turn('Lay out Work.')
      const opened = yield* drafted(account, asking.id, 'Work')
      yield* transactional(setMode(account, 'apply'))
      expect((yield* openProposal(account))?.id).toBe(opened.id)
      yield* transactional(discardProposal(account, opened.id))
      expect(yield* openProposal(account)).toBeUndefined()
      expect((yield* proposalsOn(account)).map(({ fate }) => fate)).toEqual(['discarded'])
    }),
  )

  it.effect("keeps another Account's Proposal out of reach", () =>
    Effect.gen(function* () {
      const ada = yield* someone
      const grace = yield* someone
      const theirs = yield* drafted(ada.account, (yield* ada.turn('Work.')).id, 'Work')
      const refused = yield* transactional(acceptProposal(grace.account, theirs.id)).pipe(
        Effect.flip,
      )
      expect(refused._tag).toBe('ProposalClosed')
      expect((yield* openProposal(ada.account))?.id).toBe(theirs.id)
      expect(yield* openProposal(grace.account)).toBeUndefined()
    }),
  )
})
