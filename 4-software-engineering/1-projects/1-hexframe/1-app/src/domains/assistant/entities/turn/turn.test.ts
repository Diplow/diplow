import { describe, expect, it } from 'vitest'

import { linkTo } from '../message/links'
import { deadlineOf, isBadEnd, overdue, stepOf, turnLocation } from './turn'

// A Turn's pure rules, on values made by hand: its deadline and when it is overdue, at the boundary;
// a step cut to what it holds; the ends the timeline tells; and where the Turn answering a Message
// starts. That the service keeps them over the Turns repository is `../../turns.test.ts`'s.

const fifteenMinutes = 15 * 60_000

const started = { startedAt: new Date('2026-10-10T09:00:00Z') }

describe('deadlineOf and overdue, the most a Turn may run', () => {
  it('puts the deadline its maximum length after its start', () => {
    expect(deadlineOf(started, fifteenMinutes)).toEqual(new Date('2026-10-10T09:15:00Z'))
  })

  it('holds a Turn overdue from its deadline on, never before', () => {
    const at = (iso: string) => overdue(started, fifteenMinutes, new Date(iso))
    expect(at('2026-10-10T09:00:00Z')).toBe(false)
    expect(at('2026-10-10T09:14:59.999Z')).toBe(false)
    expect(at('2026-10-10T09:15:00Z')).toBe(true)
    expect(at('2026-10-10T10:00:00Z')).toBe(true)
  })
})

describe('stepOf, what its agent is doing now', () => {
  it('keeps a tool and its detail as they come', () => {
    expect(stepOf('Bash', 'ls -la')).toEqual({ tool: 'Bash', detail: 'ls -la' })
  })

  it('leaves out a detail that is empty or absent', () => {
    expect(stepOf('Read')).toEqual({ tool: 'Read' })
    expect(stepOf('Read', '')).toEqual({ tool: 'Read' })
  })

  it('cuts a tool to 100 characters and a detail to 200, and names a tool with none', () => {
    const step = stepOf('t'.repeat(150), 'd'.repeat(300))
    expect(step.tool).toHaveLength(100)
    expect(step.detail).toHaveLength(200)
    expect(stepOf('')).toEqual({ tool: '?' })
  })
})

describe('isBadEnd, the ends the timeline tells', () => {
  it('tells every end but its answer', () => {
    for (const end of ['stopped', 'ceiling', 'allowance', 'time', 'sandbox']) {
      expect(isBadEnd(end), end).toBe(true)
    }
    expect(isBadEnd('answered')).toBe(false)
  })
})

describe('turnLocation, where the Turn answering a Message starts', () => {
  it('starts in the Tile the Message opens with a link to, else in the centered one', () => {
    expect(turnLocation(`${linkTo('work')} tidy this`, 'root')).toBe('work')
    expect(turnLocation(`tidy ${linkTo('work')}`, 'root')).toBe('root')
    expect(turnLocation('tidy this', 'root')).toBe('root')
  })
})
