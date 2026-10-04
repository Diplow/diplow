import { describe, expect, it } from 'vitest'

import { layoutView, type FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import type { Direction, Frame, Member, Rings } from '../../2-claude-mod/hooks/shape/node.ts'
import { focusable, focusableInList, focusedClickable, focusToward, stepFocus } from './focus.ts'
import { fullListOf } from './list.ts'

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
    expect(hexes.every((hex) => hex.kind === 'item' || hex.opened !== true)).toBe(true)
  })
})

describe('focusedClickable', () => {
  it('finds the focused hex, and the center when the focus is unset or gone', () => {
    expect(focusedClickable('2-b.md', hexes)?.tile.path).toBe('2-b.md')
    expect(focusedClickable(undefined, hexes)?.kind).toBe('center')
    expect(focusedClickable('gone', hexes)?.kind).toBe('center')
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

describe('focusable, with a list', () => {
  const listing = (count: number): FrameView => {
    const candidates = Array.from({ length: count }, (_, index) => ({
      kind: 'leaf' as const,
      name: `${String(index)}.md`,
    }))
    return {
      frame: frameOf('', {
        children: children({ 1: { kind: 'branch', tile: tile('1-a') } }),
        leaves: { overflowing: true, candidates, overflow: candidates.slice(6) },
      }),
      frameKind: 'children',
      inner: 'leaves',
    }
  }
  const paths = (view: FrameView) => focusable(layoutView(view)).map(({ tile }) => tile.path)

  it('lists the names of a list right after its hex, when the drawing fits them in it', () => {
    expect(paths(listing(2))).toEqual(['', '0.md', '1.md', '1-a'])
    expect(paths(listing(6))).toHaveLength(8)
  })

  it('leaves them out past what the hex holds, which shows how many instead', () => {
    expect(paths(listing(7))).toEqual(['', '1-a'])
  })
})

describe('a list filling the view', () => {
  const candidates = ['a.md', 'b.md'].map((name) => ({ kind: 'leaf' as const, name }))
  const inside: FrameView = {
    frame: frameOf('', {
      children: children({ 1: { kind: 'branch', tile: tile('1-a') } }),
      leaves: { overflowing: true, candidates, overflow: [] },
    }),
    frameKind: 'children',
    inner: 'leaves',
  }
  const full = fullListOf(layoutView(inside), { center: '', path: '' }, '')
  if (full === undefined) throw new Error('the list fills no view')
  const listed = focusableInList(full)

  it('lets Tab step through its hex, then its names', () => {
    expect(listed.map(({ tile }) => tile.path)).toEqual(['', 'a.md', 'b.md'])
    expect(stepFocus('', listed, 1)).toBe('a.md')
    expect(stepFocus('b.md', listed, 1)).toBe('')
  })

  it('leaves the focus where it is on a digit naming a hex of the ring it hides', () => {
    expect(focusToward('', inside, listed, 1)).toBeUndefined()
    expect(focusToward('', inside, focusable(layoutView(inside)), 1)).toBe('1-a')
  })
})

describe('focusedClickable, around a Branch list filling the view', () => {
  it('goes back to the first one drawn, the Branch, where no center is drawn', () => {
    const name = { kind: 'item' as const, memberKind: 'leaf' as const, tile: tile('1-a/x.md') }
    const branch = hexes.find(({ tile: { path } }) => path === '1-a')
    if (branch === undefined) throw new Error('no Branch drawn')
    expect(focusedClickable('1-a/gone.md', [branch, name])?.tile.path).toBe('1-a')
  })
})
