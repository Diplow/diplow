import { describe, expect, it } from 'vitest'

import type { Reach } from '#/domains/mapping/entities'

import { choiceOf, fromOf, shareRowsOf } from './rows'

// Who reaches a Tile, as the share widget words it: where each value comes from, and what its owner
// set for Everyone there, through inherit. What Mapping answers is `domains/mapping/entities/rights/`'s.

const star = crypto.randomUUID()
const journal = crypto.randomUUID()
const entry = crypto.randomUUID()
const titles: Record<string, string> = { [star]: 'Ana', [journal]: 'Journal', [entry]: 'Entry' }
const around = { tile: entry, star, titleOf: (id: string) => titles[id] }

const everyone = (value: Reach['value'], from: string | null): Reach => ({
  subject: { _tag: 'Everyone' },
  value,
  from,
})

describe('who reaches a Tile, in words', () => {
  it('says where a value comes from: set here, from your star, from the Tile above, by default', () => {
    expect(fromOf(entry, around)).toBe('set here')
    expect(fromOf(star, around)).toBe('from your star')
    expect(fromOf(journal, around)).toBe('from Journal')
    expect(fromOf(null, around)).toBe('by default')
  })

  it('shows Everyone’s choice set on the Tile, or inherit where it comes from above', () => {
    expect(choiceOf(everyone('read', entry), around)).toBe('read')
    expect(choiceOf(everyone('none', entry), around)).toBe('none')
    expect(choiceOf(everyone('read', journal), around)).toBe('inherit')
    expect(choiceOf(everyone('none', null), around)).toBe('inherit')
  })

  it('words Everyone first, with its choice, then everyone else, their rights one after another', () => {
    const rows = shareRowsOf(
      [
        everyone('read', star),
        { subject: { _tag: 'Group', id: 'family' }, value: 'read+write', from: journal },
        { subject: { _tag: 'Account', id: 'bob' }, value: 'none', from: entry },
      ],
      around,
    )
    expect(rows.everyone).toEqual({
      key: 'everyone',
      who: 'Everyone',
      value: 'read',
      from: 'from your star',
      choice: 'inherit',
    })
    expect(rows.others).toEqual([
      { key: 'Group:family', who: 'A group', value: 'read, write', from: 'from Journal' },
      { key: 'Account:bob', who: 'An account', value: 'none', from: 'set here' },
    ])
  })

  it('shows Everyone at none, by default, should Mapping list nobody', () => {
    expect(shareRowsOf([], around).everyone).toMatchObject({
      value: 'none',
      from: 'by default',
      choice: 'inherit',
    })
  })
})
