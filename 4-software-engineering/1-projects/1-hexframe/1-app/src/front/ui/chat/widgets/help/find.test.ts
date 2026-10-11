import { describe, expect, it } from 'vitest'

import { topicsFor, type HelpTopic } from './find'

const topic = (id: string, title: string, preview: string, body = ''): HelpTopic => ({
  id,
  title,
  preview,
  body,
})

const help = [
  topic(
    'system',
    'A System',
    'Your System is the whole hierarchy you maintain.',
    'The Root can be edited like any Tile, but never **moved**, swapped nor deleted.',
  ),
  topic(
    'operations',
    'Operations',
    'Create, edit, move, swap, delete.',
    '## Move\n\n**Move** a Tile, with everything below it, to a free slot elsewhere.',
  ),
  topic('moving', 'Moving a tile', 'Where a Tile can go.'),
  topic('context', 'Context', 'What a Tile is, beside what it does.'),
]

describe('topicsFor', () => {
  it('finds nothing for nothing typed', () => {
    expect(topicsFor(help, '  ')).toEqual([])
  })

  it('puts a topic whose title holds it first, then the others in Help’s order', () => {
    expect(topicsFor(help, 'mov').map((found) => found.id)).toEqual([
      'moving',
      'system',
      'operations',
    ])
  })

  it('cuts the first sentence it shows in around it, Markdown’s marks dropped', () => {
    const [found] = topicsFor(help, 'never moved')
    expect(found?.excerpt).toEqual({
      before: 'The Root can be edited like any Tile, but ',
      match: 'never moved',
      after: ', swapped nor deleted.',
    })
  })

  it('reads a preview before a Body', () => {
    const found = topicsFor(help, 'move').find(({ id }) => id === 'operations')
    expect(found?.excerpt.after).toBe(', swap, delete.')
  })

  it('shows the preview whole when it shows in the title alone', () => {
    const [found] = topicsFor(help, 'context')
    expect(found?.excerpt).toEqual({
      before: 'What a Tile is, beside what it does.',
      match: '',
      after: '',
    })
  })

  it('takes case and accents aside', () => {
    expect(
      topicsFor([topic('fr', 'Opérations', 'Créer, déplacer.')], 'DEPLA')[0]?.excerpt.match,
    ).toBe('déplacer'.slice(0, 5))
  })

  it('finds every topic it shows in, however many', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      topic(String(index), `Tile ${String(index)}`, ''),
    )
    expect(topicsFor(many, 'tile')).toHaveLength(9)
  })
})
