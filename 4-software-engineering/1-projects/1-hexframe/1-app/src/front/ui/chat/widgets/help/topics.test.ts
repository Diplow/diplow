import { describe, expect, it } from 'vitest'

import {
  around,
  follow,
  placesTo,
  readOnOf,
  topicsFor,
  topicsOf,
  type HelpNode,
  type HelpTopic,
} from './topics'

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

const node = (
  id: string,
  children: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, HelpNode>> = {},
): HelpNode => ({ id, title: id, preview: '', body: '', children })

const tree = node('root', {
  1: node('system'),
  3: node('directions', { 1: node('six') }),
  4: node('context'),
  6: node('keys'),
})

describe('the way around Help', () => {
  it('follows a path of places, stopping at a gap', () => {
    expect(follow(tree, [3, 1]).map(({ id }) => id)).toEqual(['root', 'directions', 'six'])
    expect(follow(tree, [2, 1]).map(({ id }) => id)).toEqual(['root'])
  })

  it('lists every topic, the Root first, then each topic’s six in order', () => {
    expect(topicsOf(tree).map(({ id }) => id)).toEqual([
      'root',
      'system',
      'directions',
      'six',
      'context',
      'keys',
    ])
  })

  it('finds the path to a topic by its id', () => {
    expect(placesTo(tree, 'six')).toEqual([3, 1])
    expect(placesTo(tree, 'root')).toEqual([])
    expect(placesTo(tree, 'nowhere')).toBeUndefined()
  })

  it('goes round a frame clockwise, west to north-west', () => {
    expect(around(6, 1)).toBe(1)
    expect(around(3, 2)).toBe(5)
  })

  it('reads on below a topic, or round its own frame when nothing is below', () => {
    expect(readOnOf(tree, [3]).map(({ id }) => id)).toEqual(['six'])
    expect(readOnOf(tree, [6]).map(({ id }) => id)).toEqual(['system'])
    expect(readOnOf(tree, [4]).map(({ id }) => id)).toEqual(['keys'])
    expect(readOnOf(tree, []).map(({ id }) => id)).toEqual([
      'system',
      'directions',
      'context',
      'keys',
    ])
  })
})
