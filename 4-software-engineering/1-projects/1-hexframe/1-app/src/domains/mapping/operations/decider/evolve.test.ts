import { Result, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { Name, type PlacedTile, type Slot, type System, systemOf } from '../../entities'
import {
  decide,
  evolve,
  type MappingEvent,
  MoveTile,
  ReferenceCreated,
  ReferenceDeleted,
  SwapTiles,
  TileCreated,
  TileDeleted,
  TileEdited,
  TileMoved,
  TilesSwapped,
} from '..'

// A System after each of Mapping's events, on Systems made by hand, no database: each event changes
// what it says and nothing else, and one naming what the System doesn't hold changes nothing. That the
// database ends where `evolve` says is `../../agreement.test.ts`'s.

const placed = (id: string, parent: string, slot: Slot): PlacedTile => ({
  _tag: 'Tile',
  id,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}`,
  parent,
  slot,
})

// The Root holds a Branch in Direction 1, which holds a Child in Direction 2 and, in -1, a Reference
// to the Root; a Leaf in Direction 1; and in -2 a Reference to the Child.
const system: System = {
  root: { _tag: 'Tile', id: 'root', title: 'Ada', preview: '', body: '' },
  tiles: {
    branch: placed('branch', 'root', 1),
    child: placed('child', 'branch', 2),
    leaf: placed('leaf', 'root', { leaf: 1 }),
    up: { _tag: 'Reference', id: 'up', parent: 'branch', slot: -1, target: 'root' },
    across: { _tag: 'Reference', id: 'across', parent: 'root', slot: -2, target: 'child' },
  },
  owned: true,
}

const after = (...events: ReadonlyArray<MappingEvent>) => events.reduce(evolve, system)

describe('evolve, a System after one of its events', () => {
  it('places a created Tile, with what it keeps, and a created Reference', () => {
    const created = after(
      new TileCreated({
        id: 'new',
        parent: 'child',
        slot: { leaf: 4 },
        title: 'New',
        preview: '',
        body: 'Body',
        name: Schema.decodeUnknownSync(Name)('new.md'),
      }),
      new ReferenceCreated({ id: 'link', parent: 'new', slot: -3, target: 'leaf' }),
    )
    expect(created.tiles.new).toEqual({
      _tag: 'Tile',
      id: 'new',
      parent: 'child',
      slot: { leaf: 4 },
      title: 'New',
      preview: '',
      body: 'Body',
      name: 'new.md',
    })
    expect(created.tiles.link).toEqual({
      _tag: 'Reference',
      id: 'link',
      parent: 'new',
      slot: -3,
      target: 'leaf',
    })
    expect(created.root).toBe(system.root)
  })

  it('changes only the fields an edit gives, the Root’s as any Tile’s', () => {
    const edited = after(
      new TileEdited({ id: 'root', title: 'Ada Lovelace' }),
      new TileEdited({ id: 'child', preview: '', body: 'New body' }),
    )
    expect(edited.root).toEqual({ ...system.root, title: 'Ada Lovelace' })
    expect(edited.tiles.child).toEqual({
      ...placed('child', 'branch', 2),
      preview: '',
      body: 'New body',
    })
    expect(edited.tiles.branch).toBe(system.tiles.branch)
  })

  it('moves a Tile, and what stands below it follows, still under it', () => {
    const moved = after(new TileMoved({ id: 'branch', parent: 'root', slot: -5 }))
    expect(moved.tiles.branch).toMatchObject({ parent: 'root', slot: -5 })
    expect(moved.tiles.child).toBe(system.tiles.child)
    expect(systemOf(moved).context[-5]).toMatchObject({
      id: 'branch',
      branches: { 2: { id: 'child' } },
    })
  })

  it('trades two Tiles’ places, each with what stands below it', () => {
    const swapped = after(new TilesSwapped({ a: 'branch', b: 'leaf' }))
    expect(swapped.tiles.branch).toMatchObject({ parent: 'root', slot: { leaf: 1 } })
    expect(swapped.tiles.leaf).toMatchObject({ parent: 'root', slot: 1 })
    expect(swapped.tiles.child).toBe(system.tiles.child)
  })

  it('deletes a Tile with everything below it, and leaves a Reference to them elsewhere broken', () => {
    const deleted = after(new TileDeleted({ id: 'branch' }))
    expect(Object.keys(deleted.tiles).sort()).toEqual(['across', 'leaf'])
    expect(systemOf(deleted).context[-2]).toEqual({ _tag: 'BrokenReference', target: 'child' })
  })

  it('empties a Reference’s slot, its Tile untouched', () => {
    const emptied = after(new ReferenceDeleted({ id: 'across', parent: 'root', slot: -2 }))
    expect(Object.keys(emptied.tiles).sort()).toEqual(['branch', 'child', 'leaf', 'up'])
  })

  it('changes nothing for an event naming what the System doesn’t hold as it says', () => {
    const events = [
      new TileEdited({ id: 'gone', title: 'Gone' }),
      new TileMoved({ id: 'gone', parent: 'root', slot: 3 }),
      new TileMoved({ id: 'root', parent: 'branch', slot: 3 }),
      new TilesSwapped({ a: 'gone', b: 'leaf' }),
      new TileDeleted({ id: 'gone' }),
      new TileDeleted({ id: 'up' }),
      new ReferenceDeleted({ id: 'child', parent: 'branch', slot: -2 }),
    ]
    for (const event of events) expect(evolve(system, event), event._tag).toEqual(system)
  })
})

describe('evolve folded over what decide makes', () => {
  const uuid = () => crypto.randomUUID()
  const [root, a, b, under] = [uuid(), uuid(), uuid(), uuid()]
  const real: System = {
    root: { _tag: 'Tile', id: root, title: '', preview: '', body: '' },
    tiles: { [a]: placed(a, root, 1), [b]: placed(b, root, 2), [under]: placed(under, a, -1) },
    owned: true,
  }

  it('lays the System out as the Operations say, one after the other', () => {
    const operations = [new SwapTiles({ a, b }), new MoveTile({ id: under, parent: b, slot: 6 })]
    const final = operations.reduce(
      (current, operation) => Result.getOrThrow(decide(current, operation)).reduce(evolve, current),
      real,
    )
    const tree = systemOf(final)
    expect(tree.branches[1]?.id).toBe(b)
    expect(tree.branches[2]?.id).toBe(a)
    expect(tree.branches[1]?.branches[6]?.id).toBe(under)
    expect(tree.branches[2]?.context).toEqual({})
  })
})
