import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { accountsIn, choiceOn, GrantChange, namedBy, opens, reachOn } from './reach'
import { Grant, type GrantValue, lineageFrom, originOn, sharingOf, type Subject } from './rights'

// Who reaches a Tile, on a System made by hand: each subject with its value and the Tile it comes
// from, through `inherit`, each Account named by its star; the change its owner sends, Everyone's
// never more than `read`, someone's by their star, any value; and when it first opens a Tile to them.
// The service reading and writing it over PGlite is `../../sharing/sharing.test.ts`'s.

const everyone: Subject = { _tag: 'Everyone' }
const family: Subject = { _tag: 'Group', id: 'family' }
const bob: Subject = { _tag: 'Account', id: 'bob' }

/** Ana's System: her star, `journal` below it, an `entry` below `journal`, and `garden`. */
const lineage = lineageFrom([
  { id: 'ana', parentId: null },
  { id: 'journal', parentId: 'ana' },
  { id: 'entry', parentId: 'journal' },
  { id: 'garden', parentId: 'ana' },
])

const grant = (tile: string, subject: Subject, value: GrantValue): Grant =>
  Schema.decodeUnknownSync(Grant)({ tile, subject, value })

describe('who reaches a Tile', () => {
  it('lists Everyone alone, at none from nowhere, on a System no Grant opens', () => {
    expect(reachOn(sharingOf('ana', lineage, []), 'entry')).toEqual({
      everyone: { subject: everyone, value: 'none', from: null },
      others: [],
    })
  })

  it('says where each value comes from: set here, or the nearest Tile above, the star among them', () => {
    const sharing = sharingOf('ana', lineage, [
      grant('ana', everyone, 'read'),
      grant('journal', everyone, 'none'),
      grant('ana', family, 'read'),
    ])
    expect(reachOn(sharing, 'garden')).toEqual({
      everyone: { subject: everyone, value: 'read', from: 'ana' },
      others: [{ subject: family, value: 'read', from: 'ana' }],
    })
    expect(reachOn(sharing, 'journal')).toEqual({
      everyone: { subject: everyone, value: 'none', from: 'journal' },
      others: [{ subject: family, value: 'read', from: 'ana' }],
    })
    // Through inherit: the entry, which sets nothing, takes what journal sets.
    expect(reachOn(sharing, 'entry')).toEqual({
      everyone: { subject: everyone, value: 'none', from: 'journal' },
      others: [{ subject: family, value: 'read', from: 'ana' }],
    })
  })

  it('leaves out a subject that reaches nothing there, unless a Grant on the Tile itself says none', () => {
    const sharing = sharingOf('ana', lineage, [
      grant('garden', bob, 'read+write'),
      grant('journal', family, 'none'),
    ])
    expect(reachOn(sharing, 'entry').others).toEqual([])
    expect(reachOn(sharing, 'journal').others).toEqual([
      { subject: family, value: 'none', from: 'journal' },
    ])
    expect(reachOn(sharing, 'garden')).toEqual({
      everyone: { subject: everyone, value: 'none', from: null },
      others: [{ subject: bob, value: 'read+write', from: 'garden' }],
    })
  })
})

describe('what its owner chose on a Tile', () => {
  const at = (value: GrantValue, from: string | null) => ({ subject: everyone, value, from })

  it('is the value set on the Tile, or inherit where it comes from above or nowhere', () => {
    expect(choiceOn(at('read', 'entry'), 'entry')).toBe('read')
    expect(choiceOn(at('none', 'entry'), 'entry')).toBe('none')
    expect(choiceOn(at('read', 'journal'), 'entry')).toBe('inherit')
    expect(choiceOn(at('none', null), 'entry')).toBe('inherit')
    expect(choiceOn({ subject: bob, value: 'read+write+@', from: 'entry' }, 'entry')).toBe(
      'read+write+@',
    )
  })
})

describe('a change to who reaches a Tile', () => {
  const accepts = (input: unknown) => Schema.is(GrantChange)(input)
  const tile = crypto.randomUUID()

  it('sets Everyone to read or none, or back to inherit', () => {
    for (const value of ['read', 'none', 'inherit']) {
      expect(accepts({ tile, subject: everyone, value })).toBe(true)
    }
  })

  it('never gives Everyone write nor @, and names a Tile by its UUID', () => {
    for (const value of ['read+write', 'read+@', 'read+write+@']) {
      expect(accepts({ tile, subject: everyone, value })).toBe(false)
    }
    expect(accepts({ tile: 'help', subject: everyone, value: 'read' })).toBe(false)
  })

  it('names someone by their star, a UUID, never by their Account, and gives them any value', () => {
    const star = crypto.randomUUID()
    for (const value of ['none', 'read', 'read+write', 'read+@', 'read+write+@', 'inherit']) {
      expect(accepts({ tile, subject: { _tag: 'Account', star }, value })).toBe(true)
    }
    expect(accepts({ tile, subject: bob, value: 'read' })).toBe(false)
    expect(accepts({ tile, subject: { _tag: 'Account', star: 'help' }, value: 'read' })).toBe(false)
    expect(accepts({ tile, subject: { _tag: 'Group', star }, value: 'read' })).toBe(false)
  })
})

describe('a Tile opened to someone', () => {
  const sharing = sharingOf('ana', lineage, [
    grant('journal', bob, 'read'),
    grant('garden', bob, 'none'),
  ])
  /** Bob on a Tile, before a change. */
  const before = (tile: string) => ({ subject: bob, ...originOn(sharing, bob, tile) })

  it('is told when a Grant of the Tile’s own first lets them read, whatever the Tile above gives', () => {
    // Entry inherits read from Journal: a Grant of its own is a share of its own.
    expect(opens(before('entry'), 'entry', 'read+write')).toBe(true)
    expect(opens({ subject: bob, value: 'none', from: null }, 'garden', 'read+@')).toBe(true)
  })

  it('is not told by any change of a Grant set there, none to read included, by none, nor by inherit', () => {
    expect(opens(before('journal'), 'journal', 'read+write+@')).toBe(false)
    expect(opens(before('garden'), 'garden', 'read')).toBe(false)
    expect(opens(before('entry'), 'entry', 'none')).toBe(false)
    expect(opens(before('garden'), 'garden', 'inherit')).toBe(false)
  })
})

describe('who reaches a Tile, named', () => {
  it('names each Account by its star, by the Account it stands for, none for one with no star', () => {
    const reaching = reachOn(
      sharingOf('ana', lineage, [
        grant('journal', bob, 'read'),
        grant('journal', { _tag: 'Account', id: 'cleo' }, 'read'),
        grant('journal', family, 'read'),
      ]),
      'journal',
    )
    expect(accountsIn(reaching)).toEqual(['bob', 'cleo'])
    const card = { id: 'bobs-star', title: 'Bob', preview: 'Bob, in short.' }
    expect(namedBy(reaching, new Map([['bob', card]])).others).toEqual([
      { subject: bob, value: 'read', from: 'journal', star: card },
      { subject: { _tag: 'Account', id: 'cleo' }, value: 'read', from: 'journal', star: undefined },
      { subject: family, value: 'read', from: 'journal' },
    ])
  })
})
