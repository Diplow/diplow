import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { EntryContent } from '../entry'
import { offeredNow, offeringEntry, offersUndo, undoing, undoneEntry } from './undo'

// What the Assistant applied, undone once, on Entries and rows made by hand: when a Turn's is offered,
// an accepted Proposal's Entry once it offers its Undo, the Entries that offer an Undo and what they
// say once undone, and whether what was applied may be undone. That the service keeps and undoes it
// is `../../proposals.test.ts`'s.

const proposal = (
  fate: Extract<EntryContent, { _tag: 'Proposal' }>['fate'],
  undone?: boolean,
): EntryContent => ({
  _tag: 'Proposal',
  proposal: 'p-1',
  changes: [],
  fate,
  ...(undone !== undefined && { undone }),
})

const applied = (undone: boolean): EntryContent => ({
  _tag: 'TurnApplied',
  turn: 't-1',
  changes: 2,
  undone,
})

/** A change: the user's own, or someone else's in the user's System, which offers its Undo. */
const change = (undone?: boolean): EntryContent => ({
  _tag: 'Change',
  verb: 'TileEdited',
  tile: { id: 'tile-1', title: 'Journal' },
  actor:
    undone === undefined ? { _tag: 'You' } : { _tag: 'Someone', star: 'Bob', by: { _tag: 'You' } },
  ...(undone !== undefined && { undone }),
})

describe('offeringEntry, an accepted Proposal offering its Undo', () => {
  it('says an accepted Proposal may be undone, once', () => {
    expect(offeringEntry(proposal('accepted'))).toEqual(proposal('accepted', false))
    expect(offersUndo(proposal('accepted', false))).toBe(true)
  })

  it('leaves an open or discarded Proposal, one offering already, and any other Entry', () => {
    for (const entry of [
      proposal('open'),
      proposal('discarded'),
      proposal('accepted', false),
      proposal('accepted', true),
      applied(false),
    ]) {
      expect(offeringEntry(entry)).toBeUndefined()
    }
  })
})

describe('undoneEntry and offersUndo, the Entries that offer an Undo', () => {
  it('says an accepted Proposal and a Turn applied undone, once', () => {
    expect(undoneEntry(proposal('accepted', false))).toEqual(proposal('accepted', true))
    expect(undoneEntry(applied(false))).toEqual(applied(true))
    expect(offersUndo(proposal('accepted', false))).toBe(true)
    expect(offersUndo(applied(false))).toBe(true)
  })

  it("says someone else's change undone, once, and offers none for the user's own", () => {
    expect(undoneEntry(change(false))).toEqual(change(true))
    expect(offersUndo(change(false))).toBe(true)
    for (const entry of [change(true), change()]) {
      expect(undoneEntry(entry)).toBeUndefined()
      expect(offersUndo(entry)).toBe(false)
    }
  })

  it('offers none for an open, discarded or undone Proposal, a Turn undone, or another Entry', () => {
    for (const entry of [
      proposal('open'),
      // Accepted before what undoes it was kept: nothing to undo.
      proposal('accepted'),
      proposal('discarded'),
      proposal('accepted', true),
      applied(true),
      { _tag: 'TurnEnded', how: 'stopped' } as const,
    ]) {
      expect(undoneEntry(entry)).toBeUndefined()
      expect(offersUndo(entry)).toBe(false)
    }
  })
})

describe('undoing, what was applied undone once', () => {
  it('answers the Entry that offers it', () => {
    const kept = { entryId: 'e-1', undoneAt: null, undo: 'inverse' }
    expect(undoing(kept)).toEqual(Result.succeed(kept))
  })

  it('has nothing to undo of nothing applied, a Turn still running, or what was undone', () => {
    for (const kept of [
      undefined,
      { entryId: null, undoneAt: null },
      { entryId: 'e-1', undoneAt: new Date(0) },
    ]) {
      const refused = undoing(kept)
      expect(Result.isFailure(refused) && refused.failure._tag).toBe('NothingToUndo')
    }
  })
})

describe('offeredNow, when what a Turn applied is offered', () => {
  it('offers it once its Turn ended, once, and only when it changed anything', () => {
    expect(offeredNow({ changes: 2, entryId: null }, { ended: true })).toBe(true)
    expect(offeredNow({ changes: 2, entryId: null }, { ended: false })).toBe(false)
    expect(offeredNow({ changes: 2, entryId: 'e-1' }, { ended: true })).toBe(false)
    expect(offeredNow({ changes: 0, entryId: null }, { ended: true })).toBe(false)
    expect(offeredNow(undefined, { ended: true })).toBe(false)
  })
})
