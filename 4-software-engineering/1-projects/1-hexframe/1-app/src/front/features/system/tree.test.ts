import { describe, expect, it } from 'vitest'

import {
  type PlacedTile,
  type Slot,
  type System,
  type SystemTile,
  systemOf,
} from '#/domains/mapping/entities'
import type { TileNode } from '#/front/ui/hex/view/tiles'
import { m } from '#/paraglide/messages'

import { canvasTree, moveOf, slotOf, swapOf, swapsWith, tileIn } from './tree'

const tile = (
  id: string,
  below: Partial<Pick<SystemTile, 'branches' | 'leaves' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title: id.toUpperCase(),
  preview: `What ${id} is`,
  body: '',
  version: 1,
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
  it('finds the Root, under nothing', () => {
    expect(tileIn(system, 'root')).toEqual({ kind: 'root', tile: system, parent: undefined })
  })

  it('finds a Branch anywhere, with the Tile it stands under and its Direction', () => {
    expect(tileIn(system, 'a3')).toEqual({
      kind: 'branch',
      tile: a.branches[3],
      parent: a,
      direction: 3,
    })
    expect(tileIn(system, 'deep')).toEqual({
      kind: 'branch',
      tile: why.branches[2],
      parent: why,
      direction: 2,
    })
  })

  it('finds a Context Tile, with the Tile it stands under and its slot', () => {
    expect(tileIn(system, 'why')).toEqual({ kind: 'context', tile: why, parent: system, slot: -1 })
  })

  it('finds a Leaf, with the Tile it stands under and its Direction', () => {
    expect(tileIn(system, 'notes')).toEqual({
      kind: 'leaf',
      tile: system.leaves[1],
      parent: system,
      direction: 1,
    })
  })

  it('finds no Tile behind a broken Reference, nor an unknown id', () => {
    expect(tileIn(system, 'broken:root:-5')).toBeUndefined()
    expect(tileIn(system, 'nowhere')).toBeUndefined()
  })
})

describe('swapsWith', () => {
  const placed = (id: string, parent: string, slot: Slot, version = 1): PlacedTile => ({
    _tag: 'Tile',
    id,
    title: id.toUpperCase(),
    preview: '',
    body: '',
    version,
    parent,
    slot,
  })
  // The System as the server reads it, flat: the Root holds A in Direction 1, which holds A3 in
  // Direction 3; B in Direction 4; a Leaf in Direction 1; Why in -1, which holds Deep in Direction 2;
  // a Reference to A3 in -2 and one to a deleted Tile in -5.
  const flat: System = {
    root: { _tag: 'Tile', id: 'root', title: '', preview: '', body: '', version: 1 },
    tiles: {
      a: placed('a', 'root', 1, 3),
      a3: placed('a3', 'a', 3),
      b: placed('b', 'root', 4),
      notes: placed('notes', 'root', { leaf: 1 }),
      why: placed('why', 'root', -1),
      deep: placed('deep', 'why', 2),
      toA3: { _tag: 'Reference', id: 'toA3', parent: 'root', slot: -2, target: 'a3' },
      toGone: { _tag: 'Reference', id: 'toGone', parent: 'root', slot: -5, target: 'gone' },
    },
    owned: true,
  }
  const tree = canvasTree(systemOf(flat))
  const offers = (moving: TileNode | undefined, tile: TileNode | undefined) =>
    moving !== undefined && tile !== undefined && swapsWith(flat, moving, tile)

  it('offers a swap with a Tile drawn where it stands, a Branch or a Context Tile, at any depth', () => {
    const moving = tree.branches?.[1]
    const others = [tree.branches?.[4], tree.context?.[1], tree.context?.[1]?.branches?.[2]]
    expect(others.map((tile) => offers(moving, tile))).toEqual([true, true, true])
  })

  it('offers none with the Root, the moving Tile, a Leaf, a Reference or a broken one', () => {
    const moving = tree.branches?.[1]
    const none = [tree, moving, tree.leaves?.[1], tree.context?.[2], tree.context?.[5]]
    expect(none.map((tile) => offers(moving, tile))).toEqual([false, false, false, false, false])
  })

  it('offers none along one line, as Mapping refuses it: a Tile below the moving one, or above', () => {
    const a = tree.branches?.[1]
    const a3 = a?.branches?.[3]
    expect([offers(a, a3), offers(a3, a)]).toEqual([false, false])
  })

  it('names each Tile a move or a swap sends at the Version the System shows of it', () => {
    expect(moveOf(flat, 'a', { parent: 'b', slot: 2 })).toEqual({
      id: 'a',
      version: 3,
      parent: 'b',
      slot: 2,
    })
    expect(swapOf(flat, 'a', 'b')).toEqual({ a: 'a', aVersion: 3, b: 'b', bVersion: 1 })
    expect(moveOf(flat, 'toA3', { parent: 'b', slot: 2 })).toBeUndefined()
    expect(swapOf(flat, 'a', 'gone')).toBeUndefined()
  })
})

describe('slotOf', () => {
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
})
