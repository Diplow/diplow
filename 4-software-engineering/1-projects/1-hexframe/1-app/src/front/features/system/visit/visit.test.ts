import { describe, expect, it } from 'vitest'

import {
  type FoundTile,
  type PlacedTile,
  type Seen,
  type Slot,
  systemOf,
} from '#/domains/mapping/entities'
import { pathTo } from '#/front/ui/canvas/view/tiles'
import { centerOn, showView } from '#/front/ui/canvas/view/view'

import {
  centeringOf,
  pinFollowed,
  readVisitSearch,
  titlesIn,
  visitLinkOf,
  visitTree,
  withVisit,
} from './visit'

// Someone else's System as a visitor sees it, made by hand as Mapping's `Seen` answers it: Ana's
// star, her card; Garden under it, which Bob reads; Seeds under a Tile kept from him, a gap, and
// Sprouts below Seeds.

const found = (id: string, title: string): FoundTile => ({
  _tag: 'Tile',
  id,
  title,
  preview: `${title}, in short.`,
  body: `# ${title}`,
  version: 2,
})

const placed = (id: string, title: string, parent: string, slot: Slot): PlacedTile => ({
  ...found(id, title),
  parent,
  slot,
})

const seen: Seen = {
  root: { ...found('ana', 'Ana'), body: '', version: 1 },
  tiles: {
    garden: placed('garden', 'Garden', 'ana', 2),
    sprouts: placed('sprouts', 'Sprouts', 'seeds', 4),
  },
  gaps: { seeds: found('seeds', 'Seeds') },
  rights: { ana: [], garden: ['read', 'write'], seeds: ['read', '@'], sprouts: ['read'] },
  pinned: {},
  owned: true,
  version: 0,
}

const shown = {
  system: seen,
  root: systemOf(seen),
  gaps: seen.gaps,
  rights: seen.rights,
  pinned: seen.pinned,
}

describe('a visit in the URL', () => {
  it('names someone else’s System by its star, and falls back on the Account’s own', () => {
    expect(readVisitSearch({ system: 'ana' })).toEqual({ system: 'ana' })
    expect(readVisitSearch({})).toEqual({ system: undefined })
    expect(readVisitSearch({ system: '' })).toEqual({ system: undefined })
    expect(withVisit(undefined)).toEqual({ system: undefined })
  })

  it('is reached by a Tile’s link on the page’s site', () => {
    expect(visitLinkOf('a b', 'https://hexframe.test/?center=x')).toBe(
      'https://hexframe.test/t/a%20b',
    )
  })
})

describe('someone else’s System on the canvas', () => {
  const tree = visitTree(shown)

  it('starts at the star’s card, with what the visitor reads where it stands', () => {
    expect(tree).toMatchObject({ id: 'ana', title: 'Ana', branches: { 2: { id: 'garden' } } })
    expect(pathTo(tree, 'garden').map(({ id }) => id)).toEqual(['ana', 'garden'])
  })

  it('hangs a Tile below one kept from the visitor from the star across a gap, with what is below it', () => {
    expect(tree.gaps).toMatchObject([
      { id: 'seeds', across: true, branches: { 4: { id: 'sprouts' } } },
    ])
    // The corner reads star, "…", Seeds, Sprouts.
    expect(pathTo(tree, 'sprouts').map(({ id, across }) => [id, across])).toEqual([
      ['ana', undefined],
      ['seeds', true],
      ['sprouts', undefined],
    ])
    // Centered, a gap's Tile opens on what is below it; the star's ring never draws it.
    expect(showView(tree, centerOn(tree, 'seeds')).center.id).toBe('seeds')
    expect(Object.values(tree.branches ?? {}).map(({ id }) => id)).toEqual(['garden'])
  })

  it('has no gap on a System seen whole', () => {
    expect(visitTree({ ...shown, gaps: {} }).gaps).toBeUndefined()
  })
})

describe('a Tile the chat names', () => {
  const visited = visitTree(shown)
  const own = visitTree({
    ...shown,
    root: systemOf({ ...seen, root: found('bob', 'Bob'), tiles: {} }),
    gaps: {},
  })

  it('is centered on the System visited when it holds it, the Account’s own otherwise', () => {
    expect(centeringOf('sprouts', { own, visited })).toEqual({ on: 'visited', tree: visited })
    expect(centeringOf('bob', { own, visited })).toEqual({ on: 'own', tree: own })
    expect(centeringOf('bob', { own, visited: undefined })).toEqual({ on: 'own', tree: own })
  })

  it('is visited by its link when neither holds it, and goes nowhere before the Account’s System is read', () => {
    expect(centeringOf('elsewhere', { own, visited })).toEqual({ on: 'link' })
    expect(centeringOf('elsewhere', { own: undefined, visited })).toBeUndefined()
    expect(centeringOf('seeds', { own: undefined, visited })).toEqual({
      on: 'visited',
      tree: visited,
    })
  })
})

describe('the Titles the chat names a System visited by', () => {
  it('holds its star’s card, its gaps and its Tiles', () => {
    expect(titlesIn(shown)).toEqual(
      new Map([
        ['ana', 'Ana'],
        ['seeds', 'Seeds'],
        ['garden', 'Garden'],
        ['sprouts', 'Sprouts'],
      ]),
    )
  })
})

describe('a pin followed on the canvas', () => {
  const pinned = { shed: { id: 'shed', title: 'Shed', preview: 'Tools', starTitle: 'Bob' } }

  it('visits the Tile of another System a gesture follows a Reference to, by its link', () => {
    expect(pinFollowed(pinned, { gesture: 'center', tile: 'shed' })).toBe('shed')
  })

  it('leaves any other gesture to the canvas, a Tile of the System drawn included', () => {
    expect(pinFollowed(pinned, { gesture: 'center', tile: 'garden' })).toBeUndefined()
    expect(pinFollowed({}, { gesture: 'center', tile: 'shed' })).toBeUndefined()
    expect(pinFollowed(pinned, { gesture: 'expand', tile: 'shed' })).toBeUndefined()
    expect(pinFollowed(pinned, { gesture: 'show-context', tile: 'shed' })).toBe('shed')
  })
})
