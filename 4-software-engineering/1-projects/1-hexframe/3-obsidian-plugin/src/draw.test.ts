import { describe, expect, it } from 'vitest'

import type { Frame } from '../../2-claude-mod/hooks/shape/node.ts'
import { ringNotes, wrap } from './draw.ts'

describe('wrap', () => {
  it('fills lines of at most the width, word by word', () => {
    expect(wrap('Who I am and what I aim at', 10, 4)).toEqual(['Who I am', 'and what I', 'aim at'])
  })

  it('cuts the last line it keeps with an ellipsis', () => {
    expect(wrap('Who I am and what I aim at', 10, 2)).toEqual(['Who I am', 'and what…'])
    expect(wrap('one two three', 7, 1)).toEqual(['one tw…'])
  })

  it('cuts a word wider than a line', () => {
    expect(wrap('hexframe-obsidian-plugin', 10, 2)).toEqual(['hexframe-…'])
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

  it('says why an overflowing ring draws no hex, and what fixes it', () => {
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
      '2 branches for six directions, so none is drawn: no direction is left for 1-b/. List what ' +
        'this folder leaves out in .hexframe/exclusions.yaml, or renumber, to draw them.',
    ])
  })

  it('says nothing of a seated ring without clashes', () => {
    const frame: Frame = { tile, rings: { context: { overflowing: false, members: {} } } }
    expect(ringNotes({ frame, frameKind: 'context' })).toEqual([])
    expect(ringNotes({ frame, frameKind: 'children' })).toEqual([])
  })
})
