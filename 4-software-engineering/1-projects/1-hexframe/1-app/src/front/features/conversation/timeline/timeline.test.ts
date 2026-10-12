import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'

import { dayOf, latestUndoable, splitByDay } from './timeline'

// Local dates, so the tests hold in any time zone: days are the reader's.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute)

const message = (id: string, when: Date): Entry => ({
  _tag: 'Message',
  id,
  at: when,
  author: 'user',
  text: id,
})

const now = at(27, 12)

describe('splitByDay', () => {
  const ids = (entries: readonly Entry[]) =>
    splitByDay(entries, now, {}).map((day) => [day.key, day.relative, day.entries.map((e) => e.id)])

  it('groups the entries by local day, oldest day and oldest entry first', () => {
    const entries = [
      message('today', at(27, 9)),
      message('before', at(24, 23, 59)),
      message('early', at(27, 0, 0)),
      message('last night', at(26, 23, 59)),
    ]
    expect(ids(entries)).toEqual([
      ['2026-09-24', undefined, ['before']],
      ['2026-09-26', 'yesterday', ['last night']],
      ['2026-09-27', 'today', ['early', 'today']],
    ])
  })

  it('starts each day at its local midnight', () => {
    const [day] = splitByDay([message('a', at(3, 18, 30))], now, {})
    expect(day?.date).toEqual(new Date(2026, 8, 3))
  })

  it('knows yesterday across a month', () => {
    const first = new Date(2026, 9, 1, 8)
    const [day] = splitByDay([message('a', at(30, 22))], first, {})
    expect(day?.relative).toBe('yesterday')
  })

  it('has no day for no entry', () => {
    expect(splitByDay([], now, {})).toEqual([])
  })

  it('hands every day the Titles it is given', () => {
    const titles = { games: 'Games' }
    const days = splitByDay([message('a', at(26, 9)), message('b', at(27, 9))], now, titles)
    expect(days.map((day) => day.titles)).toEqual([titles, titles])
  })
})

describe('dayOf', () => {
  const read = { entries: [], titles: {} }

  it('starts a date of the reader’s calendar at its local midnight', () => {
    expect(dayOf({ ...read, date: '2026-03-29' }, now)).toEqual({
      key: '2026-03-29',
      date: new Date(2026, 2, 29),
      entries: [],
      titles: {},
    })
  })

  it('says today and yesterday, by the reader’s clock', () => {
    expect(dayOf({ ...read, date: '2026-09-27' }, now).relative).toBe('today')
    expect(dayOf({ ...read, date: '2026-09-26' }, now).relative).toBe('yesterday')
    expect(dayOf({ ...read, date: '2026-09-25' }, now)).not.toHaveProperty('relative')
  })
})

describe('latestUndoable', () => {
  const applied = (turn: string, undone: boolean): Entry => ({
    _tag: 'TurnApplied',
    id: `applied-${turn}`,
    at: now,
    turn,
    changes: 2,
    undone,
  })
  const accepted = (proposal: string, undone?: boolean): Entry => ({
    _tag: 'Proposal',
    id: `proposal-${proposal}`,
    at: now,
    proposal,
    changes: [],
    fate: 'accepted',
    ...(undone !== undefined && { undone }),
  })

  it('undoes the latest that offers its Undo, by the id the Undo takes', () => {
    expect(latestUndoable([applied('t1', false), accepted('p1', false)])).toBe('p1')
    expect(latestUndoable([accepted('p1', false), applied('t1', false)])).toBe('t1')
  })

  it('passes over what was undone, or was accepted before undos were kept', () => {
    expect(latestUndoable([applied('t1', false), applied('t2', true)])).toBe('t1')
    expect(latestUndoable([applied('t1', false), accepted('p1')])).toBe('t1')
  })

  it('undoes nothing when nothing offers its Undo', () => {
    expect(latestUndoable([message('a', now)])).toBeUndefined()
    expect(latestUndoable([])).toBeUndefined()
  })
})
