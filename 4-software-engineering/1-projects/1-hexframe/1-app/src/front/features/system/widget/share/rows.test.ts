import { describe, expect, it } from 'vitest'

import type { NamedReach, Reach } from '#/domains/mapping/entities'

import { changeOf, fromOf, named, shareRowsOf, withSent } from './rows'

// Who reaches a Tile, as the share widget words it: where each value comes from, what its owner set
// for Everyone and for someone named by their star there, through inherit, what a choice sends and
// the one on its way shown. What Mapping answers is `domains/mapping/entities/rights/`'s.

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

  it('words Everyone first, with its choice, then everyone else, their rights one after another', () => {
    const rows = shareRowsOf(
      {
        everyone: everyone('read', star),
        others: [
          {
            subject: { _tag: 'Group', id: 'family' },
            value: 'read+write+@',
            from: journal,
            star: undefined,
          },
          { subject: { _tag: 'Account', id: 'bob' }, value: 'none', from: entry, star: undefined },
        ],
      },
      around,
    )
    expect(rows.everyone).toEqual({
      key: 'Everyone',
      who: 'Everyone',
      value: 'read',
      from: 'from your star',
      choice: 'inherit',
      offered: ['read', 'none', 'inherit'],
    })
    expect(rows.others).toEqual([
      { key: 'Group:family', who: 'A group', value: 'read, write, @', from: 'from Journal' },
      { key: 'Account:bob', who: 'An account', value: 'none', from: 'set here' },
    ])
  })

  it('shows Everyone at none, by default, on a Tile nothing above opens', () => {
    expect(
      shareRowsOf({ everyone: everyone('none', null), others: [] }, around).everyone,
    ).toMatchObject({
      value: 'none',
      from: 'by default',
      choice: 'inherit',
    })
  })
})

describe('someone the Tile is shared with', () => {
  const bobsStar = crypto.randomUUID()
  const reached = {
    everyone: everyone('none', null),
    others: [
      {
        subject: { _tag: 'Account', id: 'bob' },
        value: 'read+write',
        from: entry,
        star: { id: bobsStar, title: 'Bob Martin', preview: '' },
      },
      {
        subject: { _tag: 'Account', id: 'cleo' },
        value: 'read',
        from: journal,
        star: { id: crypto.randomUUID(), title: '', preview: '' },
      },
      { subject: { _tag: 'Group', id: 'family' }, value: 'read', from: journal, star: undefined },
    ],
  } satisfies { everyone: Reach; others: NamedReach[] }
  const rows = shareRowsOf(reached, around)

  it('is named by their star, one not named yet said so, with what its owner set here', () => {
    expect(rows.others).toEqual([
      {
        key: 'Account:bob',
        who: 'Bob Martin',
        value: 'read, write',
        from: 'set here',
        choice: 'read+write',
        offered: ['none', 'read', 'read+write', 'read+@', 'read+write+@', 'inherit'],
        star: bobsStar,
      },
      expect.objectContaining({ who: 'A star not named yet', choice: 'inherit' }),
      { key: 'Group:family', who: 'A group', value: 'read', from: 'from Journal' },
    ])
  })

  it('is sent a choice by their star, Everyone theirs, a group nothing, nor Everyone a write', () => {
    expect(changeOf(rows, entry, 'Account:bob', 'read+@')).toEqual({
      tile: entry,
      subject: { _tag: 'Account', star: bobsStar },
      value: 'read+@',
    })
    expect(changeOf(rows, entry, 'Everyone', 'read')).toEqual({
      tile: entry,
      subject: { _tag: 'Everyone' },
      value: 'read',
    })
    expect(changeOf(rows, entry, 'Everyone', 'read+write')).toBeUndefined()
    expect(changeOf(rows, entry, 'Group:family', 'none')).toBeUndefined()
  })

  it('shows the choice on its way on the row it was sent for alone', () => {
    const sent = {
      tile: entry,
      subject: { _tag: 'Account', star: bobsStar },
      value: 'none',
    } as const
    const shown = withSent(rows, sent)
    expect(shown.others.map((row) => ('choice' in row ? row.choice : undefined))).toEqual([
      'none',
      'inherit',
      undefined,
    ])
    expect(shown.everyone.choice).toBe('inherit')
    const toEveryone = { tile: entry, subject: { _tag: 'Everyone' }, value: 'read' } as const
    expect(withSent(rows, toEveryone).everyone.choice).toBe('read')
    expect(withSent(rows, undefined)).toEqual(rows)
  })

  it('is named among the rows by their star, so picking them again sends nothing', () => {
    expect(named(rows, bobsStar)).toBe(true)
    expect(named(rows, crypto.randomUUID())).toBe(false)
  })
})
