import { describe, expect, it } from 'vitest'

import type { TileRow } from '#/repositories/database/tiles/tiles'

import { below, rowAt, systemOf, tileRow } from './system'

// The pure reading of the tiles repository's rows, on rows made by hand: no database.

const tile = (id: string, parentId: string | null, direction: number | null): TileRow => ({
  id,
  parentId,
  direction,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}`,
  target: null,
})

const reference = (id: string, parentId: string, direction: number, target: string): TileRow => ({
  ...tile(id, parentId, direction),
  title: '',
  preview: '',
  body: '',
  target,
})

const content = (id: string) => ({ id, title: id, preview: `${id}, in short.`, body: `# ${id}` })

// A Root with a Child in Direction 2, a Tile in its Context slot -1, and, under the Child, a
// Grandchild in Direction 6 and three References: to the Root, to a deleted Tile, to a Reference.
const rows: ReadonlyArray<TileRow> = [
  reference('ref-to-ref', 'child', -3, 'ref-to-root'),
  tile('grandchild', 'child', 6),
  reference('ref-to-root', 'child', -1, 'root'),
  tile('principle', 'root', -1),
  reference('ref-to-gone', 'child', -2, 'gone'),
  tile('child', 'root', 2),
  tile('root', null, null),
]

describe('the System these rows hold', () => {
  it('starts at the Root, whichever row comes first', () => {
    expect(systemOf(rows)).toMatchObject({ _tag: 'Tile', ...content('root') })
  })

  it('places a Child by its Direction and a Context Tile by its slot, each with its own below', () => {
    const root = systemOf(rows)
    expect(Object.keys(root?.children ?? {})).toEqual(['2'])
    expect(root?.children[2]).toMatchObject({ _tag: 'Tile', ...content('child') })
    expect(root?.children[2]?.children[6]).toEqual({
      _tag: 'Tile',
      ...content('grandchild'),
      children: {},
      context: {},
    })
    expect(root?.context).toEqual({
      [-1]: { _tag: 'Tile', ...content('principle'), children: {}, context: {} },
    })
  })

  it('resolves a Reference to its Tile, and shows one whose target is no Tile as broken', () => {
    const context = systemOf(rows)?.children[2]?.context
    expect(context).toEqual({
      [-1]: { _tag: 'Reference', tile: content('root') },
      [-2]: { _tag: 'BrokenReference', target: 'gone' },
      [-3]: { _tag: 'BrokenReference', target: 'ref-to-root' },
    })
  })

  it('is none without a Root', () => {
    expect(systemOf([])).toBeUndefined()
    expect(systemOf([tile('orphan', 'gone', 1)])).toBeUndefined()
  })
})

describe('reading rows by id and by slot', () => {
  it('finds a Tile by its id, never a Reference', () => {
    expect(tileRow(rows, 'child')?.id).toBe('child')
    expect(tileRow(rows, 'ref-to-root')).toBeUndefined()
    expect(tileRow(rows, 'gone')).toBeUndefined()
  })

  it('finds what holds a slot, a Tile or a Reference', () => {
    expect(rowAt(rows, 'root', 2)?.id).toBe('child')
    expect(rowAt(rows, 'child', -1)?.id).toBe('ref-to-root')
    expect(rowAt(rows, 'root', 3)).toBeUndefined()
  })

  it('finds a Tile and everything below it, nothing beside it', () => {
    expect(below(rows, 'child')).toEqual(
      new Set(['child', 'grandchild', 'ref-to-root', 'ref-to-gone', 'ref-to-ref']),
    )
    expect(below(rows, 'principle')).toEqual(new Set(['principle']))
    expect(below(rows, 'root').size).toBe(rows.length)
  })
})
