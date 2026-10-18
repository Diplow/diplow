import { describe, expect, it } from 'vitest'

import { isMember, memberRowsOf, starOfRow } from './rows'

// The Members widget's rows, as they word IAM's members: by their stars, keyed by them.

const ana = {
  star: { id: 'anas-star', title: 'Ana Lima', preview: '' },
  role: 'admin',
  you: true,
} as const
const bob = {
  star: { id: 'bobs-star', title: '', preview: '' },
  role: 'member',
  you: false,
} as const
const cleo = { star: undefined, role: 'member', you: false } as const

describe('the Members widget’s rows', () => {
  it('name each member by their star, one untitled or without one said so', () => {
    const rows = memberRowsOf([ana, bob, cleo])
    expect(rows.map(({ key, role, you }) => ({ key, role, you }))).toEqual([
      { key: 'anas-star', role: 'admin', you: true },
      { key: 'bobs-star', role: 'member', you: false },
      { key: 'starless:2', role: 'member', you: false },
    ])
    expect(rows[0]?.who).toBe('Ana Lima')
    expect(rows[1]?.who).toBe(rows[2]?.who)
    expect(rows[1]?.who).not.toBe('')
  })

  it('send a change by the star a row is keyed by, none for a member without one', () => {
    const [anas, , cleos] = memberRowsOf([ana, bob, cleo])
    expect(starOfRow(anas?.key ?? '')).toBe('anas-star')
    expect(starOfRow(cleos?.key ?? '')).toBeUndefined()
  })

  it('tell a star among the members', () => {
    expect(isMember([ana, cleo], 'anas-star')).toBe(true)
    expect(isMember([ana, cleo], 'bobs-star')).toBe(false)
  })
})
