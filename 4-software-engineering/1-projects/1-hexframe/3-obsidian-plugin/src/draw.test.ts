import { describe, expect, it } from 'vitest'

import type { Frame } from '../../2-claude-mod/hooks/shape/node.ts'
import { ringNotes } from './draw.ts'

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

describe('ringNotes, past three names', () => {
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
