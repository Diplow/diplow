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

import { readVisitSearch, visiting, visitLinkOf, visitTree, withVisit } from './visit'

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
  owned: true,
  version: 0,
}

const shown = { system: seen, root: systemOf(seen), gaps: seen.gaps, rights: seen.rights }

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

describe('what a visitor may do', () => {
  const reach = visiting(shown)

  it('reads what Mapping lets them read, and nothing more yet, whatever else it grants', () => {
    expect([...reach.rights('garden')]).toEqual(['read'])
    expect([...reach.rights('seeds')]).toEqual(['read'])
    expect([...reach.rights('ana')]).toEqual([])
    expect([...reach.rights('nowhere')]).toEqual([])
    expect(reach.yours).toBe(false)
  })
})
