import { describe, expect, it } from 'vitest'

import {
  layoutView,
  type CollapsedView,
  type FrameView,
} from '../../2-claude-mod/hooks/shape/layout.ts'
import type { Frame, OverflowingRing, Slot } from '../../2-claude-mod/hooks/shape/node.ts'
import { fitsIn, fullListOf, itemsOf, tooMany, type ListedHex } from './list.ts'

const tile = (path: string) => ({ path, title: path, preview: '' })
const empty = { overflowing: false as const, members: {} }
const overflowing = (candidates: Slot[]): OverflowingRing => ({
  overflowing: true,
  candidates,
  overflow: candidates.slice(6),
})
const leaves = overflowing(
  ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.ts'].map((name) => ({ kind: 'leaf', name })),
)
const branches = overflowing(
  ['1-a', '1-b', 'c', 'd', 'e', 'f', 'g'].map((name) => ({ kind: 'branch', name })),
)
const app: Frame = { tile: tile('1-app'), rings: { branches, leaves, context: empty } }

const listedHex = (path: string, view: FrameView | CollapsedView): ListedHex => {
  const hex = layoutView(view).find(
    (placement): placement is ListedHex =>
      placement.kind !== 'empty' && placement.list !== undefined && placement.tile.path === path,
  )
  if (hex === undefined) throw new Error(`no hex lists ${path}`)
  return hex
}

describe('itemsOf', () => {
  it("names each candidate in its folder, a folder's with a trailing /", () => {
    const view: FrameView = { frame: app, frameKind: 'context', inner: 'leaves' }
    const items = itemsOf(listedHex('1-app', view))
    expect(items).toHaveLength(7)
    expect(items[6]).toEqual({
      kind: 'item',
      memberKind: 'leaf',
      tile: { path: '1-app/g.ts', title: 'g.ts', preview: '' },
    })
    const root: Frame = { tile: tile(''), rings: { branches, context: empty } }
    const atRoot = itemsOf(listedHex('', { frame: root, inner: 'branches' }))
    expect(atRoot[0]?.tile).toEqual({ path: '1-a', title: '1-a/', preview: '' })
  })
})

describe('tooMany', () => {
  it('says how many of which kind', () => {
    expect(tooMany({ frameKind: 'leaves', ring: leaves })).toBe('7 Leaves, too many to draw')
    expect(tooMany({ frameKind: 'context', ring: leaves })).toBe(
      '7 Context folders, too many to draw',
    )
  })
})

describe('fitsIn', () => {
  const hexOf = (radius: number, count: number): ListedHex => {
    const candidates = Array.from({ length: count }, (_, index) => ({
      kind: 'leaf' as const,
      name: `${String(index)}.md`,
    }))
    const ring = { overflowing: true as const, candidates, overflow: candidates.slice(6) }
    const at = { center: { x: 0, y: 0 }, radius, generation: 0 }
    return {
      kind: 'center',
      ...at,
      tile: { path: '', title: '', preview: '' },
      list: { frameKind: 'leaves', ring },
    }
  }

  it('fits while its names fit, and opens to fill the view past them', () => {
    expect(fitsIn(hexOf(1, 6))).toBe(true)
    expect(fitsIn(hexOf(1, 7))).toBe(false)
    expect(fitsIn(hexOf(2.5, 7))).toBe(true)
    expect(fitsIn(hexOf(2.5, 14))).toBe(false)
  })
})

describe('fullListOf', () => {
  it("is the view's own ring when it overflows, not opened from a hex", () => {
    const view: FrameView = { frame: app, frameKind: 'branches', inner: 'context' }
    const opened = { center: '1-app', path: '1-app/src' }
    const full = fullListOf(layoutView(view), opened, '1-app')
    expect(full?.source).toBe('own-ring')
    expect(full?.holder).toMatchObject({
      kind: 'center',
      tile: { path: '1-app' },
      list: { frameKind: 'branches', ring: branches, fillsView: true },
    })
  })

  it('is the list the user opened while the center stays and its hex holds it', () => {
    const view: FrameView = { frame: app, frameKind: 'context', inner: 'leaves' }
    const placements = layoutView(view)
    const opened = { center: '1-app', path: '1-app' }
    expect(fullListOf(placements, opened, '1-app')).toEqual({
      holder: listedHex('1-app', view),
      source: 'opened',
    })
    expect(fullListOf(placements, undefined, '1-app')).toBeUndefined()
    const seated: FrameView = { frame: app, frameKind: 'context', inner: 'context' }
    expect(fullListOf(layoutView(seated), opened, '1-app')).toBeUndefined()
  })

  it('closes once the view centers elsewhere, a hex of the same path included', () => {
    // Centering on an opened Branch whose inner ring overflows gives a center of the same path.
    const view: FrameView = { frame: app, frameKind: 'context', inner: 'leaves' }
    const opened = { center: '4-software-engineering', path: '1-app' }
    expect(fullListOf(layoutView(view), opened, '1-app')).toBeUndefined()
  })
})
