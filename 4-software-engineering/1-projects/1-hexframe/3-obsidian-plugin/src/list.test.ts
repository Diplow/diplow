import { describe, expect, it } from 'vitest'

import {
  layoutView,
  type CollapsedView,
  type FrameView,
} from '../../2-claude-mod/hooks/shape/layout.ts'
import type { Frame, OverflowingRing, Slot } from '../../2-claude-mod/hooks/shape/node.ts'
import { fullListOf, itemsOf, tooMany, type ListedHex } from './list.ts'

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

describe('fullListOf', () => {
  it("is the center's outer ring when it overflows, with no way back", () => {
    const view: FrameView = { frame: app, frameKind: 'branches', inner: 'context' }
    const full = fullListOf(view, layoutView(view), undefined)
    expect(full?.back).toBe(false)
    expect(full?.holder).toMatchObject({
      kind: 'center',
      tile: { path: '1-app' },
      list: { frameKind: 'branches', ring: branches },
    })
    expect(full?.holder).not.toHaveProperty('opened')
  })

  it('is the list the user opened while its hex holds it, with the way back', () => {
    const view: FrameView = { frame: app, frameKind: 'context', inner: 'leaves' }
    const placements = layoutView(view)
    expect(fullListOf(view, placements, '1-app')).toEqual({
      holder: listedHex('1-app', view),
      back: true,
    })
    expect(fullListOf(view, placements, undefined)).toBeUndefined()
    const seated: FrameView = { frame: app, frameKind: 'context', inner: 'context' }
    expect(fullListOf(seated, layoutView(seated), '1-app')).toBeUndefined()
  })
})
