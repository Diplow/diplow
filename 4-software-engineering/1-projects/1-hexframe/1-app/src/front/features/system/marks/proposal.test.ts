import { describe, expect, it } from 'vitest'

import type { PlacedTile, Slot, System } from '#/domains/mapping/entities'
import {
  type Batched,
  CreateTile,
  DeleteTile,
  EditTile,
  MoveTile,
  type Operation,
  SwapTiles,
} from '#/domains/mapping/operations'

import { proposedOf } from './proposal'

// What an open Proposal would do, on a System made by hand: a create a ghost where it would stand, an
// edit, a move and a deletion of a Tile already there, a ghost the Proposal then moves, renames or
// deletes, the weightier change winning on one Tile, a write that no longer applies drawing nothing,
// and a swap, which the proposal drew nothing for.

const uuid = () => crypto.randomUUID()

const id = { root: uuid(), work: uuid(), notes: uuid(), made: uuid(), child: uuid() }

const placed = (tileId: string, parent: string, slot: Slot, version = 1): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title: tileId,
  preview: '',
  body: '',
  version,
  parent,
  slot,
})

// The Root holds Work, a Branch in Direction 1, and Notes, a Leaf in Direction 2.
const system: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Ada', preview: '', body: '', version: 1 },
  tiles: {
    [id.work]: placed(id.work, id.root, 1),
    [id.notes]: placed(id.notes, id.root, { leaf: 2 }),
  },
  version: 3,
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: '' })

/** An Operation as a batch keeps it, a create with the id it makes. */
const batched = (operation: Operation, made?: string): Batched =>
  made === undefined ? { operation } : { operation, made }

const created = (parent: string, slot: Slot, title: string, made: string) =>
  batched(new CreateTile({ parent, slot, ...content(title) }), made)

describe('proposedOf, what an open Proposal would do', () => {
  it('stands a create as a ghost where it would go, with its Title and Preview', () => {
    const proposed = proposedOf(system, [created(id.root, 3, 'Tooling', id.made)])
    expect([...proposed.ghosts]).toEqual([
      [id.made, { parent: id.root, slot: 3, title: 'Tooling', preview: 'Tooling, in short.' }],
    ])
    expect(proposed.changes.size).toBe(0)
  })

  it('marks an edit, a move with where it lands, and a deletion of Tiles already there', () => {
    const proposed = proposedOf(system, [
      batched(new EditTile({ id: id.work, version: 1, title: 'Job' })),
      batched(new MoveTile({ id: id.notes, version: 1, parent: id.work, slot: { leaf: 4 } })),
    ])
    expect(Object.fromEntries(proposed.changes)).toEqual({ [id.work]: 'edit', [id.notes]: 'move' })
    expect(Object.fromEntries(proposed.moves)).toEqual({
      [id.notes]: { parent: id.work, slot: { leaf: 4 } },
    })
    const deleted = proposedOf(system, [batched(new DeleteTile({ id: id.notes, version: 1 }))])
    expect(Object.fromEntries(deleted.changes)).toEqual({ [id.notes]: 'delete' })
  })

  it('keeps the weightier change on one Tile: a deletion over a move, a move over an edit', () => {
    const proposed = proposedOf(system, [
      batched(new MoveTile({ id: id.work, version: 1, parent: id.root, slot: 5 })),
      batched(new EditTile({ id: id.work, version: 2, title: 'Job' })),
    ])
    expect(proposed.changes.get(id.work)).toBe('move')
    const gone = proposedOf(system, [
      batched(new MoveTile({ id: id.work, version: 1, parent: id.root, slot: 5 })),
      batched(new DeleteTile({ id: id.work, version: 2 })),
    ])
    expect(gone.changes.get(id.work)).toBe('delete')
    expect(gone.moves.size).toBe(0)
  })

  it('follows a ghost the Proposal moves, renames, then deletes, never marking it a change', () => {
    const made = created(id.root, 3, 'Tooling', id.made)
    const moved = proposedOf(system, [
      made,
      batched(new MoveTile({ id: id.made, version: 1, parent: id.work, slot: 2 })),
      batched(new EditTile({ id: id.made, version: 2, title: 'Tools' })),
    ])
    expect(moved.ghosts.get(id.made)).toMatchObject({ parent: id.work, slot: 2, title: 'Tools' })
    expect(moved.changes.size).toBe(0)
    const deleted = proposedOf(system, [made, batched(new DeleteTile({ id: id.made, version: 1 }))])
    expect(deleted.ghosts.size).toBe(0)
    expect(deleted.changes.size).toBe(0)
  })

  it('draws nothing of a write that no longer applies, as accepting it would refuse it', () => {
    // Work changed since the Proposal read it: its Version moved past 1.
    const changed: System = {
      ...system,
      tiles: { ...system.tiles, [id.work]: placed(id.work, id.root, 1, 2) },
    }
    const proposed = proposedOf(changed, [
      batched(new EditTile({ id: id.work, version: 1, title: 'Job' })),
      created(id.root, 1, 'Taken', id.child),
    ])
    expect(proposed.changes.size).toBe(0)
    expect(proposed.ghosts.size).toBe(0)
  })

  it('draws nothing of a swap, which the proposal drew nothing for', () => {
    const proposed = proposedOf(system, [
      batched(new SwapTiles({ a: id.work, aVersion: 1, b: id.notes, bVersion: 1 })),
    ])
    expect(proposed.changes.size).toBe(0)
    expect(proposed.moves.size).toBe(0)
  })
})
