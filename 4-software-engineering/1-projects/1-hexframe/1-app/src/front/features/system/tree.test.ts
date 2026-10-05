import { describe, expect, it } from 'vitest'

import type { SystemTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'

import { canvasTree, ringOf, slotOf, swapsWith, tileIn } from './tree'

const tile = (
  id: string,
  below: Partial<Pick<SystemTile, 'children' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title: id.toUpperCase(),
  preview: `What ${id} is`,
  body: '',
  children: {},
  context: {},
  ...below,
})

const why = tile('why', { children: { 2: tile('deep') } })
const a = tile('a', { children: { 3: tile('a3') } })
const system: SystemTile = {
  ...tile('root', {
    children: { 1: a, 4: tile('b') },
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

  it('keeps the Children by Direction, and every Tile below', () => {
    expect(tree.children?.[1]).toMatchObject({ id: 'a', title: 'A', preview: 'What a is' })
    expect(tree.children?.[1]?.children?.[3]).toMatchObject({ id: 'a3' })
    expect(tree.children?.[4]).toMatchObject({ id: 'b' })
    expect(Object.keys(tree.children ?? {})).toEqual(['1', '4'])
  })

  it('keys the Context by Direction, a Tile of its own with what is below it', () => {
    expect(tree.context?.[1]).toMatchObject({ id: 'why', children: { 2: { id: 'deep' } } })
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
      broken: true,
    })
  })

  it('names the untitled Root as untitled', () => {
    expect(tree.title).toBe(m.system_untitled())
  })
})

describe('tileIn', () => {
  it('finds a Tile anywhere, Context Tiles included, with the Tile it stands under', () => {
    expect(tileIn(system, 'root')).toEqual({ tile: system, parent: undefined })
    expect(tileIn(system, 'a3')).toEqual({ tile: a.children[3], parent: a })
    expect(tileIn(system, 'deep')).toEqual({ tile: why.children[2], parent: why })
  })

  it('finds no Tile behind a broken Reference, nor an unknown id', () => {
    expect(tileIn(system, 'broken:root:-5')).toBeUndefined()
    expect(tileIn(system, 'nowhere')).toBeUndefined()
  })
})

describe('swapsWith', () => {
  const tree = canvasTree(system)
  const moving = tree.children?.[1] ?? tree
  const offers = (tile: typeof tree | undefined) =>
    tile !== undefined && swapsWith(tree, moving, tile)

  it('offers a swap with any Tile drawn where it stands, a Child or a Context Tile', () => {
    expect([tree.children?.[4], tree.context?.[1], moving.children?.[3]].map(offers)).toEqual([
      true,
      true,
      true,
    ])
  })

  it('offers none with the Root, the moving Tile, a Reference or a broken one', () => {
    expect([tree, moving, tree.context?.[2], tree.context?.[5]].map(offers)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })
})

describe('slotOf and ringOf', () => {
  it('is the Direction for a Child, its negation in the Context', () => {
    expect(slotOf('children', 3)).toBe(3)
    expect(slotOf('context', 3)).toBe(-3)
  })

  it('reads the ring back from the slot', () => {
    expect(ringOf(slotOf('children', 6))).toBe('children')
    expect(ringOf(slotOf('context', 6))).toBe('context')
  })
})
