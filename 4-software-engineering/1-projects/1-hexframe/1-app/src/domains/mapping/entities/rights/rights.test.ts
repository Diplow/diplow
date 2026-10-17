import { Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  type Actor,
  Grant,
  type GrantValue,
  grantOf,
  lineageFrom,
  rightsOn,
  sharingOf,
  type Subject,
  valueOn,
} from './rights'

// Rights resolved from Grants, on Systems made by hand: the nearest explicit value walking up for
// each subject covering the actor, the union of those, a star that inherits nothing, an owner who
// needs no Grant, and Everyone, who reads at most. What each Operation needs is
// `../../operations/rights/may.test.ts`'s; the service asking it over PGlite, `shared.test.ts` there.

const everyone: Subject = { _tag: 'Everyone' }
const family: Subject = { _tag: 'Group', id: 'family' }
const bob: Subject = { _tag: 'Account', id: 'bob' }

/** An actor who owns nothing, in these Groups, from a Session. */
const actor = (account: string, groups: ReadonlyArray<string> = []): Actor => ({
  account,
  groups,
  owners: [account],
  session: true,
})

/**
 * Ana's System: her star, `journal` and `garden` below it, an `entry` below `journal`, and a
 * Reference in `garden`'s Context.
 */
const lineage = lineageFrom([
  { id: 'ana', parentId: null },
  { id: 'journal', parentId: 'ana' },
  { id: 'entry', parentId: 'journal' },
  { id: 'garden', parentId: 'ana' },
  { id: 'pinned', parentId: 'garden' },
])

const grant = (tile: string, subject: Subject, value: GrantValue): Grant =>
  Schema.decodeUnknownSync(Grant)({ tile, subject, value })

/** The grill's scenario: Everyone reads Ana's star but not `journal`; `family` reads the star. */
const scenario = sharingOf('ana', lineage, [
  grant('ana', everyone, 'read'),
  grant('journal', everyone, 'none'),
  grant('ana', family, 'read'),
])

const rights = (who: Actor, tile: string, sharing = scenario) => [...rightsOn(who, sharing, tile)]

describe('the grill’s scenario', () => {
  it('lets Bob, in Family, read Journal and what is below it, where Everyone is set to none', () => {
    const inFamily = actor('bob', ['family'])
    expect(rights(inFamily, 'journal')).toEqual(['read'])
    expect(rights(inFamily, 'entry')).toEqual(['read'])
  })

  it('keeps Journal and what is below it from a stranger, who reads the rest', () => {
    const stranger = actor('stranger')
    expect(rights(stranger, 'journal')).toEqual([])
    expect(rights(stranger, 'entry')).toEqual([])
    expect(rights(stranger, 'ana')).toEqual(['read'])
    expect(rights(stranger, 'garden')).toEqual(['read'])
    expect(rights(stranger, 'pinned')).toEqual(['read'])
  })

  it('denies one subject only with an explicit none: Bob’s none leaves him Family’s read', () => {
    const denied = sharingOf('ana', lineage, [
      grant('ana', family, 'read'),
      grant('journal', bob, 'none'),
    ])
    expect(valueOn(denied, bob, 'journal')).toBe('none')
    expect(rights(actor('bob', ['family']), 'journal', denied)).toEqual(['read'])
    expect(rights(actor('bob'), 'journal', denied)).toEqual([])
  })

  it('takes the nearest explicit value walking up, and the union across subjects', () => {
    const layered = sharingOf('ana', lineage, [
      grant('ana', bob, 'read+write+@'),
      grant('journal', bob, 'read'),
      grant('journal', family, 'read+@'),
    ])
    expect(valueOn(layered, bob, 'entry')).toBe('read')
    expect(rights(actor('bob'), 'entry', layered)).toEqual(['read'])
    expect(rights(actor('bob', ['family']), 'entry', layered)).toEqual(['read', '@'])
    expect(rights(actor('bob'), 'garden', layered)).toEqual(['read', 'write', '@'])
  })
})

describe('a star and its owner', () => {
  it('gives nobody anything at a star with no Grant, nor below it', () => {
    const closed = sharingOf('ana', lineage, [])
    for (const tile of ['ana', 'journal', 'entry', 'garden', 'pinned']) {
      expect(rights(actor('bob', ['family']), tile, closed)).toEqual([])
      expect(valueOn(closed, everyone, tile)).toBe('none')
    }
  })

  it('gives none on a walk up that comes back to a Tile it passed, which no System holds', () => {
    const looped = sharingOf(
      'ana',
      new Map([
        ['a', 'b'],
        ['b', 'a'],
      ]),
      [],
    )
    expect(valueOn(looped, everyone, 'a')).toBe('none')
  })

  it('gives the owner every right, with no Grant and through a none, but on no Tile it lacks', () => {
    const ana = actor('ana')
    expect(rights(ana, 'journal', sharingOf('ana', lineage, []))).toEqual(['read', 'write', '@'])
    expect(rights(ana, 'journal')).toEqual(['read', 'write', '@'])
    expect(rights({ ...ana, session: false }, 'entry')).toEqual(['read', 'write', '@'])
    expect(rights(ana, 'elsewhere')).toEqual([])
  })

  it('gives an Organization’s admin every right, standing for its owner', () => {
    const admin: Actor = { ...actor('bob'), owners: ['bob', 'ana'] }
    expect(rights(admin, 'entry')).toEqual(['read', 'write', '@'])
  })

  it('gives `write` and `@` apart, each with `read`', () => {
    const apart = sharingOf('ana', lineage, [
      grant('journal', bob, 'read+write'),
      grant('garden', bob, 'read+@'),
    ])
    expect(rights(actor('bob'), 'entry', apart)).toEqual(['read', 'write'])
    expect(rights(actor('bob'), 'garden', apart)).toEqual(['read', '@'])
  })
})

describe('Everyone', () => {
  it('is never given write nor @: no such Grant decodes', () => {
    for (const value of ['read+write', 'read+@', 'read+write+@']) {
      const decoded = Schema.decodeUnknownOption(Grant)({ tile: 'ana', subject: everyone, value })
      expect(Option.isNone(decoded)).toBe(true)
    }
    expect(
      grantOf({ tile: 'ana', subject: 'everyone', subjectId: null, value: 'read+write' }),
    ).toBe(undefined)
  })

  it('reads a row back as the Grant it keeps, and a row that is none as nothing', () => {
    expect(
      grantOf({ tile: 'ana', subject: 'group', subjectId: 'family', value: 'read+@' }),
    ).toEqual({ tile: 'ana', subject: family, value: 'read+@' })
    expect(grantOf({ tile: 'ana', subject: 'everyone', subjectId: null, value: 'read' })).toEqual({
      tile: 'ana',
      subject: everyone,
      value: 'read',
    })
    expect(grantOf({ tile: 'ana', subject: 'account', subjectId: null, value: 'read' })).toBe(
      undefined,
    )
    expect(grantOf({ tile: 'ana', subject: 'account', subjectId: 'bob', value: 'all' })).toBe(
      undefined,
    )
  })
})
