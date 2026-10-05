import { describe, expect, it } from 'vitest'

import type { TileNode } from '../view/tiles'
import { showView, type CanvasView } from '../view/view'

import { hexCorners } from './geometry'
import { canvasSize, layoutCanvas, type CanvasHex } from './shape'

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id.toUpperCase(),
  preview: '',
  ...more,
})

const leaf = (id: string) => tile(id, { leaf: true })

// Three Branches and two Leaves: a ring of Children. The Leaf numbered 2 finds Branch 2 there.
const mixed = tile('mixed', {
  branches: { 1: tile('b1', { branches: { 4: tile('b1x') } }), 2: tile('b2'), 5: tile('b5') },
  leaves: { 2: leaf('l2'), 3: leaf('l3') },
  context: { 1: tile('why'), 2: tile('b2', { reference: true }) },
})

// Four Branches and three Leaves: seven, so they show apart.
const many = tile('many', {
  branches: { 1: tile('m1'), 2: tile('m2'), 3: tile('m3'), 4: tile('m4') },
  leaves: { 1: leaf('ml1'), 2: leaf('ml2'), 3: leaf('ml3') },
})

const system = tile('root', { branches: { 1: mixed, 2: many } })

const layout = (view: CanvasView) => layoutCanvas(showView(system, view))

type Kind = CanvasHex['kind']
const only = <K extends Kind>(hexes: CanvasHex[], kind: K) =>
  hexes.filter((hex): hex is Extract<CanvasHex, { kind: K }> => hex.kind === kind)

/** Each Tile's hex, by key, as what it stands for: its role, Direction and generation. */
function tiles(hexes: CanvasHex[]) {
  return Object.fromEntries(
    only(hexes, 'tile').map(({ key, role, direction, generation }) => [
      key,
      [role, direction, generation],
    ]),
  )
}

/** Each empty hex as the slot it stands for: its parent, its ring and its Direction. */
function empties(hexes: CanvasHex[]) {
  return only(hexes, 'empty').map(({ slot, generation }) =>
    [slot.parent.id, slot.ring, slot.direction, generation].join(' '),
  )
}

describe('layoutCanvas', () => {
  it('lays out a ring of Children as the shape does: a clashing Leaf in the first free Direction', () => {
    const hexes = layout({ center: 'mixed' })
    expect(tiles(hexes)).toEqual({
      'tile:mixed': ['center', undefined, 0],
      'tile:b1': ['branch', 1, 1],
      'tile:b2': ['branch', 2, 1],
      'tile:l3': ['leaf', 3, 1],
      'tile:l2': ['leaf', 4, 1],
      'tile:b5': ['branch', 5, 1],
    })
    expect(empties(hexes)).toEqual(['mixed children 6 1'])
  })

  it('names the Branch a clashing Leaf is numbered as, and no other', () => {
    const clashes = only(layout({ center: 'mixed' }), 'tile').flatMap(({ tile, clash }) =>
      clash ? [[tile.id, clash.id]] : [],
    )
    expect(clashes).toEqual([['l2', 'b2']])
  })

  it('shows Branches around and Leaves inside a Tile of more than six', () => {
    const hexes = layout({ center: 'many', inner: 'leaves' })
    expect(only(hexes, 'ground')).toMatchObject([{ key: 'ground:many', ring: 'leaves' }])
    expect(tiles(hexes)).toEqual({
      'tile:many': ['center', undefined, 0],
      'tile:ml1': ['leaf', 1, 1],
      'tile:ml2': ['leaf', 2, 1],
      'tile:ml3': ['leaf', 3, 1],
      'tile:m1': ['branch', 1, 1],
      'tile:m2': ['branch', 2, 1],
      'tile:m3': ['branch', 3, 1],
      'tile:m4': ['branch', 4, 1],
    })
    expect(empties(hexes)).toEqual([
      'many leaves 4 1',
      'many leaves 5 1',
      'many leaves 6 1',
      'many branches 5 1',
      'many branches 6 1',
    ])
  })

  it('draws the center inside its own hex, smaller, when a ring opens there', () => {
    const hexes = layout({ center: 'mixed', inner: 'context' })
    const [ground] = only(hexes, 'ground')
    const center = only(hexes, 'tile').find(({ key }) => key === 'tile:mixed')
    expect(center?.hex.radius).toBeLessThan(ground?.hex.radius ?? 0)
    expect(center?.hex.center).toEqual(ground?.hex.center)
  })

  it('keys a Context Tile by its slot, so a Reference never takes the key of the Tile it points at', () => {
    const hexes = layout({ center: 'mixed', inner: 'context' })
    expect(tiles(hexes)).toMatchObject({
      'tile:mixed:context:1': ['context', 1, 1],
      'tile:mixed:context:2': ['context', 2, 1],
      'tile:b2': ['branch', 2, 1],
    })
    expect(only(hexes, 'tile').find(({ key }) => key === 'tile:mixed:context:2')?.tile).toEqual(
      tile('b2', { reference: true }),
    )
    expect(empties(hexes).filter((slot) => slot.includes('context'))).toEqual([
      'mixed context 3 1',
      'mixed context 4 1',
      'mixed context 5 1',
      'mixed context 6 1',
    ])
  })

  it('opens a Branch into its own Frame, two generations deep, the Branch keeping its key', () => {
    const closed = layout({ center: 'mixed' })
    const opened = layout({ center: 'mixed', expanded: { 1: 'children' } })
    expect(only(opened, 'ground')).toMatchObject([{ key: 'ground:b1', ring: 'children' }])
    expect(tiles(opened)).toMatchObject({
      'tile:b1': ['hub', 1, 1],
      'tile:b1x': ['branch', 4, 2],
    })
    const keyOf = (hexes: CanvasHex[]) => only(hexes, 'tile').find(({ tile }) => tile.id === 'b1')
    expect(keyOf(opened)?.key).toBe(keyOf(closed)?.key)
    expect(empties(opened).filter((slot) => slot.startsWith('b1'))).toEqual([
      'b1 children 1 2',
      'b1 children 2 2',
      'b1 children 3 2',
      'b1 children 5 2',
      'b1 children 6 2',
    ])
  })

  it('opens a Branch into the kind the view names for it', () => {
    const hexes = layout({ center: 'mixed', expanded: { 1: 'context' } })
    expect(only(hexes, 'ground')).toMatchObject([{ key: 'ground:b1', ring: 'context' }])
    expect(empties(hexes).filter((slot) => slot.startsWith('b1'))).toHaveLength(6)
  })

  it('shows a centered Leaf alone, filling the view, with no slot around it', () => {
    const hexes = layout({ center: 'l3' })
    expect(hexes).toHaveLength(1)
    expect(hexes[0]).toMatchObject({ kind: 'tile', role: 'center', tile: { id: 'l3' } })
    expect(hexes[0]?.hex.radius).toBeGreaterThan(200)
  })

  it('gives every hex a key of its own, in every view', () => {
    const views: CanvasView[] = [
      {},
      { inner: 'context', expanded: { 1: 'children', 2: 'leaves' } },
      { center: 'mixed', inner: 'context', expanded: { 1: 'context' } },
      { center: 'many', inner: 'leaves' },
    ]
    for (const view of views) {
      const keys = layout(view).map(({ key }) => key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('keeps every corner of every hex inside the canvas', () => {
    for (const { hex } of layout({ inner: 'context', expanded: { 1: 'children' } })) {
      for (const { x, y } of hexCorners(hex)) {
        expect(x).toBeGreaterThanOrEqual(-1e-9)
        expect(y).toBeGreaterThanOrEqual(-1e-9)
        expect(x).toBeLessThanOrEqual(canvasSize.width + 1e-9)
        expect(y).toBeLessThanOrEqual(canvasSize.height + 1e-9)
      }
    }
  })
})
