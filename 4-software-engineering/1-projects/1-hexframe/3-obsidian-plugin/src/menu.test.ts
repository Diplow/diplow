import { describe, expect, it } from 'vitest'

import { layoutView, type FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import type {
  Direction,
  Frame,
  FrameKind,
  Member,
  Rings,
} from '../../2-claude-mod/hooks/shape/node.ts'
import type { Expansions } from './expansions.ts'
import type { TileHex } from './click.ts'
import { focusable } from './focus.ts'
import { items, planOf, type ItemId, type Target } from './menu.ts'

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

const fitting: FrameKind[] = ['children', 'context']

/**
 * A center in `4-se`, Children around it (a Branch opened into its Children, a closed Branch, a
 * Markdown Leaf, a PDF) and Context inside it; the opened Branch holds a Branch of its own.
 */
const opened = frameOf('4-se/1-a', {
  children: children({ 3: { kind: 'branch', tile: tile('4-se/1-a/3-x') } }),
  context: ring({}),
})
const frame = frameOf('4-se', {
  children: children({
    1: { kind: 'branch', tile: tile('4-se/1-a') },
    2: { kind: 'branch', tile: tile('4-se/2-b') },
    3: { kind: 'leaf', tile: tile('4-se/3-c.md') },
    4: { kind: 'leaf', tile: tile('4-se/4-d.pdf') },
  }),
  context: ring({ 1: { kind: 'context', tile: tile('4-se/.e') } }),
})
const shown: Expansions = { outer: 'children', inner: 'context', branches: { 1: 'children' } }
const view: FrameView = {
  frame,
  frameKind: 'children',
  inner: 'context',
  expanded: { 1: { frame: opened, frameKind: 'children' } },
}
const hexes = focusable(layoutView(view))

const hexAt = (path: string): TileHex => {
  const hex = hexes.find(({ tile }) => tile.path === path)
  if (hex === undefined) throw new Error(`no hex holds ${path}`)
  return hex
}

const targetOf = (path: string, changes: Partial<Target> = {}): Target => ({
  hex: hexAt(path),
  view,
  shown,
  offered: fitting,
  branchKinds: { 1: fitting, 2: ['branches', 'leaves', 'context'] },
  ...changes,
})

/** The items the menu lists on the hex holding `path`. */
const listed = (path: string, changes: Partial<Target> = {}): ItemId[] =>
  items.flatMap(({ id }) => (planOf(id, targetOf(path, changes)) === undefined ? [] : [id]))

describe('items', () => {
  it('bind each item to its key, Space written as Obsidian writes it', () => {
    expect(items.map(({ key }) => key)).toEqual(['Enter', ' ', 'H', 'B', 'L', 'C', 'X', 'U', 'O'])
  })
})

describe('the items that apply to a hex', () => {
  it('on the center: preview, expand into what it lacks, collapse and go up', () => {
    expect(listed('4-se')).toEqual(['preview', 'collapse', 'up'])
    const collapsed = { shown: { outer: null, inner: null, branches: {} } }
    expect(listed('4-se', collapsed)).toEqual(['preview', 'expand-as-context', 'up'])
  })

  it('on an opened Branch around the center: center, preview, switch its kind, collapse', () => {
    expect(listed('4-se/1-a')).toEqual(['center-here', 'preview', 'expand-as-context', 'collapse'])
  })

  it('on a closed Branch around the center: the kinds its folder offers', () => {
    expect(listed('4-se/2-b')).toEqual([
      'center-here',
      'preview',
      'expand-as-branches',
      'expand-as-leaves',
      'expand-as-context',
    ])
    expect(listed('4-se/2-b', { branchKinds: {} })).toEqual(['center-here', 'preview'])
  })

  it("on a hex that doesn't open: an opened Branch's own Branch, a Context folder inside", () => {
    expect(listed('4-se/1-a/3-x')).toEqual(['center-here', 'preview'])
    expect(listed('4-se/.e')).toEqual(['center-here', 'preview'])
  })

  it('on a Leaf: preview a note, hand anything else to the default app', () => {
    expect(listed('4-se/3-c.md')).toEqual(['preview'])
    expect(listed('4-se/4-d.pdf')).toEqual(['open-in-default-app'])
  })
})

describe('planOf', () => {
  it('centers as a click does, or previews as a shift-click does', () => {
    expect(planOf('center-here', targetOf('4-se/2-b'))).toEqual({
      click: { center: '4-se/2-b', open: { notes: ['4-se/2-b/CLAUDE.md', '4-se/2-b/-CLAUDE.md'] } },
    })
    expect(planOf('preview', targetOf('4-se/2-b'))).toEqual({
      click: { open: { notes: ['4-se/2-b/CLAUDE.md', '4-se/2-b/-CLAUDE.md'] } },
    })
    expect(planOf('up', targetOf('4-se'))).toEqual({
      click: { center: '', open: { notes: ['CLAUDE.md', '-CLAUDE.md'] } },
    })
    expect(planOf('open-in-default-app', targetOf('4-se/4-d.pdf'))).toEqual({
      click: { open: { file: '4-se/4-d.pdf' } },
    })
  })

  it('opens a Branch around the center into a kind, and collapses it', () => {
    expect(planOf('expand-as-leaves', targetOf('4-se/2-b'))).toEqual({
      expansions: { ...shown, branches: { 1: 'children', 2: 'leaves' } },
    })
    expect(planOf('collapse', targetOf('4-se/1-a'))).toEqual({
      expansions: { ...shown, branches: {} },
    })
  })

  it('peels the center, its outer ring first, and opens it back one ring at a time', () => {
    expect(planOf('collapse', targetOf('4-se'))).toEqual({
      expansions: { outer: null, inner: 'context', branches: {} },
    })
    const peeled = { shown: { outer: null, inner: 'context' as const, branches: {} } }
    expect(planOf('expand-as-children', targetOf('4-se', peeled))).toEqual({
      expansions: { outer: 'children', inner: 'context', branches: {} },
    })
  })

  it('collapses nothing on a Branch the view left closed, whatever the file asks', () => {
    const asked = {
      shown: { ...shown, branches: { 1: 'children' as const, 2: 'leaves' as const } },
    }
    expect(planOf('collapse', targetOf('4-se/2-b', asked))).toBeUndefined()
  })

  it('does nothing where the rules forbid the layout asked for', () => {
    const collapsed = { shown: { outer: null, inner: null, branches: {} } }
    expect(planOf('expand-as-children', targetOf('4-se', collapsed))).toBeUndefined()
    expect(planOf('expand-as-leaves', targetOf('4-se'))).toBeUndefined()
    expect(planOf('collapse', targetOf('4-se/2-b'))).toBeUndefined()
    expect(planOf('up', targetOf('4-se', { hex: { ...hexAt('4-se'), tile: tile('') } }))).toBe(
      undefined,
    )
  })
})
