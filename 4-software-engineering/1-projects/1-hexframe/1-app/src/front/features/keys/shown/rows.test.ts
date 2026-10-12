import { describe, expect, it } from 'vitest'

import type { AccountKey } from '#/front/client/iam/keys'

import { rowOf } from './rows'

const now = new Date('2026-10-12T12:00:00Z')

const key = (
  lastUsedAt: Date | null,
  createdAt = new Date('2026-10-02T09:00:00Z'),
): AccountKey => ({
  id: 'k1',
  name: 'Claude Code, laptop',
  start: 'hf_a3f',
  createdAt,
  lastUsedAt,
})

const ago = (ms: number) => new Date(now.getTime() - ms)

describe("a Key's row in the key widget", () => {
  it('says the day it was made, and never used', () => {
    expect(rowOf(key(null), now, 'en')).toEqual({
      id: 'k1',
      name: 'Claude Code, laptop',
      start: 'hf_a3f',
      made: 'Oct 2',
      used: 'never used',
      live: false,
    })
  })

  it('names the year of a Key made another year', () => {
    expect(rowOf(key(null, new Date('2025-08-30T09:00:00Z')), now, 'en').made).toBe('Aug 30, 2025')
  })

  it('lights a Key used within the hour, said in minutes', () => {
    const row = rowOf(key(ago(4 * 60_000)), now, 'en')
    expect(row.live).toBe(true)
    expect(row.used).toBe('used 4 min. ago')
  })

  it('says a use under a minute ago as one minute', () => {
    expect(rowOf(key(ago(5_000)), now, 'en').used).toBe('used 1 min. ago')
  })

  it('says older uses in hours, then days, then the day itself, unlit', () => {
    const hours = rowOf(key(ago(3 * 3_600_000)), now, 'en')
    expect(hours).toMatchObject({ used: 'used 3 hr. ago', live: false })
    expect(rowOf(key(ago(3 * 86_400_000)), now, 'en').used).toBe('used 3 days ago')
    expect(rowOf(key(new Date('2026-08-01T09:00:00Z')), now, 'en').used).toBe('used Aug 1')
  })

  it('reads in French', () => {
    const row = rowOf(key(ago(3 * 86_400_000)), now, 'fr')
    expect(row.made).toBe('2 oct.')
  })
})
