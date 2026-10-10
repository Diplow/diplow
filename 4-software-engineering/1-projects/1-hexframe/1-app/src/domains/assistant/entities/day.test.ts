import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { Day, dayAt, spanOf } from './day'

// The day split, on instants made by hand: which day an instant falls on for a reader, the instants a
// day spans, and what a reader may ask for.

const instant = (iso: string) => new Date(iso)

describe('the day split', () => {
  it('puts an instant on the day its reader’s clock shows', () => {
    const at = instant('2026-10-10T22:30:00Z')
    expect(dayAt(at, 0)).toEqual({ date: '2026-10-10', offset: 0 })
    expect(dayAt(at, 120)).toEqual({ date: '2026-10-11', offset: 120 })
    expect(dayAt(instant('2026-10-10T03:00:00Z'), -300)).toEqual({
      date: '2026-10-09',
      offset: -300,
    })
  })

  it('spans a day from its reader’s midnight to the next', () => {
    expect(spanOf({ date: '2026-10-10', offset: 120 })).toEqual({
      from: instant('2026-10-09T22:00:00Z'),
      to: instant('2026-10-10T22:00:00Z'),
    })
    expect(spanOf({ date: '2026-10-10', offset: -300 })).toEqual({
      from: instant('2026-10-10T05:00:00Z'),
      to: instant('2026-10-11T05:00:00Z'),
    })
  })

  it('splits two instants either side of a reader’s midnight onto two days', () => {
    const before = instant('2026-10-10T21:59:59.999Z')
    const after = instant('2026-10-10T22:00:00Z')
    const { from, to } = spanOf({ date: '2026-10-10', offset: 120 })
    expect([before >= from && before < to, after >= from && after < to]).toEqual([true, false])
    expect([dayAt(before, 120).date, dayAt(after, 120).date]).toEqual(['2026-10-10', '2026-10-11'])
  })

  it('puts every instant of a day’s span on that day', () => {
    for (const offset of [-840, -300, 0, 330, 840]) {
      const { from, to } = spanOf({ date: '2026-03-29', offset })
      expect(dayAt(from, offset).date).toBe('2026-03-29')
      expect(dayAt(new Date(to.getTime() - 1), offset).date).toBe('2026-03-29')
      expect(dayAt(to, offset).date).toBe('2026-03-30')
    }
  })
})

describe('a day, as a reader asks for it', () => {
  const decoded = (input: unknown) => Schema.decodeUnknownResult(Day)(input)

  it('takes a real date and an offset between UTC−14 and UTC+14, in whole minutes', () => {
    for (const input of [
      { date: '2026-10-10', offset: 0 },
      { date: '2028-02-29', offset: 840 },
      { date: '2026-12-31', offset: -840 },
    ]) {
      expect(decoded(input)._tag, JSON.stringify(input)).toBe('Success')
    }
  })

  it('refuses a date the calendar lacks, one written otherwise, or an offset out of bounds', () => {
    for (const input of [
      { date: '2026-02-30', offset: 0 },
      { date: '2026-13-01', offset: 0 },
      { date: '2026-10-1', offset: 0 },
      { date: '10/10/2026', offset: 0 },
      { date: '2026-10-10', offset: 841 },
      { date: '2026-10-10', offset: 1.5 },
    ]) {
      expect(decoded(input)._tag, JSON.stringify(input)).toBe('Failure')
    }
  })
})
