import { describe, expect, it } from 'vitest'

import { findTile, firstKindOf, kindsOf, pathTo, type TileNode } from './tiles'

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const leaf = (id: string) => tile(id, { leaf: true })

const system = tile('root', {
  branches: {
    1: tile('a', { branches: { 3: tile('a3', { branches: { 2: tile('a3b') } }) } }),
    4: tile('b'),
  },
  leaves: { 2: leaf('notes') },
  context: { 2: tile('why', { branches: { 1: tile('why1') } }) },
})

describe('findTile', () => {
  it('finds a Tile anywhere below the root, a Branch, a Leaf or a Context Tile', () => {
    expect(findTile(system, 'root')).toBe(system)
    expect(findTile(system, 'a3b')?.id).toBe('a3b')
    expect(findTile(system, 'notes')?.leaf).toBe(true)
    expect(findTile(system, 'why1')?.id).toBe('why1')
    expect(findTile(system, 'nowhere')).toBeUndefined()
  })
})

describe('pathTo', () => {
  const ids = (id: string) => pathTo(system, id).map((found) => found.id)

  it('goes from the root down to the Tile, both included', () => {
    expect(ids('root')).toEqual(['root'])
    expect(ids('a3b')).toEqual(['root', 'a', 'a3', 'a3b'])
    expect(ids('notes')).toEqual(['root', 'notes'])
  })

  it('goes through a Context slot', () => {
    expect(ids('why1')).toEqual(['root', 'why', 'why1'])
  })

  it('is empty for an id no Tile has', () => {
    expect(ids('nowhere')).toEqual([])
  })

  it('reaches the Tile itself, not a Reference to it met first', () => {
    const referenced = tile('root', {
      branches: { 4: tile('b', { branches: { 1: tile('b1') } }) },
      context: { 1: tile('b', { reference: true }) },
    })
    expect(pathTo(referenced, 'b').map((found) => found.id)).toEqual(['root', 'b'])
    expect(findTile(referenced, 'b')?.branches?.[1]?.id).toBe('b1')
  })
})

describe('kindsOf', () => {
  it('offers Children and Context for six Branches and Leaves or fewer, none at all included', () => {
    expect(kindsOf(system)).toEqual(['children', 'context'])
    expect(kindsOf(tile('empty'))).toEqual(['children', 'context'])
    const six = tile('six', {
      branches: { 1: tile('b1'), 2: tile('b2'), 3: tile('b3') },
      leaves: { 1: leaf('l1'), 2: leaf('l2'), 3: leaf('l3') },
    })
    expect(kindsOf(six)).toEqual(['children', 'context'])
  })

  it('offers Branches, Leaves and Context past six of them in all', () => {
    const seven = tile('seven', {
      branches: { 1: tile('b1'), 2: tile('b2'), 3: tile('b3'), 4: tile('b4') },
      leaves: { 1: leaf('l1'), 2: leaf('l2'), 3: leaf('l3') },
    })
    expect(kindsOf(seven)).toEqual(['branches', 'leaves', 'context'])
    expect(firstKindOf(seven)).toBe('branches')
  })

  it('offers nothing for a Leaf, which has no ring to show', () => {
    expect(kindsOf(leaf('notes'))).toEqual([])
    expect(firstKindOf(leaf('notes'))).toBeUndefined()
  })

  it('shows Children first where they are offered', () => {
    expect(firstKindOf(system)).toBe('children')
  })
})
