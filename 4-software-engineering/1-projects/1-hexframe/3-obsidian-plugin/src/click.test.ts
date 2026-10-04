import { describe, expect, it } from 'vitest'

import type { Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import type { MemberKind } from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf } from './click.ts'

const at = { x: 0, y: 0 }
const tile = (path: string) => ({ path, title: path, preview: '' })
const center = (path: string): Placement => ({ kind: 'center', center: at, tile: tile(path) })
const member = (memberKind: MemberKind, path: string): Placement => ({
  kind: 'member',
  memberKind,
  direction: 3,
  center: at,
  tile: tile(path),
})

describe('actionOf', () => {
  it('centers on a Branch and shows its note', () => {
    expect(actionOf(member('branch', '3-games'), false)).toEqual({
      center: '3-games',
      open: { notes: ['3-games/CLAUDE.md', '3-games/-CLAUDE.md'] },
    })
  })

  it('centers on a Context folder and shows its note', () => {
    expect(actionOf(member('context', '4-software-engineering/.claude'), false)).toEqual({
      center: '4-software-engineering/.claude',
      open: {
        notes: [
          '4-software-engineering/.claude/CLAUDE.md',
          '4-software-engineering/.claude/-CLAUDE.md',
        ],
      },
    })
  })

  it("goes up from the center to the folder holding it, and shows that one's note", () => {
    expect(actionOf(center('4-software-engineering/1-projects'), false)).toEqual({
      center: '4-software-engineering',
      open: { notes: ['4-software-engineering/CLAUDE.md', '4-software-engineering/-CLAUDE.md'] },
    })
    expect(actionOf(center('4-software-engineering'), false)).toEqual({
      center: '',
      open: { notes: ['CLAUDE.md', '-CLAUDE.md'] },
    })
  })

  it('shows the root center its own note, with nowhere to go up to', () => {
    expect(actionOf(center(''), false)).toEqual({ open: { notes: ['CLAUDE.md', '-CLAUDE.md'] } })
  })

  it('shows a Markdown Leaf without moving', () => {
    expect(actionOf(member('leaf', 'STACK.md'), false)).toEqual({
      open: { notes: ['STACK.md'] },
    })
    expect(actionOf(member('leaf', '3-games/RULES.MD'), false)).toEqual({
      open: { notes: ['3-games/RULES.MD'] },
    })
  })

  it("opens a Leaf that isn't Markdown in the default app, shift held or not", () => {
    for (const shift of [false, true]) {
      expect(actionOf(member('leaf', '3-games/board.pdf'), shift)).toEqual({
        open: { file: '3-games/board.pdf' },
      })
    }
  })

  it('shows the note of any hex without moving when shift is held', () => {
    expect(actionOf(member('branch', '3-games'), true)).toEqual({
      open: { notes: ['3-games/CLAUDE.md', '3-games/-CLAUDE.md'] },
    })
    expect(actionOf(member('context', '.claude'), true)).toEqual({
      open: { notes: ['.claude/CLAUDE.md', '.claude/-CLAUDE.md'] },
    })
    expect(actionOf(center('3-games'), true)).toEqual({
      open: { notes: ['3-games/CLAUDE.md', '3-games/-CLAUDE.md'] },
    })
    expect(actionOf(member('leaf', 'STACK.md'), true)).toEqual({ open: { notes: ['STACK.md'] } })
  })

  it('does nothing for an empty hex', () => {
    expect(actionOf({ kind: 'empty', direction: 2, center: at }, false)).toBeUndefined()
    expect(actionOf({ kind: 'empty', direction: 2, center: at }, true)).toBeUndefined()
  })
})
