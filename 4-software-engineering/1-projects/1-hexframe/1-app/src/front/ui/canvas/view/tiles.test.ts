import { describe, expect, it } from 'vitest'

import {
  directionIn,
  findTile,
  firstKindOf,
  kindsOf,
  pathTo,
  sunward,
  type TileNode,
} from './tiles'

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
      context: { 1: tile('b', { reference: { from: 'Elsewhere' } }) },
    })
    expect(pathTo(referenced, 'b').map((found) => found.id)).toEqual(['root', 'b'])
    expect(findTile(referenced, 'b')?.branches?.[1]?.id).toBe('b1')
  })

  it('reaches a Tile hung from the star across a gap, and what stands below it, right below the star', () => {
    const across = tile('far', { across: true, branches: { 2: tile('far2') } })
    const visited = tile('star', { branches: { 1: tile('near') }, gaps: [across] })
    expect(pathTo(visited, 'far2').map((found) => found.id)).toEqual(['star', 'far', 'far2'])
    expect(findTile(visited, 'far')?.across).toBe(true)
    expect(pathTo(visited, 'near').map((found) => found.id)).toEqual(['star', 'near'])
  })
})

describe('directionIn', () => {
  it('finds where a Tile stands under another, a Branch, a Leaf or a Context Tile', () => {
    expect(directionIn(system, tile('a'))).toBe(1)
    expect(directionIn(system, leaf('notes'))).toBe(2)
    expect(directionIn(system, tile('why'))).toBe(2)
  })

  it('finds none for a Tile it does not hold, nor under no Tile', () => {
    expect(directionIn(system, tile('a3'))).toBeUndefined()
    expect(directionIn(undefined, tile('a'))).toBeUndefined()
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

describe('sunward', () => {
  /** The quarter of the canvas a vector points to, by the sign of each of its parts. */
  const toward = (vector: { x: number; y: number } | undefined) =>
    vector && { x: Math.sign(Math.round(vector.x * 1e6)), y: Math.sign(Math.round(vector.y * 1e6)) }

  it('lights nothing at the star itself, nor for a Tile the System does not hold', () => {
    expect(sunward(system, 'root')).toBeUndefined()
    expect(sunward(system, 'nowhere')).toBeUndefined()
  })

  it('points back the way a Child stands from it: from its top left, to the bottom right', () => {
    expect(toward(sunward(system, 'a'))).toEqual({ x: 1, y: 1 })
    expect(toward(sunward(system, 'b'))).toEqual({ x: -1, y: -1 })
    expect(toward(sunward(system, 'notes'))).toEqual({ x: -1, y: 1 })
  })

  it('weighs the first step from the star most, so a Child turning back does not hide it', () => {
    const turning = tile('root', { branches: { 1: tile('a', { branches: { 4: tile('a4') } }) } })
    expect(toward(sunward(turning, 'a4'))).toEqual({ x: 1, y: 1 })
    expect(toward(sunward(system, 'a3b'))).toEqual(toward(sunward(system, 'a')))
  })

  it('counts a Context Tile by its Direction too', () => {
    expect(toward(sunward(system, 'why'))).toEqual({ x: -1, y: 1 })
  })

  it('points to a star the root drawn stands below, from the root itself', () => {
    // A root in its star's Direction 1: the star stands to its bottom right.
    expect(toward(sunward(system, 'root', [1]))).toEqual({ x: 1, y: 1 })
    expect(toward(sunward(system, 'b', [1]))).toEqual({ x: 1, y: 1 })
  })

  it('is a unit vector', () => {
    const vector = sunward(system, 'a3b')
    expect(Math.hypot(vector?.x ?? 0, vector?.y ?? 0)).toBeCloseTo(1)
  })
})
