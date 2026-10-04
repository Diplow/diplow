import { describe, expect, it } from 'vitest'

import type { Frame } from '../../2-claude-mod/hooks/shape/node.ts'
import { fitsIn, listRows, ringNotes, wrap } from './draw.ts'
import type { ListedHex } from './list.ts'

describe('wrap', () => {
  it('fills lines of at most the width, word by word', () => {
    expect(wrap('Who I am and what I aim at', 10, 4)).toEqual(['Who I am', 'and what I', 'aim at'])
  })

  it('cuts the last line it keeps with an ellipsis', () => {
    expect(wrap('Who I am and what I aim at', 10, 2)).toEqual(['Who I am', 'and what…'])
    expect(wrap('one two three', 7, 1)).toEqual(['one tw…'])
  })

  it('cuts a word wider than a line, on a line of its own', () => {
    expect(wrap('hexframe-obsidian-plugin', 10, 2)).toEqual(['hexframe-…'])
    expect(wrap('the hexframe-obsidian-plugin is', 10, 3)).toEqual(['the', 'hexframe-…', 'is'])
  })

  it('gives no line for no words', () => {
    expect(wrap('  ', 10, 2)).toEqual([])
  })
})

describe('ringNotes', () => {
  const tile = { path: '', title: 'diplow', preview: '' }

  it('names the clashes of a Children ring', () => {
    const frame: Frame = {
      tile,
      rings: {
        children: {
          overflowing: false,
          members: {},
          clashes: [{ direction: 3, leaf: '3-games.md', branch: '3-games' }],
        },
      },
    }
    expect(ringNotes({ frame, frameKind: 'children' })).toEqual([
      '3-games.md and 3-games/ share direction 3: the Leaf takes another one.',
    ])
  })

  it('says why an overflowing ring shows as a list, and what fixes it', () => {
    const frame: Frame = {
      tile,
      rings: {
        branches: {
          overflowing: true,
          candidates: [
            { kind: 'branch', name: '1-a' },
            { kind: 'branch', name: '1-b' },
          ],
          overflow: [{ kind: 'branch', name: '1-b' }],
        },
      },
    }
    expect(ringNotes({ frame, frameKind: 'branches' })).toEqual([
      '2 Branches for six directions, so they show as a list: no direction is left for 1-b/. ' +
        'List what this folder leaves out in .hexframe/exclusions.yaml, or renumber, to draw ' +
        'them as hexes.',
    ])
  })

  it('says nothing of a seated ring without clashes', () => {
    const frame: Frame = { tile, rings: { context: { overflowing: false, members: {} } } }
    expect(ringNotes({ frame, frameKind: 'context' })).toEqual([])
    expect(ringNotes({ frame, frameKind: 'children' })).toEqual([])
  })

  const clashing = (title: string): Frame => ({
    tile: { path: title, title, preview: '' },
    rings: {
      children: {
        overflowing: false,
        members: {},
        clashes: [{ direction: 1, leaf: '1-a.md', branch: '1-a' }],
      },
      context: {
        overflowing: true,
        candidates: [
          { kind: 'context', name: '.1-a' },
          { kind: 'context', name: '.1-b' },
        ],
        overflow: [{ kind: 'context', name: '.1-b' }],
      },
    },
  })
  const clash = '1-a.md and 1-a/ share direction 1: the Leaf takes another one.'
  const overflow =
    '2 Context folders for six directions, so they show as a list: no direction is left for .1-b/. ' +
    'List what this folder leaves out in .hexframe/exclusions.yaml, or renumber, to draw them ' +
    'as hexes.'

  it("speaks of the center's inner ring after its outer one", () => {
    expect(
      ringNotes({ frame: clashing('diplow'), frameKind: 'children', inner: 'context' }),
    ).toEqual([clash, overflow])
  })

  it('speaks of the inner ring alone around a peeled center, and of nothing around a collapsed one', () => {
    expect(ringNotes({ frame: clashing('diplow'), inner: 'context' })).toEqual([overflow])
    expect(ringNotes({ frame: clashing('diplow') })).toEqual([])
  })

  it('names the opened Branch whose ring it speaks of', () => {
    const view = {
      frame: { tile, rings: { context: { overflowing: false as const, members: {} } } },
      frameKind: 'context' as const,
      expanded: { 3: { frame: clashing('Games'), frameKind: 'children' as const } },
    }
    expect(ringNotes(view)).toEqual([`Games: ${clash}`])
  })
})

describe('a list inside a hex', () => {
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

  it('holds six names in a hex of the first scale, ten in a collapsed center', () => {
    expect(listRows(1)).toBe(6)
    expect(listRows(2.5)).toBe(10)
  })

  it('fits while its names fit, and opens to fill the view past them', () => {
    expect(fitsIn(hexOf(1, 6))).toBe(true)
    expect(fitsIn(hexOf(1, 7))).toBe(false)
    expect(fitsIn(hexOf(2.5, 7))).toBe(true)
    expect(fitsIn(hexOf(2.5, 14))).toBe(false)
  })

  it('names more than three left without a direction by their count', () => {
    const candidates = ['1-a', '1-b', '1-c', '1-d', '1-e'].map((name) => ({
      kind: 'branch' as const,
      name,
    }))
    const frame: Frame = {
      tile: { path: '', title: 'diplow', preview: '' },
      rings: { branches: { overflowing: true, candidates, overflow: candidates.slice(1) } },
    }
    expect(ringNotes({ frame, frameKind: 'branches' })[0]).toContain(
      'no direction is left for 1-b/, 1-c/, 1-d/ and 1 more.',
    )
  })
})
