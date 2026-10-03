import { describe, expect, it } from 'vitest'

import type { Hex } from './geometry'
import { layoutCanvas, type TileNode } from './layout'

const canvas: Hex = { center: { x: 0, y: 0 }, radius: 300 }

const system: TileNode = {
  id: 'root',
  title: 'Root',
  preview: '',
  children: {
    1: {
      id: 'a',
      title: 'A',
      preview: '',
      children: { 3: { id: 'a3', title: 'A3', preview: '' } },
    },
    4: { id: 'b', title: 'B', preview: '' },
  },
  context: { 2: { id: 'why', title: 'Why', preview: '' } },
}

function kinds(placements: ReturnType<typeof layoutCanvas>) {
  return placements.map((placement) => placement.kind)
}

describe('layoutCanvas', () => {
  it('draws the centered Tile as a Frame: its hub and six slots, filled or empty', () => {
    const placements = layoutCanvas(system, { expanded: new Set(), context: false }, canvas)
    expect(kinds(placements)).toEqual([
      'frame',
      'tile',
      'tile',
      'empty',
      'empty',
      'tile',
      'empty',
      'empty',
    ])
    expect(placements[1]).toMatchObject({ role: 'hub', tile: { id: 'root' } })
  })

  it('draws an expanded Child as a Frame in its slot, after the Frame holding it', () => {
    const placements = layoutCanvas(system, { expanded: new Set(['a']), context: false }, canvas)
    const frames = placements.filter((placement) => placement.kind === 'frame')
    expect(frames.map((frame) => [frame.tile.id, frame.depth])).toEqual([
      ['root', 0],
      ['a', 1],
    ])
    const a3 = placements.find(
      (placement) => placement.kind === 'tile' && placement.tile.id === 'a3',
    )
    expect(a3?.depth).toBe(2)
  })

  it("opens the centered Tile's Context inside its own slot", () => {
    const placements = layoutCanvas(system, { expanded: new Set(), context: true }, canvas)
    const frames = placements.filter((placement) => placement.kind === 'frame')
    expect(frames.map((frame) => [frame.ring, frame.tile.id, frame.depth])).toEqual([
      ['children', 'root', 0],
      ['context', 'root', 1],
    ])
    const inContext = placements.filter(
      (placement) =>
        (placement.kind === 'empty' && placement.ring === 'context') ||
        (placement.kind === 'tile' && placement.role === 'context'),
    )
    expect(inContext.filter((placement) => placement.kind === 'empty')).toHaveLength(5)
    expect(inContext.find((placement) => placement.kind === 'tile')).toMatchObject({
      tile: { id: 'why' },
    })
  })

  it('names the Tile each empty slot belongs to, in its Frame or its Context', () => {
    const placements = layoutCanvas(system, { expanded: new Set(['a']), context: true }, canvas)
    const empty = placements.flatMap((placement) =>
      placement.kind === 'empty' ? [[placement.ring, placement.parent.id]] : [],
    )
    expect(new Set(empty.map((slot) => slot.join(':')))).toEqual(
      new Set(['children:root', 'children:a', 'context:root']),
    )
  })

  it('shrinks by a little more than a third at each level, gaps and padding taken', () => {
    const placements = layoutCanvas(system, { expanded: new Set(['a']), context: false }, canvas)
    const a3 = placements.find(
      (placement) => placement.kind === 'tile' && placement.tile.id === 'a3',
    )
    expect(a3?.hex.radius).toBeLessThan(canvas.radius / 9)
    expect(a3?.hex.radius).toBeGreaterThan(canvas.radius / 15)
  })

  it('gives every placement a key of its own, the same across views', () => {
    const open = layoutCanvas(system, { expanded: new Set(['a']), context: true }, canvas)
    const keys = open.map((placement) => placement.key)
    expect(new Set(keys).size).toBe(keys.length)
    const closed = layoutCanvas(system, { expanded: new Set(), context: false }, canvas)
    const key = (placements: typeof open, id: string) =>
      placements.find((placement) => placement.kind === 'tile' && placement.tile.id === id)?.key
    // a is a Child in one view and the hub of its own Frame in the other.
    expect(key(open, 'a')).toBe(key(closed, 'a'))
    expect(key(open, 'b')).toBe(key(closed, 'b'))
  })

  it('keys a Context Tile by its slot, so a Reference to a Child drawn beside it keeps its own key', () => {
    const child = { id: 'a', title: 'A', preview: '' }
    const referencing: TileNode = {
      id: 'root',
      title: 'Root',
      preview: '',
      children: { 1: child },
      context: { 2: child },
    }
    const keys = layoutCanvas(referencing, { expanded: new Set(), context: true }, canvas).map(
      (placement) => placement.key,
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})
