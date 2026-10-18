import { Schema, Struct } from 'effect'
import { describe, expect, it } from 'vitest'

import type { FoundTile, PlacedReference, PlacedTile, System } from '../system'
import { systemOf } from '../system'
import { type Actor, Grant, type GrantValue, lineageOf, sharingOf, type Subject } from './rights'
import { cardOf, seenBy, sightVersion } from './seen'

// A System as an actor may see it, on a System made by hand: whole for its owner, every right on
// every Tile; for anyone else, only what they may read, the star as its card, and a Tile below one
// they may not read placed under the star, the gap marked. The read over PGlite is
// `../../operations/rights/seen.test.ts`'s.

const everyone: Subject = { _tag: 'Everyone' }
const family: Subject = { _tag: 'Group', id: 'family' }

/** Someone acting on the System, standing for these owners, in these Groups, from a Session. */
const actor = (account: string, groups: ReadonlyArray<string> = []): Actor => ({
  account,
  groups,
  owners: [account],
  session: true,
})

const star: FoundTile = {
  _tag: 'Tile',
  id: 'ana',
  title: 'Ana',
  preview: 'Who Ana is.',
  body: '# Ana',
  version: 3,
  name: 'ana',
}

const tile = (id: string, parent: string, slot: PlacedTile['slot']): PlacedTile => ({
  _tag: 'Tile',
  id,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}`,
  version: 1,
  parent,
  slot,
})

/**
 * Ana's System: `journal` with an `entry` below it, which holds `draft`, and `garden` with a
 * Reference to `journal` in its Context.
 */
const system: System = {
  root: star,
  tiles: {
    journal: tile('journal', 'ana', 1),
    entry: tile('entry', 'journal', 1),
    draft: tile('draft', 'entry', 2),
    garden: tile('garden', 'ana', 2),
    pinned: { _tag: 'Reference', id: 'pinned', parent: 'garden', slot: -1, target: 'journal' },
  },
  owned: true,
  version: 9,
}

const grant = (on: string, subject: Subject, value: GrantValue): Grant =>
  Schema.decodeUnknownSync(Grant)({ tile: on, subject, value })

const sharedBy = (...grants: ReadonlyArray<Grant>) => sharingOf('ana', lineageOf(system), grants)

/** The grill's scenario: Everyone reads Ana's star but not `journal`; `family` reads the star. */
const scenario = sharedBy(
  grant('ana', everyone, 'read'),
  grant('journal', everyone, 'none'),
  grant('ana', family, 'read'),
)

describe('a System as its owner sees it', () => {
  it('is the System whole, every right on every Tile, no gap', () => {
    const seen = seenBy(actor('ana'), system, scenario)
    expect({ ...seen, rights: undefined, gaps: undefined }).toEqual({
      ...system,
      rights: undefined,
      gaps: undefined,
    })
    expect(seen.rights).toEqual(
      Object.fromEntries(
        ['ana', 'journal', 'entry', 'draft', 'garden'].map((id) => [id, ['read', 'write', '@']]),
      ),
    )
    expect(seen.gaps).toEqual({})
  })
})

describe('a System as anyone else sees it', () => {
  it('holds what Bob, in Family, reads, each Tile with his rights on it', () => {
    const seen = seenBy(actor('bob', ['family']), system, scenario)
    expect(seen.root).toEqual(star)
    expect(Object.keys(seen.tiles).sort()).toEqual([
      'draft',
      'entry',
      'garden',
      'journal',
      'pinned',
    ])
    expect(seen.rights).toMatchObject({ ana: ['read'], journal: ['read'], draft: ['read'] })
    expect(seen.gaps).toEqual({})
    // How many changes the System saw would tell of the Tiles kept from him: he is shown how what he
    // sees stands instead.
    expect(seen.version).toBe(sightVersion(seen))
    expect(seen.version).not.toBe(system.version)
  })

  it('keeps Journal and what is below it from a stranger, a Reference to it too', () => {
    const seen = seenBy(actor('stranger'), system, scenario)
    expect(Object.keys(seen.tiles).sort()).toEqual(['garden'])
    expect(seen.rights).toEqual({ ana: ['read'], garden: ['read'] })
    // The Reference would say Journal's id: Garden's Context holds nothing the stranger sees.
    expect(JSON.stringify(seen)).not.toContain('journal')
    expect(systemOf(seen).branches[2]?.context).toEqual({})
  })

  it('keeps a Reference to the star, whose card anyone sees', () => {
    const toStar: PlacedReference = {
      _tag: 'Reference',
      id: 'home',
      parent: 'garden',
      slot: -2,
      target: 'ana',
    }
    const withHome: System = { ...system, tiles: { ...system.tiles, home: toStar } }
    const sharing = sharingOf('ana', lineageOf(withHome), [grant('garden', everyone, 'read')])
    expect(seenBy(actor('stranger'), withHome, sharing).tiles['home']).toEqual(toStar)
  })

  it('shows a star with no Grant as its card only, its Title and Preview', () => {
    const seen = seenBy(actor('stranger'), system, sharedBy())
    expect(seen.root).toEqual({
      _tag: 'Tile',
      id: 'ana',
      title: 'Ana',
      preview: 'Who Ana is.',
      body: '',
      version: 1,
    })
    expect(seen.root).toEqual(cardOf(star))
    expect(seen.tiles).toEqual({})
    expect(seen.rights).toEqual({ ana: [] })
  })

  it('shows a Tile they read below one they may not under its card, as it stands', () => {
    const seen = seenBy(actor('stranger'), system, sharedBy(grant('journal', everyone, 'read')))
    expect(Object.keys(seen.tiles).sort()).toEqual(['draft', 'entry', 'journal'])
    expect(seen.tiles['journal']).toEqual(system.tiles['journal'])
    expect(seen.gaps).toEqual({})
    expect(systemOf(seen).branches[1]?.branches[1]?.title).toBe('entry')
  })

  it('hangs a Tile below one they may not read from the star across a gap, with no place', () => {
    const toBob = grant('entry', { _tag: 'Account', id: 'bob' }, 'read+write')
    const seen = seenBy(actor('bob'), system, sharedBy(toBob))
    const entry = Struct.omit(tile('entry', 'journal', 1), ['parent', 'slot'])
    expect(seen.gaps).toEqual({ entry })
    // What stands below the gap stands under it, where it stood.
    expect(seen.tiles).toEqual({ draft: system.tiles['draft'] })
    expect(seen.rights).toEqual({ ana: [], draft: ['read', 'write'], entry: ['read', 'write'] })
    // Journal's id and its slot are nowhere; the star's tree holds none of the gap's.
    expect(JSON.stringify(seen)).not.toContain('journal')
    expect(systemOf(seen)).toMatchObject({ branches: {}, leaves: {}, context: {} })
  })

  it('leaves out a Reference they read under a Tile they may not', () => {
    const seen = seenBy(
      actor('stranger'),
      system,
      sharedBy(grant('pinned', everyone, 'read'), grant('journal', everyone, 'read')),
    )
    expect(Object.keys(seen.tiles).sort()).toEqual(['draft', 'entry', 'journal'])
    expect(seen.gaps).toEqual({})
  })
})

describe('the Version a reader who is not the owner is shown', () => {
  /** Ana's System with one of its Tiles changed, as a write would leave it, its count moved on. */
  const changed = (id: string, change: Partial<PlacedTile>): System => {
    const held = system.tiles[id]
    if (held?._tag !== 'Tile') throw new Error(`No Tile ${id}`)
    return { ...system, tiles: { ...system.tiles, [id]: { ...held, ...change } }, version: 10 }
  }

  const strangerOn = (seen: System, sharing = scenario) =>
    seenBy(actor('stranger'), seen, sharing).version

  it('stays as it is for a change to a Tile kept from them, the count moving on', () => {
    expect(strangerOn(changed('entry', { title: 'Hidden', version: 2 }))).toBe(strangerOn(system))
  })

  it('moves for a change to a Tile they see, its card, a Tile come or gone, and their rights', () => {
    const before = strangerOn(system)
    expect(strangerOn(changed('garden', { title: 'Orchard', version: 2 }))).not.toBe(before)
    expect(strangerOn({ ...system, root: { ...star, title: 'Ana Lima' } })).not.toBe(before)
    const { garden: _gone, ...left } = system.tiles
    expect(strangerOn({ ...system, tiles: left })).not.toBe(before)
    // The same rights by another Grant say the same; a right more says another.
    const scenarioWith = (more: Grant) =>
      sharedBy(
        grant('ana', everyone, 'read'),
        grant('journal', everyone, 'none'),
        grant('ana', family, 'read'),
        more,
      )
    expect(strangerOn(system, scenarioWith(grant('garden', everyone, 'read')))).toBe(before)
    const toStranger = grant('garden', { _tag: 'Account', id: 'stranger' }, 'read+write')
    expect(strangerOn(system, scenarioWith(toStranger))).not.toBe(before)
  })
})
