import { describe, expect, it } from 'vitest'

import type { Opened } from '#/domains/mapping/mapping'

import { markdownOf } from './markdown'

// A Tile opened, as `/t/<id>.md` writes it, on reads made by hand: discovery order, its Children
// Branches first then Leaves, each in its Directions' order, its Context with a Reference by the Tile
// it points at and a broken one left out, what is empty left out, and labels that never break a link.

const link = (id: string) => `https://hexframe.test/t/${id}.md`

const glimpse = (id: string, title: string, preview = '') => ({
  _tag: 'Tile' as const,
  id,
  version: 1,
  title,
  preview,
})

const opened = (around: Partial<Opened<'title' | 'preview' | 'body'>> = {}) => ({
  tile: {
    _tag: 'Tile' as const,
    id: 'garden',
    version: 3,
    title: 'Garden',
    preview: 'What grows.',
    body: 'Beds and paths.\n',
  },
  parent: null,
  branches: {},
  leaves: {},
  context: {},
  ...around,
})

describe('markdownOf', () => {
  it('writes the Tile, then its Children, Branches before Leaves, then its Context, each linked', () => {
    const markdown = markdownOf(
      opened({
        branches: { 4: glimpse('d', 'Paths'), 1: glimpse('a', 'Beds', 'Where it grows.') },
        leaves: { 2: glimpse('e', 'Notes', 'A list.') },
        context: {
          '-3': { _tag: 'BrokenReference', target: 'gone' },
          '-2': { _tag: 'Reference', tile: { id: 'j', title: 'Journal', preview: 'Days.' } },
          '-1': glimpse('s', 'Soil', 'Clay.'),
        },
      }),
      link,
    )
    expect(markdown).toBe(
      [
        '# Garden',
        'What grows.',
        'Beds and paths.',
        '## Children',
        `- [Beds](${link('a')}): Where it grows.\n- [Paths](${link('d')})\n- [Notes](${link('e')}): A list.`,
        '## Context',
        `- [Soil](${link('s')}): Clay.\n- [Journal](${link('j')}): Days.`,
      ].join('\n\n') + '\n',
    )
    expect(markdown).not.toContain('gone')
  })

  it('leaves out what is empty, and names an untitled Tile so', () => {
    const bare = opened({ tile: { ...opened().tile, title: ' ', preview: '', body: '' } })
    expect(markdownOf(bare, link)).toBe('# Untitled\n')
  })

  it('keeps a label on one line, its brackets escaped, so it never closes the link', () => {
    const markdown = markdownOf(
      opened({ branches: { 1: glimpse('a', 'Beds [north]\nand\\south', 'One\n\ntwo.') } }),
      link,
    )
    expect(markdown).toContain(`- [Beds \\[north\\] and\\\\south](${link('a')}): One two.`)
  })
})
