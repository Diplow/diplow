import { describe, expect, it } from 'vitest'

import type {
  Direction,
  Frame,
  FrameKind,
  Member,
  Rings,
} from '../../2-claude-mod/hooks/shape/node.ts'
import {
  branchesToOpen,
  centerExpansion,
  closeBranch,
  collapse,
  defaultExpansions,
  expandCenter,
  innerKinds,
  around,
  beside,
  openBranch,
  outerBranches,
  outerKinds,
  recenter,
  sameExpansions,
  shownExpansions,
  shownKind,
  viewOf,
  type CenterExpansion,
  type Expansions,
} from './expansions.ts'

/** What a folder of six Branches and Leaves or fewer offers, and one of more. */
const fitting: FrameKind[] = ['children', 'context']
const crowded: FrameKind[] = ['branches', 'leaves', 'context']

const open = (center: CenterExpansion, branches: Expansions['branches'] = {}): Expansions => ({
  ...center,
  branches,
})

describe('centerExpansion', () => {
  it('allows the four pairs a view shows, and nothing else', () => {
    const allowed = outerKinds.flatMap((outer) =>
      innerKinds.flatMap((inner) =>
        centerExpansion(outer, inner) === undefined ? [] : [`${outer}+${inner}`],
      ),
    )
    expect(allowed).toEqual([
      'children+context',
      'branches+leaves',
      'branches+context',
      'leaves+context',
    ])
  })

  it('allows the inner ring alone, and neither ring, but not the outer ring alone', () => {
    expect(centerExpansion(null, 'leaves')).toEqual({ outer: null, inner: 'leaves' })
    expect(centerExpansion(null, null)).toEqual({ outer: null, inner: null })
    for (const outer of outerKinds) expect(centerExpansion(outer, null)).toBeUndefined()
  })
})

describe('the defaults', () => {
  it('open a new file with Children around and Context inside, or Branches past six', () => {
    expect(shownExpansions(defaultExpansions, fitting)).toEqual(
      open({ outer: 'children', inner: 'context' }),
    )
    expect(shownExpansions(defaultExpansions, crowded)).toEqual(
      open({ outer: 'branches', inner: 'context' }),
    )
  })
})

describe('shownExpansions', () => {
  it('shows Children in place of Branches or Leaves when they fit together', () => {
    const shown = shownExpansions(open({ outer: 'branches', inner: 'leaves' }), fitting)
    expect(shown).toEqual(open({ outer: 'children', inner: 'context' }))
    expect(shownExpansions(open({ outer: 'leaves', inner: 'context' }), fitting)).toEqual(
      open({ outer: 'children', inner: 'context' }),
    )
  })

  it('shows Context inside a peeled center whose folder offers no Leaves ring', () => {
    expect(shownExpansions(open({ outer: null, inner: 'leaves' }), fitting)).toEqual(
      open({ outer: null, inner: 'context' }),
    )
    expect(shownExpansions(open({ outer: null, inner: null }), fitting)).toEqual(
      open({ outer: null, inner: null }),
    )
  })

  it('keeps what the folder offers as it is, the Branches opened included', () => {
    const wanted = open({ outer: 'leaves', inner: 'context' }, { 2: 'children' })
    expect(shownExpansions(wanted, crowded)).toEqual(wanted)
  })
})

describe('shownKind', () => {
  it('opens a Branch into the kind asked for, or the one its folder offers in its place', () => {
    expect(shownKind('context', fitting)).toBe('context')
    expect(shownKind('leaves', fitting)).toBe('children')
    expect(shownKind('children', crowded)).toBe('branches')
  })
})

describe('sameExpansions', () => {
  it('compares what the file would hold, whatever the order of the Branches', () => {
    const one = open({ outer: 'branches', inner: 'leaves' }, { 1: 'leaves', 4: 'context' })
    const other = open({ outer: 'branches', inner: 'leaves' }, { 4: 'context', 1: 'leaves' })
    expect(sameExpansions(one, other)).toBe(true)
    expect(sameExpansions(one, { ...one, branches: { 1: 'leaves' } })).toBe(false)
    expect(sameExpansions(one, open({ outer: 'branches', inner: 'context' }))).toBe(false)
  })
})

describe('collapse', () => {
  it('peels the outer ring, then the inner one, and closes the opened Branches', () => {
    const full = open({ outer: 'branches', inner: 'leaves' }, { 3: 'context' })
    const peeled = collapse(full)
    expect(peeled).toEqual(open({ outer: null, inner: 'leaves' }))
    const collapsed = collapse(peeled)
    expect(collapsed).toEqual(open({ outer: null, inner: null }))
    expect(collapse(collapsed)).toEqual(collapsed)
  })
})

describe('expandCenter', () => {
  const collapsed = open({ outer: null, inner: null })

  it('opens the inner ring of a collapsed center, and no outer ring alone', () => {
    expect(expandCenter(collapsed, 'context', crowded)).toEqual(
      open({ outer: null, inner: 'context' }),
    )
    expect(expandCenter(collapsed, 'leaves', crowded)).toEqual(
      open({ outer: null, inner: 'leaves' }),
    )
    for (const kind of ['branches', 'children'] as const) {
      expect(expandCenter(collapsed, kind, [...fitting, ...crowded])).toBeUndefined()
    }
  })

  it('opens the outer ring around a peeled center, Leaves around Context included', () => {
    const peeled = open({ outer: null, inner: 'context' })
    expect(expandCenter(peeled, 'children', fitting)).toEqual(
      open({ outer: 'children', inner: 'context' }),
    )
    expect(expandCenter(peeled, 'branches', crowded)).toEqual(
      open({ outer: 'branches', inner: 'context' }),
    )
    expect(expandCenter(peeled, 'leaves', crowded)).toEqual(
      open({ outer: 'leaves', inner: 'context' }),
    )
  })

  it('switches the inner ring of a peeled center when the kind sits only inside', () => {
    const leaves = open({ outer: null, inner: 'leaves' })
    expect(expandCenter(leaves, 'context', crowded)).toEqual(
      open({ outer: null, inner: 'context' }),
    )
    expect(expandCenter(leaves, 'branches', crowded)).toEqual(
      open({ outer: 'branches', inner: 'leaves' }),
    )
  })

  it('puts Leaves inside Branches, keeping the opened Branches', () => {
    const center = open({ outer: 'branches', inner: 'context' }, { 2: 'leaves' })
    expect(expandCenter(center, 'leaves', crowded)).toEqual(
      open({ outer: 'branches', inner: 'leaves' }, { 2: 'leaves' }),
    )
    expect(expandCenter(open({ outer: 'branches', inner: 'leaves' }), 'context', crowded)).toEqual(
      open({ outer: 'branches', inner: 'context' }),
    )
  })

  it('switches the outer ring of an open center, closing the Branches opened in it', () => {
    const leaves = open({ outer: 'leaves', inner: 'context' })
    expect(expandCenter(leaves, 'branches', crowded)).toEqual(
      open({ outer: 'branches', inner: 'context' }),
    )
  })

  it('does nothing for a kind already shown, or one the folder lacks', () => {
    const center = open({ outer: 'children', inner: 'context' })
    for (const kind of ['children', 'context', 'branches', 'leaves'] as const) {
      expect(expandCenter(center, kind, fitting)).toBeUndefined()
    }
    expect(expandCenter(open({ outer: 'branches', inner: 'leaves' }), 'leaves', crowded)).toBe(
      undefined,
    )
  })
})

describe('openBranch and closeBranch', () => {
  it('open a Branch into a kind and close it, leaving the others as they are', () => {
    const center = open({ outer: 'branches', inner: 'context' }, { 1: 'leaves' })
    const opened = openBranch(center, 2, 'context')
    expect(opened.branches).toEqual({ 1: 'leaves', 2: 'context' })
    expect(openBranch(opened, 2, 'children').branches).toEqual({ 1: 'leaves', 2: 'children' })
    expect(closeBranch(opened, 1).branches).toEqual({ 2: 'context' })
  })

  it('open nothing around a peeled center', () => {
    const peeled = open({ outer: null, inner: 'context' })
    expect(openBranch(peeled, 1, 'leaves')).toBe(peeled)
  })
})

describe('around and beside', () => {
  it('open Branches around Leaves, and Children or Branches around Context', () => {
    expect(around('leaves', fitting)).toEqual({ outer: 'branches', inner: 'leaves' })
    expect(around('context', fitting)).toEqual({ outer: 'children', inner: 'context' })
    expect(around('context', crowded)).toEqual({ outer: 'branches', inner: 'context' })
  })

  it('put Context inside every outer ring', () => {
    for (const outer of outerKinds) expect(beside(outer)).toEqual({ outer, inner: 'context' })
  })
})

describe('recenter', () => {
  it("closes the old center's Branches and keeps both rings", () => {
    const opened = open({ outer: 'branches', inner: 'leaves' }, { 1: 'leaves', 4: 'context' })
    expect(recenter(opened)).toEqual(open({ outer: 'branches', inner: 'leaves' }))
  })
})

const tile = (path: string) => ({ path, title: path, preview: '' })
const ring = (members: Partial<Record<Direction, Member>>) => ({
  overflowing: false as const,
  members,
})
const frameOf = (path: string, rings: Rings<Member>): Frame => ({ tile: tile(path), rings })

describe('outerBranches, branchesToOpen and viewOf', () => {
  const frame = frameOf('', {
    children: {
      ...ring({
        1: { kind: 'branch', tile: tile('1-a') },
        2: { kind: 'leaf', tile: tile('2-b.md') },
      }),
      clashes: [],
    },
    context: ring({}),
  })

  it('lists the Branches of the outer ring, and none around a peeled center', () => {
    const shown = open({ outer: 'children', inner: 'context' })
    expect(outerBranches(frame, shown)).toEqual([{ direction: 1, path: '1-a' }])
    expect(outerBranches(frame, open({ outer: null, inner: 'context' }))).toEqual([])
  })

  it('opens only the Branches of the outer ring that the expansions name', () => {
    const shown = open({ outer: 'children', inner: 'context' }, { 1: 'leaves', 2: 'context' })
    expect(branchesToOpen(frame, shown)).toEqual([{ direction: 1, path: '1-a' }])
    expect(branchesToOpen(frame, open({ outer: null, inner: 'context' }, { 1: 'leaves' }))).toEqual(
      [],
    )
  })

  it('lays out the center with both rings and each opened Branch in a kind its folder offers', () => {
    const branch = frameOf('1-a', { children: { ...ring({}), clashes: [] }, context: ring({}) })
    const shown = open({ outer: 'children', inner: 'context' }, { 1: 'leaves' })
    expect(viewOf(frame, shown, { 1: branch })).toEqual({
      frame,
      frameKind: 'children',
      inner: 'context',
      expanded: { 1: { frame: branch, frameKind: 'children' } },
    })
  })

  it('lays out a peeled center as its inner ring alone, and a collapsed one as its Tile', () => {
    expect(viewOf(frame, open({ outer: null, inner: 'context' }), {})).toEqual({
      frame,
      inner: 'context',
    })
    expect(viewOf(frame, open({ outer: null, inner: null }), {})).toEqual({ frame })
  })
})
