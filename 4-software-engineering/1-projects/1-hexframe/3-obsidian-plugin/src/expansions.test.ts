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
  collapse,
  defaultExpansions,
  expand,
  innerKinds,
  around,
  beside,
  outerKinds,
  recenter,
  sameExpansions,
  shownExpansions,
  shownKind,
  switchBranch,
  switchInner,
  switchOuter,
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

describe('collapse and expand', () => {
  it('peel the outer ring, then the inner one, and open them back in turn', () => {
    const full = open({ outer: 'branches', inner: 'leaves' }, { 3: 'context' })
    const peeled = collapse(full)
    expect(peeled).toEqual(open({ outer: null, inner: 'leaves' }))
    const collapsed = collapse(peeled)
    expect(collapsed).toEqual(open({ outer: null, inner: null }))
    expect(collapse(collapsed)).toEqual(collapsed)

    const inner = expand(collapsed, crowded)
    expect(inner).toEqual(open({ outer: null, inner: 'context' }))
    expect(expand(inner, crowded)).toEqual(open({ outer: 'branches', inner: 'context' }))
    expect(expand(inner, fitting)).toEqual(open({ outer: 'children', inner: 'context' }))
    expect(expand(peeled, crowded)).toEqual(open({ outer: 'branches', inner: 'leaves' }))
    expect(expand(full, crowded)).toBe(full)
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

describe('switchOuter', () => {
  it('goes round the kinds the folder offers that sit beside the inner ring', () => {
    const beside = open({ outer: 'branches', inner: 'context' })
    expect(switchOuter(beside, crowded)).toEqual(open({ outer: 'leaves', inner: 'context' }))
    expect(switchOuter(open({ outer: 'leaves', inner: 'context' }), crowded)).toEqual(beside)
  })

  it('keeps Branches beside Leaves, and Children in a folder that offers nothing else', () => {
    const leaves = open({ outer: 'branches', inner: 'leaves' })
    expect(switchOuter(leaves, crowded)).toBe(leaves)
    const children = open({ outer: 'children', inner: 'context' })
    expect(switchOuter(children, fitting)).toBe(children)
  })

  it('closes the Branches opened in the ring it switches', () => {
    const opened = open({ outer: 'branches', inner: 'context' }, { 1: 'leaves' })
    expect(switchOuter(opened, crowded).branches).toEqual({})
  })

  it('switches nothing around a peeled center', () => {
    const peeled = open({ outer: null, inner: 'context' })
    expect(switchOuter(peeled, crowded)).toBe(peeled)
  })
})

describe('switchInner', () => {
  it('goes round Leaves and Context beside Branches, keeping the opened Branches', () => {
    const opened = open({ outer: 'branches', inner: 'context' }, { 1: 'leaves' })
    expect(switchInner(opened, crowded)).toEqual(
      open({ outer: 'branches', inner: 'leaves' }, { 1: 'leaves' }),
    )
  })

  it('keeps Context beside Children or Leaves, never the same kind twice', () => {
    for (const outer of ['children', 'leaves'] as const) {
      const center = open({ outer, inner: 'context' })
      expect(switchInner(center, [...fitting, ...crowded])).toEqual(center)
    }
  })

  it('switches the inner ring of a peeled center, and nothing in a collapsed one', () => {
    expect(switchInner(open({ outer: null, inner: 'context' }), crowded)).toEqual(
      open({ outer: null, inner: 'leaves' }),
    )
    const collapsed = open({ outer: null, inner: null })
    expect(switchInner(collapsed, crowded)).toBe(collapsed)
  })
})

describe('switchBranch', () => {
  it('opens a Branch into each kind its folder offers in turn, then closes it', () => {
    let expansions = open({ outer: 'branches', inner: 'context' })
    const seen: (FrameKind | undefined)[] = []
    for (let step = 0; step < 3; step++) {
      expansions = switchBranch(expansions, 4, fitting)
      seen.push(expansions.branches[4])
    }
    expect(seen).toEqual(['children', 'context', undefined])
    expect(expansions.branches).toEqual({})
  })

  it('starts from the kind a Branch shows when its folder lacks the one asked for', () => {
    const expansions = open({ outer: 'branches', inner: 'context' }, { 4: 'leaves' })
    expect(switchBranch(expansions, 4, fitting).branches).toEqual({ 4: 'context' })
  })

  it('opens nothing around a peeled center', () => {
    const peeled = open({ outer: null, inner: 'context' })
    expect(switchBranch(peeled, 1, fitting)).toBe(peeled)
  })

  it('leaves the other Branches as they are', () => {
    const expansions = open({ outer: 'branches', inner: 'context' }, { 1: 'leaves' })
    expect(switchBranch(expansions, 2, crowded).branches).toEqual({ 1: 'leaves', 2: 'branches' })
  })
})

const tile = (path: string) => ({ path, title: path, preview: '' })
const ring = (members: Partial<Record<Direction, Member>>) => ({
  overflowing: false as const,
  members,
})
const frameOf = (path: string, rings: Rings<Member>): Frame => ({ tile: tile(path), rings })

describe('branchesToOpen and viewOf', () => {
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
