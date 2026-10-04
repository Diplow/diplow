import { describe, expect, it } from 'vitest'

import { layoutView, type FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import type { Direction, Frame, Member, Rings } from '../../2-claude-mod/hooks/shape/node.ts'
import { focusable, focusedHex, focusToward, stepFocus } from './focus.ts'

const tile = (path: string) => ({ path, title: path, preview: '' })
const ring = (members: Partial<Record<Direction, Member>>) => ({
  overflowing: false as const,
  members,
})
const children = (members: Partial<Record<Direction, Member>>) => ({
  ...ring(members),
  clashes: [],
})
const frameOf = (path: string, rings: Rings<Member>): Frame => ({ tile: tile(path), rings })

/**
 * A center with Children around it (a Branch, opened into its own Children, and a Leaf) and
 * Context inside it.
 */
const branch = frameOf('1-a', {
  children: children({ 3: { kind: 'leaf', tile: tile('1-a/x.md') } }),
})
const frame = frameOf('', {
  children: children({
    1: { kind: 'branch', tile: tile('1-a') },
    2: { kind: 'leaf', tile: tile('2-b.md') },
  }),
  context: ring({ 1: { kind: 'context', tile: tile('.c') } }),
})
const view: FrameView = {
  frame,
  frameKind: 'children',
  inner: 'context',
  expanded: { 1: { frame: branch, frameKind: 'children' } },
}
const hexes = focusable(layoutView(view))

describe('focusable', () => {
  it('lists every hex holding a Tile in drawing order, the center first, an opened one once', () => {
    expect(hexes.map(({ tile }) => tile.path)).toEqual(['', '.c', '1-a', '1-a/x.md', '2-b.md'])
    expect(hexes.every((hex) => hex.opened !== true)).toBe(true)
  })
})

describe('focusedHex', () => {
  it('finds the focused hex, and the center when the focus is unset or gone', () => {
    expect(focusedHex('2-b.md', hexes)?.tile.path).toBe('2-b.md')
    expect(focusedHex(undefined, hexes)?.kind).toBe('center')
    expect(focusedHex('gone', hexes)?.kind).toBe('center')
  })
})

describe('stepFocus', () => {
  it('moves forward and back in drawing order, going round', () => {
    expect(stepFocus(undefined, hexes, 1)).toBe('.c')
    expect(stepFocus('1-a', hexes, 1)).toBe('1-a/x.md')
    expect(stepFocus('2-b.md', hexes, 1)).toBe('')
    expect(stepFocus('', hexes, -1)).toBe('2-b.md')
  })
})

describe('focusToward', () => {
  it('jumps from the center to the ring around it', () => {
    expect(focusToward(undefined, view, hexes, 2)).toBe('2-b.md')
    expect(focusToward('', view, hexes, 1)).toBe('1-a')
  })

  it('jumps within the ring of the focused hex, an opened Branch among its neighbors', () => {
    expect(focusToward('2-b.md', view, hexes, 1)).toBe('1-a')
    expect(focusToward('1-a', view, hexes, 2)).toBe('2-b.md')
    expect(focusToward('.c', view, hexes, 1)).toBe('.c')
    expect(focusToward('1-a/x.md', view, hexes, 3)).toBe('1-a/x.md')
  })

  it('goes nowhere toward a direction that holds no Tile', () => {
    expect(focusToward('2-b.md', view, hexes, 5)).toBeUndefined()
    expect(focusToward('1-a/x.md', view, hexes, 1)).toBeUndefined()
  })

  it('jumps from a peeled center to the ring inside it', () => {
    const peeled = { frame, inner: 'context' as const }
    expect(focusToward(undefined, peeled, focusable(layoutView(peeled)), 1)).toBe('.c')
  })
})
