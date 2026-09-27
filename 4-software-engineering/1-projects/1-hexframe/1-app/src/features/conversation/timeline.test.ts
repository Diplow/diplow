import { describe, expect, it } from 'vitest'

import { excerpt, splitByDay, type Entry } from './timeline'

// Local dates, so the tests hold in any time zone: days are the reader's.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute)

const message = (id: string, when: Date): Entry => ({
  kind: 'message',
  id,
  at: when,
  author: 'user',
  text: id,
})

const now = at(27, 12)

describe('splitByDay', () => {
  const ids = (entries: readonly Entry[]) =>
    splitByDay(entries, now).map((day) => [day.key, day.relative, day.entries.map((e) => e.id)])

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
    const [day] = splitByDay([message('a', at(3, 18, 30))], now)
    expect(day?.date).toEqual(new Date(2026, 8, 3))
  })

  it('knows yesterday across a month', () => {
    const first = new Date(2026, 9, 1, 8)
    const [day] = splitByDay([message('a', at(30, 22))], first)
    expect(day?.relative).toBe('yesterday')
  })

  it('has no day for no entry', () => {
    expect(splitByDay([], now)).toEqual([])
  })
})

describe('excerpt', () => {
  it('has nothing to hide in a text that fits', () => {
    expect(excerpt('Short enough.', 13)).toBeUndefined()
  })

  it('cuts a longer text at a word and ends it with an ellipsis', () => {
    expect(excerpt('How software gets built in the AI era', 20)).toBe('How software gets…')
  })

  it('drops the punctuation a cut leaves behind', () => {
    expect(excerpt('Leading teams, and the people in them', 14)).toBe('Leading teams…')
  })

  it('cuts through a word longer than half the limit', () => {
    expect(excerpt('a Supercalifragilistic word', 12)).toBe('a Supercalif…')
  })
})
