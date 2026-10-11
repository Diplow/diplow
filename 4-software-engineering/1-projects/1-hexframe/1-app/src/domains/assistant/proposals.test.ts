import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { layer as appliedLayer } from '#/repositories/database/conversations/applied'
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
  openProposal,
  postMessage,
  route,
  setMode,
  startTurn,
} from './assistant'
import type { Entry, ProposedChange } from './entities'
import { changesOf, writesOf } from './operations'
import { applyInTurn, undo } from './undo/undo'

// The Mode and the Proposal over the conversations, Turns and Proposals repositories, for real, over
// PGlite: a Conversation in ask until switched, a Turn taking the Mode it started in, which its writes
// are routed by; a draft opening the one Proposal, with its Entry, and every later draft, a later
// Turn's included, continuing it; the Proposal accepted or discarded once, its Entry following it.
// And what the Assistant applied, an accepted Proposal's writes or a Turn's in apply, kept with what
// undoes them, offered in an Entry, a Turn's once it ended, and undone once. The rules themselves are
// `./operations/decider.test.ts`'s; what an accepted Proposal and an undo do to the System is the API
// layer's (`api/assistant/proposal/`).

const TestLayer = Layer.mergeAll(conversationsLayer, turnsLayer, proposalsLayer, appliedLayer).pipe(
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

/**
 * Drafts a write making one change into the Account's Proposal, as the API layer does, its step
 * answering the write and its change, for a Turn still running, and answers the Proposal as it leaves
 * it.
 */
const drafted = (account: string, turn: string, title: string) =>
  Effect.flatMap(
    transactional(
      draft(account, turn, () => Effect.succeed({ write: { title }, changes: [change(title)] })),
    ),
    (kept) =>
      kept === undefined
        ? Effect.die(new Error('The Turn no longer runs'))
        : Effect.succeed(kept.proposal),
  )

/** Accepts the Account's Proposal of this id, its writes run as `undo` undoes them. */
const accepted = (account: string, proposal: string, undo: unknown = { mapping: 0 }) =>
  transactional(acceptProposal(account, proposal, () => Effect.succeed({ undo, changes: 1 })))

/**
 * Applies a write of one of the Account's Turns, as the API layer does, its run answering what undoes
 * the Turn's writes, this one's included, and its changes: what the run was given, what undoes the
 * Turn's writes so far, or none, the run never run, once the Turn ended.
 */
const applied = (account: string, turn: string, kept: { undo: unknown; changes: number }) =>
  Effect.map(
    transactional(applyInTurn(account, turn, (soFar) => Effect.succeed({ ...kept, soFar }))),
    (ran) => (ran === undefined ? undefined : { soFar: ran.soFar }),
  )

/** The 10th of October 2026, UTC, where these tests' clock stands. */
const tenth = { date: '2026-10-10', offset: 0 }

/** The day's Entries of one kind. */
const entriesOn = <T extends Entry['_tag']>(account: string, tag: T) =>
  Effect.map(day(account, tenth), (entries) =>
    entries.filter((entry): entry is Extract<Entry, { _tag: T }> => entry._tag === tag),
  )

/** The day's Proposal Entries. */
const proposalsOn = (account: string) => entriesOn(account, 'Proposal')

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
        yield* accepted(account, opened.id)
        expect(yield* openProposal(account)).toBeUndefined()
        const again = yield* accepted(account, opened.id).pipe(Effect.flip)
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
      const refused = yield* accepted(grace.account, theirs.id).pipe(Effect.flip)
      expect(refused._tag).toBe('ProposalClosed')
      expect((yield* openProposal(ada.account))?.id).toBe(theirs.id)
      expect(yield* openProposal(grace.account)).toBeUndefined()
    }),
  )
})

layer(TestLayer)('what the Assistant applied, undone once, over PGlite', (it) => {
  it.effect('undoes an accepted Proposal once, its Entry saying so', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T12:00:00Z'))
      const { account, turn } = yield* someone
      const opened = yield* drafted(account, (yield* turn('Work.')).id, 'Work')
      yield* accepted(account, opened.id, { mapping: 1 })
      expect(yield* transactional(undo(account, opened.id))).toEqual({ mapping: 1 })
      expect(yield* proposalsOn(account)).toMatchObject([{ fate: 'accepted', undone: true }])
      const again = yield* transactional(undo(account, opened.id)).pipe(Effect.flip)
      expect(again._tag).toBe('NothingToUndo')
    }),
  )

  it.effect('has nothing to undo of a discarded Proposal, nor of another Account’s', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T12:00:00Z'))
      const ada = yield* someone
      const grace = yield* someone
      const working = yield* ada.turn('Work.')
      const discarded = yield* drafted(ada.account, working.id, 'Work')
      yield* transactional(discardProposal(ada.account, discarded.id))
      const none = yield* transactional(undo(ada.account, discarded.id)).pipe(Effect.flip)
      expect(none._tag).toBe('NothingToUndo')
      const kept = yield* drafted(ada.account, working.id, 'More')
      yield* accepted(ada.account, kept.id, 1)
      const theirs = yield* transactional(undo(grace.account, kept.id)).pipe(Effect.flip)
      expect(theirs._tag).toBe('NothingToUndo')
    }),
  )

  it.effect('keeps what a Turn in apply wrote, offered once it ended, then undone once', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T12:00:00Z'))
      const { account, turn } = yield* someone
      yield* transactional(setMode(account, 'apply'))
      const applying = yield* turn('Write it.')
      const first = yield* applied(account, applying.id, { undo: 'first', changes: 2 })
      expect(first).toEqual({ soFar: undefined })
      const both = yield* applied(account, applying.id, { undo: 'both', changes: 1 })
      expect(both).toEqual({ soFar: 'first' })
      const running = yield* transactional(undo(account, applying.id)).pipe(Effect.flip)
      expect(running._tag).toBe('NothingToUndo')
      expect(yield* entriesOn(account, 'TurnApplied')).toEqual([])

      yield* transactional(endTurn(account, applying.id, 'stopped'))
      const [offered] = yield* entriesOn(account, 'TurnApplied')
      expect(offered).toMatchObject({ turn: applying.id, changes: 3, undone: false })
      expect(yield* transactional(undo(account, applying.id))).toBe('both')
      expect(yield* entriesOn(account, 'TurnApplied')).toMatchObject([{ undone: true }])
      const again = yield* transactional(undo(account, applying.id)).pipe(Effect.flip)
      expect(again._tag).toBe('NothingToUndo')
    }),
  )

  it.effect('offers nothing to undo for a Turn that applied nothing', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T12:00:00Z'))
      const { account, turn } = yield* someone
      yield* transactional(setMode(account, 'apply'))
      const quiet = yield* turn('Just answer.')
      yield* transactional(endTurn(account, quiet.id, 'answered'))
      expect(yield* entriesOn(account, 'TurnApplied')).toEqual([])
      const none = yield* transactional(undo(account, quiet.id)).pipe(Effect.flip)
      expect(none._tag).toBe('NothingToUndo')
    }),
  )

  it.effect(
    'offers no Undo for writes that changed nothing, and says when a Turn no longer runs',
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse('2026-10-10T13:00:00Z'))
        const { account, turn } = yield* someone
        yield* transactional(setMode(account, 'apply'))
        const still = yield* turn('Move nothing.')
        const nothing = yield* applied(account, still.id, { undo: 'none', changes: 0 })
        expect(nothing).toEqual({ soFar: undefined })
        yield* transactional(endTurn(account, still.id, 'answered'))
        expect(yield* entriesOn(account, 'TurnApplied')).toEqual([])
        // A write that reaches it now is not run: the API layer refuses it, its Key proving the Turn
        // no longer.
        expect(yield* applied(account, still.id, { undo: 'late', changes: 1 })).toBeUndefined()
        expect(yield* entriesOn(account, 'TurnApplied')).toEqual([])
      }),
  )

  it.effect('drafts nothing for a Turn that ended, its step never run', () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse('2026-10-10T14:00:00Z'))
      const { account, turn } = yield* someone
      const asking = yield* turn('Draft one.')
      const opened = yield* drafted(account, asking.id, 'Work')
      yield* transactional(endTurn(account, asking.id, 'stopped'))
      // A draft that reaches it now is refused by the API layer: its Key proves the Turn no longer.
      let stepped = false
      const late = yield* transactional(
        draft(account, asking.id, () =>
          Effect.sync(() => {
            stepped = true
            return { write: { title: 'Late' }, changes: [change('Late')] }
          }),
        ),
      )
      expect(late).toBeUndefined()
      expect(stepped).toBe(false)
      const open = yield* openProposal(account)
      expect(open?.id).toBe(opened.id)
      expect(open && writesOf(open)).toEqual([{ title: 'Work' }])
    }),
  )
})
