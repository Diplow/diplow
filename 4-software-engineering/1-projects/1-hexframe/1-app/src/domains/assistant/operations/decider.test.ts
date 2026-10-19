import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { ProposedChange } from '../entities'
import {
  AcceptProposal,
  changesOf,
  continuedBy,
  type ConversationEvent,
  type ConversationState,
  decide,
  DiscardProposal,
  Draft,
  Drafted,
  evolve,
  ModeSet,
  ProposalDecided,
  ProposalOpened,
  SetMode,
  writesOf,
} from '.'

// The Decider of a Conversation's Mode and Proposal, on states made by hand: a Mode switched, a draft
// opening the one Proposal or continuing the open one, over the one System it changes, and only the
// open one accepted or discarded, once. That the service keeps what these events say is `../proposals.test.ts`'s.

const change = (title: string): ProposedChange => ({
  _tag: 'Change',
  verb: 'TileCreated',
  tile: { id: title.toLowerCase(), title },
})

const draft = (title: string, turn = 'turn-1') =>
  new Draft({ turn, write: { title }, changes: [change(title)] })

/** The events an Operation makes on a state, which must succeed. */
const events = <E>(decided: Result.Result<ReadonlyArray<ConversationEvent>, E>) =>
  Result.getOrThrow(decided)

const ask: ConversationState = { mode: 'ask' }

describe("decide and evolve, a Conversation's Mode and Proposal", () => {
  it('switches the Mode, and changes nothing switching to the one it is in', () => {
    expect(events(decide(ask, new SetMode({ mode: 'apply' })))).toEqual([
      new ModeSet({ mode: 'apply' }),
    ])
    expect(events(decide(ask, new SetMode({ mode: 'ask' })))).toEqual([])
    expect(evolve(ask, new ModeSet({ mode: 'apply' }))).toEqual({ mode: 'apply' })
  })

  it('opens a Proposal with the first draft, under the id it is given, the Turn that drafted it with it', () => {
    const made = events(decide(ask, draft('Work'), { proposal: 'p-1' }))
    expect(made).toEqual([
      new ProposalOpened({ id: 'p-1', turn: 'turn-1' }),
      new Drafted({ proposal: 'p-1', write: { title: 'Work' }, changes: [change('Work')] }),
    ])
    expect(made.reduce(evolve, ask)).toEqual({
      mode: 'ask',
      open: {
        id: 'p-1',
        turn: 'turn-1',
        drafts: [{ write: { title: 'Work' }, changes: [change('Work')] }],
      },
    })
  })

  it('continues the open Proposal, a later Turn included: one open at a time', () => {
    const opened = events(decide(ask, draft('Work'), { proposal: 'p-1' })).reduce(evolve, ask)
    const next = events(decide(opened, draft('Team', 'turn-2'), { proposal: 'p-2' }))
    expect(next).toEqual([
      new Drafted({ proposal: 'p-1', write: { title: 'Team' }, changes: [change('Team')] }),
    ])
    const continued = next.reduce(evolve, opened).open
    expect(continued?.turn).toBe('turn-1')
    expect(continued && writesOf(continued)).toEqual([{ title: 'Work' }, { title: 'Team' }])
    expect(continued && changesOf(continued)).toEqual([change('Work'), change('Team')])
  })

  it('keeps the Proposal open through a switch to apply', () => {
    const opened = events(decide(ask, draft('Work'), { proposal: 'p-1' })).reduce(evolve, ask)
    const applied = events(decide(opened, new SetMode({ mode: 'apply' }))).reduce(evolve, opened)
    expect(applied).toEqual({ ...opened, mode: 'apply' })
  })

  it('accepts or discards the open Proposal, once, and nothing else', () => {
    const opened = events(decide(ask, draft('Work'), { proposal: 'p-1' })).reduce(evolve, ask)
    const accepted = events(decide(opened, new AcceptProposal({ proposal: 'p-1' })))
    expect(accepted).toEqual([new ProposalDecided({ proposal: 'p-1', fate: 'accepted' })])
    const after = accepted.reduce(evolve, opened)
    expect(after).toEqual({ mode: 'ask' })
    const again = decide(after, new DiscardProposal({ proposal: 'p-1' }))
    expect(Result.isFailure(again) && again.failure._tag).toBe('ProposalClosed')
    const another = decide(opened, new DiscardProposal({ proposal: 'p-2' }))
    expect(Result.isFailure(another) && another.failure._tag).toBe('ProposalClosed')
    expect(events(decide(opened, new DiscardProposal({ proposal: 'p-1' })))).toEqual([
      new ProposalDecided({ proposal: 'p-1', fate: 'discarded' }),
    ])
  })

  it('opens a Proposal over the System its Turn works in, which a Turn working in another never drafts into', () => {
    const fromAna = { turn: 'turn-1', write: {}, changes: [], elsewhere: 'ana' }
    const elsewhere = new Draft(fromAna)
    const there = events(decide(ask, elsewhere, { proposal: 'p-1' })).reduce(evolve, ask)
    expect(there.open).toMatchObject({ id: 'p-1', elsewhere: 'ana' })
    // A Turn at home, and one in a third System, are refused it; one in hers continues it.
    for (const other of [draft('Home', 'turn-2'), new Draft({ ...fromAna, elsewhere: 'carl' })]) {
      const refused = decide(there, other, { proposal: 'p-2' })
      expect(Result.isFailure(refused) && refused.failure._tag).toBe('ProposalElsewhere')
    }
    expect(
      events(decide(there, new Draft({ ...fromAna, turn: 'turn-3' }), { proposal: 'p-3' })),
    ).toHaveLength(1)
    // And a Proposal at home is no Turn's elsewhere to continue.
    const home = events(decide(ask, draft('Work'), { proposal: 'p-4' })).reduce(evolve, ask)
    expect(Result.isFailure(continuedBy(home, 'ana'))).toBe(true)
    expect(Result.getOrThrow(continuedBy(home, undefined))?.id).toBe('p-4')
    expect(Result.getOrThrow(continuedBy(ask, 'ana'))).toBeUndefined()
  })

  it('opens a new Proposal with the first draft once the last was decided', () => {
    const decided = { mode: 'ask' } as const
    const made = events(decide(decided, draft('Again', 'turn-3'), { proposal: 'p-2' }))
    expect(made[0]).toEqual(new ProposalOpened({ id: 'p-2', turn: 'turn-3' }))
  })
})
