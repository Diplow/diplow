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
    const placements = layoutCanvas(system, { expanded: new Set(), showContext: false }, canvas)
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
    const placements = layoutCanvas(
      system,
      { expanded: new Set(['a']), showContext: false },
      canvas,
    )
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
    const placements = layoutCanvas(system, { expanded: new Set(), showContext: true }, canvas)
    const context = placements.filter(
      (placement) => placement.kind !== 'frame' && placement.hex.radius < canvas.radius / 5,
    )
    expect(context.filter((placement) => placement.kind === 'empty')).toHaveLength(5)
    expect(
      context.find((placement) => placement.kind === 'tile' && placement.role === 'context'),
    ).toMatchObject({ tile: { id: 'why' } })
  })

  it('shrinks by a third at each level', () => {
    const placements = layoutCanvas(
      system,
      { expanded: new Set(['a']), showContext: false },
      canvas,
    )
    const a3 = placements.find(
      (placement) => placement.kind === 'tile' && placement.tile.id === 'a3',
    )
    expect(a3?.hex.radius).toBeLessThan(canvas.radius / 9)
    expect(a3?.hex.radius).toBeGreaterThan(canvas.radius / 12)
  })
})
