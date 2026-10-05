import { describe, expect, it } from 'vitest'

import type { TileRow, TileRowWith } from '#/repositories/database/tiles/tiles'

import { keepsNothing } from './kept/kept'
import { below, readOf, rowAt, systemOf, tileRow } from './system'

// The pure reading of the tiles repository's rows, on rows made by hand: no database.

const tile = (id: string, parentId: string | null, direction: number | null): TileRow => ({
  id,
  parentId,
  direction,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}`,
  target: null,
  ...keepsNothing,
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
    expect(Object.keys(root?.branches ?? {})).toEqual(['2'])
    expect(root?.branches[2]).toMatchObject({ _tag: 'Tile', ...content('child') })
    expect(root?.branches[2]?.branches[6]).toEqual({
      _tag: 'Tile',
      ...content('grandchild'),
      branches: {},
      leaves: {},
      context: {},
    })
    expect(root?.context).toEqual({
      [-1]: { _tag: 'Tile', ...content('principle'), branches: {}, leaves: {}, context: {} },
    })
  })

  it('resolves a Reference to its Tile, and shows one whose target is no Tile as broken', () => {
    const context = systemOf(rows)?.branches[2]?.context
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

describe('Leaves beside Branches', () => {
  // A Root with a Branch in Direction 2 and a Leaf in the same Direction, stored past the six Branch
  // slots, and a Child under the Branch.
  const both = [tile('root', null, null), tile('branch', 'root', 2), tile('leaf', 'root', 8)]
  const withChild = [...both, tile('below', 'branch', 1)]

  it('reads a Leaf by its Direction, beside the Branch sharing it, with nothing below it', () => {
    const root = systemOf(withChild)
    expect(root?.leaves).toEqual({ 2: { _tag: 'Tile', ...content('leaf') } })
    expect(root?.branches[2]).toMatchObject({ id: 'branch', branches: { 1: { id: 'below' } } })
  })

  it('reads a Leaf to a depth the same way, with only the fields asked', () => {
    const read = both.map(({ id, parentId, direction, target, title }) => ({
      id,
      parentId,
      direction,
      target,
      content: { title },
    }))
    const [root] = read
    expect(root && readOf(root, { rows: read, depth: 1, pointedAt: [] })).toEqual({
      _tag: 'Tile',
      id: 'root',
      title: 'root',
      branches: { 2: { _tag: 'Tile', id: 'branch', title: 'branch' } },
      leaves: { 2: { _tag: 'Tile', id: 'leaf', title: 'leaf' } },
      context: {},
    })
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

/** The rows above as a read from one Tile gives them, with only the Title asked. */
const titled = rows.map(({ id, parentId, direction, target, title }): TileRowWith<'title'> => ({
  id,
  parentId,
  direction,
  target,
  content: { title },
}))

/** The rows of the Tiles the References above point at, as the read gives them. */
const pointedAt = rows.map(
  ({ id, parentId, direction, target, title, preview }): TileRowWith<'title' | 'preview'> => ({
    id,
    parentId,
    direction,
    target,
    content: { title, preview },
  }),
)

const opened = (id: string) => {
  const row = titled.find((candidate) => candidate.id === id)
  if (row === undefined) throw new Error(`No row ${id} in the fixture`)
  return row
}

describe('a Tile read to a depth', () => {
  it('stops at the depth asked, with no slots where it stopped, empty ones above', () => {
    expect(readOf(opened('root'), { rows: titled, depth: 0, pointedAt })).toEqual({
      _tag: 'Tile',
      id: 'root',
      title: 'root',
    })
    const child = readOf(opened('root'), { rows: titled, depth: 1, pointedAt }).branches?.[2]
    expect(child).toEqual({ _tag: 'Tile', id: 'child', title: 'child' })
    const deeper = readOf(opened('root'), { rows: titled, depth: 2, pointedAt })
    expect(deeper.branches?.[2]?.branches).toEqual({
      6: { _tag: 'Tile', id: 'grandchild', title: 'grandchild' },
    })
    expect(deeper.context?.[-1]).toEqual({
      _tag: 'Tile',
      id: 'principle',
      title: 'principle',
      branches: {},
      leaves: {},
      context: {},
    })
  })

  it('gives each Tile only the fields its rows carry', () => {
    const bare = titled.map((row) => ({ ...row, content: {} }))
    const root = bare.find((row) => row.id === 'root')
    expect(root && readOf(root, { rows: bare, depth: 1, pointedAt }).branches?.[2]).toEqual({
      _tag: 'Tile',
      id: 'child',
    })
  })

  it('shows a Reference as its Tile’s id, Title and Preview, and one to no Tile as broken', () => {
    expect(readOf(opened('child'), { rows: titled, depth: 1, pointedAt }).context).toEqual({
      [-1]: { _tag: 'Reference', tile: { id: 'root', title: 'root', preview: 'root, in short.' } },
      [-2]: { _tag: 'BrokenReference', target: 'gone' },
      [-3]: { _tag: 'BrokenReference', target: 'ref-to-root' },
    })
  })
})
