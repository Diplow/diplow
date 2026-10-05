import { describe, expect, it } from 'vitest'

import type { SystemTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'

import {
  canvasTree,
  isContextSlot,
  isEmptySystem,
  isLeafSlot,
  slotOf,
  swapsWith,
  tileIn,
} from './tree'

const tile = (
  id: string,
  below: Partial<Pick<SystemTile, 'branches' | 'leaves' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title: id.toUpperCase(),
  preview: `What ${id} is`,
  body: '',
  branches: {},
  leaves: {},
  context: {},
  ...below,
})

const why = tile('why', { branches: { 2: tile('deep') } })
const a = tile('a', { branches: { 3: tile('a3') } })
const system: SystemTile = {
  ...tile('root', {
    branches: { 1: a, 4: tile('b') },
    leaves: { 1: tile('notes') },
    context: {
      [-1]: why,
      [-2]: { _tag: 'Reference', tile: { id: 'a3', title: 'A3', preview: 'A child', body: '' } },
      [-5]: { _tag: 'BrokenReference', target: 'gone' },
    },
  }),
  title: '',
}

describe('canvasTree', () => {
  const tree = canvasTree(system)

  it('keeps the Branches by Direction, and every Tile below', () => {
    expect(tree.branches?.[1]).toMatchObject({ id: 'a', title: 'A', preview: 'What a is' })
    expect(tree.branches?.[1]?.branches?.[3]).toMatchObject({ id: 'a3' })
    expect(tree.branches?.[4]).toMatchObject({ id: 'b' })
    expect(Object.keys(tree.branches ?? {})).toEqual(['1', '4'])
  })

  it('keeps the Leaves by Direction, each marked as a Leaf', () => {
    expect(tree.leaves).toEqual({
      1: { id: 'notes', title: 'NOTES', preview: 'What notes is', leaf: true },
    })
  })

  it('keys the Context by Direction, a Tile of its own with what is below it', () => {
    expect(tree.context?.[1]).toMatchObject({ id: 'why', branches: { 2: { id: 'deep' } } })
  })

  it('draws a Reference as the Tile it points at, under that Tile id', () => {
    expect(tree.context?.[2]).toEqual({
      id: 'a3',
      title: 'A3',
      preview: 'A child',
      reference: true,
    })
  })

  it('draws a broken Reference as broken, under an id no Tile has', () => {
    expect(tree.context?.[5]).toEqual({
      id: 'broken:root:-5',
      title: m.system_reference_broken(),
      preview: '',
    })
  })

  it('names the untitled Root as untitled', () => {
    expect(tree.title).toBe(m.system_untitled())
  })
})

describe('tileIn', () => {
  it('finds a Tile anywhere, Context Tiles included, with the Tile it stands under', () => {
    expect(tileIn(system, 'root')).toEqual({ tile: system, parent: undefined })
    expect(tileIn(system, 'a3')).toEqual({ tile: a.branches[3], parent: a })
    expect(tileIn(system, 'deep')).toEqual({ tile: why.branches[2], parent: why })
  })

  it('finds a Leaf, with the Tile it stands under', () => {
    expect(tileIn(system, 'notes')).toEqual({ tile: system.leaves[1], parent: system })
  })

  it('finds no Tile behind a broken Reference, nor an unknown id', () => {
    expect(tileIn(system, 'broken:root:-5')).toBeUndefined()
    expect(tileIn(system, 'nowhere')).toBeUndefined()
  })
})

describe('swapsWith', () => {
  const tree = canvasTree(system)
  const moving = tree.branches?.[1] ?? tree
  const offers = (tile: typeof tree | undefined) =>
    tile !== undefined && swapsWith(system, moving, tile)

  it('offers a swap with any Tile drawn where it stands, a Branch or a Context Tile', () => {
    expect([tree.branches?.[4], tree.context?.[1], moving.branches?.[3]].map(offers)).toEqual([
      true,
      true,
      true,
    ])
  })

  it('offers none with the Root, the moving Tile, a Leaf, a Reference or a broken one', () => {
    expect(
      [tree, moving, tree.leaves?.[1], tree.context?.[2], tree.context?.[5]].map(offers),
    ).toEqual([false, false, false, false, false])
  })
})

describe('slotOf and isContextSlot', () => {
  const branch = canvasTree(system).branches?.[4]
  const leaf = canvasTree(system).leaves?.[1]

  it('is the Direction for a new Tile or a Branch, its negation in the Context', () => {
    for (const going of [undefined, branch]) {
      expect(slotOf('children', 3, going)).toBe(3)
      expect(slotOf('branches', 3, going)).toBe(3)
      expect(slotOf('context', 3, going)).toBe(-3)
    }
  })

  it('keeps a moving Leaf a Leaf: its own slot in a ring of Children or of Leaves', () => {
    expect(slotOf('children', 3, leaf)).toEqual({ leaf: 3 })
    expect(slotOf('leaves', 3, leaf)).toEqual({ leaf: 3 })
    expect(slotOf('context', 3, leaf)).toBe(-3)
  })

  it('is a Leaf slot for a new Tile in a ring of Leaves', () => {
    expect(slotOf('leaves', 3)).toEqual({ leaf: 3 })
  })

  it('is no slot where a moving Tile would change kind', () => {
    expect(slotOf('branches', 3, leaf)).toBeUndefined()
    expect(slotOf('leaves', 3, branch)).toBeUndefined()
  })

  it('tells a Context slot from a Branch’s or a Leaf’s', () => {
    expect(isContextSlot(-6)).toBe(true)
    expect(isContextSlot(6)).toBe(false)
    expect(isContextSlot({ leaf: 6 })).toBe(false)
  })
})

describe('isEmptySystem', () => {
  const root = { ...tile('root'), title: '', preview: '' }

  it('is an untitled Root with nothing below it', () => {
    expect(isEmptySystem(root)).toBe(true)
  })

  it('is not once the Root is named, or holds a Branch, a Leaf or a Context Tile', () => {
    expect(isEmptySystem({ ...root, title: 'Ulysse' })).toBe(false)
    // An import would replace a Preview or a Body written before the Root's name.
    expect(isEmptySystem({ ...root, preview: 'Me' })).toBe(false)
    expect(isEmptySystem({ ...root, body: '# Me' })).toBe(false)
    expect(isEmptySystem({ ...root, branches: { 1: tile('a') } })).toBe(false)
    expect(isEmptySystem({ ...root, leaves: { 2: { ...tile('l'), _tag: 'Tile' } } })).toBe(false)
    expect(isEmptySystem({ ...root, context: { [-1]: tile('why') } })).toBe(false)
  })
})

describe('isLeafSlot', () => {
  it('is a Leaf slot, never a Branch nor a Context slot', () => {
    expect(isLeafSlot({ leaf: 4 })).toBe(true)
    expect(isLeafSlot(4)).toBe(false)
    expect(isLeafSlot(-4)).toBe(false)
  })
})
