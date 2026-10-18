import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { GrantChange, reachOn } from './reach'
import { Grant, type GrantValue, lineageFrom, sharingOf, type Subject } from './rights'

// Who reaches a Tile, on a System made by hand: each subject with its value and the Tile it comes
// from, through `inherit`; and the change its owner sends, Everyone's alone, never more than `read`.
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

describe('a change to who reaches a Tile', () => {
  const accepts = (input: unknown) => Schema.is(GrantChange)(input)
  const tile = crypto.randomUUID()

  it('sets Everyone to read or none, or back to inherit', () => {
    for (const value of ['read', 'none', 'inherit']) {
      expect(accepts({ tile, subject: everyone, value })).toBe(true)
    }
  })

  it('never gives Everyone write nor @, takes no other subject yet, and names a Tile by its UUID', () => {
    for (const value of ['read+write', 'read+@', 'read+write+@']) {
      expect(accepts({ tile, subject: everyone, value })).toBe(false)
    }
    expect(accepts({ tile, subject: bob, value: 'read' })).toBe(false)
    expect(accepts({ tile: 'help', subject: everyone, value: 'read' })).toBe(false)
  })
})
