import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import { type PlacedTile, type Slot, type System, tileAt } from '../../entities'
import {
  added,
  type Batched,
  CreateReference,
  CreateTile,
  DeleteTile,
  EditTile,
  fold,
  MoveTile,
  type Operation,
  summariesIn,
  whole,
} from '..'

// A batch folded over a System, on Systems made by hand, no database: each Operation decided on what
// the ones before it made, a create under the id it was given; one that no longer applies left out by
// its place, the rest folded; and one more added on the System a batch makes, refused as `decide`
// refuses it there. That a batch runs all or nothing, and reads show it, is `./batch.test.ts`'s.

const uuid = () => crypto.randomUUID()

const id = { root: uuid(), branch: uuid(), made: uuid(), child: uuid(), link: uuid() }

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

// The Root, at Version 2, holds a Branch in Direction 1, at Version 3.
const system: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Ada', preview: '', body: '', version: 2 },
  tiles: { [id.branch]: placed(id.branch, id.root, 1, 3) },
  owned: true,
  version: 4,
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: '' })

/** An Operation as a batch keeps it, a create with the id it makes. */
const batched = (operation: Operation, made?: string): Batched =>
  made === undefined ? { operation } : { operation, made }

// A Tile created under the Root, then one under it, then the new one edited at the Version its
// create gave it.
const work: ReadonlyArray<Batched> = [
  batched(new CreateTile({ parent: id.root, slot: 2, ...content('Work') }), id.made),
  batched(new CreateTile({ parent: id.made, slot: 1, ...content('Team') }), id.child),
  batched(new EditTile({ id: id.made, version: 1, title: 'Job' })),
]

describe('fold, a batch over a System', () => {
  it('decides each Operation on what the ones before it made, a create under the id it was given', () => {
    const folded = fold(system, work)
    expect(folded.left).toEqual([])
    expect(folded.events.map(({ _tag }) => _tag)).toEqual([
      'TileCreated',
      'TileCreated',
      'TileEdited',
    ])
    expect(tileAt(folded.system, id.made)).toMatchObject({
      title: 'Job',
      parent: id.root,
      version: 2,
    })
    expect(tileAt(folded.system, id.child)).toMatchObject({ title: 'Team', parent: id.made })
    // Each event counts on the System's Version, as a write would.
    expect(folded.system.version).toBe(system.version + 3)
  })

  it('makes the same System each time it folds, nothing of the System it folds over changed', () => {
    expect(fold(system, work)).toEqual(fold(system, work))
    expect(fold(system, [])).toEqual({ system, events: [], left: [] })
  })

  it('leaves out, by its place, an Operation that no longer applies, and folds the rest', () => {
    const stale = [
      batched(new EditTile({ id: id.branch, version: 2, title: 'Old' })),
      batched(new MoveTile({ id: id.branch, version: 3, parent: id.root, slot: 4 })),
      batched(new DeleteTile({ id: uuid(), version: 1 })),
    ]
    const folded = fold(system, stale)
    expect(folded.left.map(({ at, refusal }) => [at, refusal._tag])).toEqual([
      [0, 'TileChanged'],
      [2, 'TileNotFound'],
    ])
    expect(tileAt(folded.system, id.branch)).toMatchObject({ title: id.branch, slot: 4 })
  })

  it('leaves out what stands on an Operation it left out', () => {
    const [create, child] = work
    if (create === undefined || child === undefined) throw new Error('The batch holds two creates')
    const taken = { ...system, tiles: { ...system.tiles, [uuid()]: placed(uuid(), id.root, 2) } }
    const folded = fold(taken, [create, child])
    expect(folded.left.map(({ at, refusal }) => [at, refusal._tag])).toEqual([
      [0, 'DirectionTaken'],
      [1, 'TileNotFound'],
    ])
  })

  it('refuses a create that lost the id of what it makes, a defect', () => {
    expect(() =>
      fold(system, [batched(new CreateTile({ parent: id.root, slot: 2, ...content('Lost') }))]),
    ).toThrow('A batched create lost the id of what it makes')
  })
})

describe('whole, a batch as it runs for good', () => {
  it('folds all of it, or is refused by the first Operation that no longer applies', () => {
    expect(whole(system, work)).toEqual(Result.succeed(fold(system, work)))
    const stale = [
      batched(new EditTile({ id: id.branch, version: 3, title: 'Fine' })),
      batched(new MoveTile({ id: id.branch, version: 3, parent: id.root, slot: 4 })),
      batched(new DeleteTile({ id: uuid(), version: 1 })),
    ]
    const refused = whole(system, stale)
    expect(Result.isFailure(refused) && refused.failure._tag).toBe('TileChanged')
  })
})

describe('added, one more Operation for a batch', () => {
  it('is decided on the System the batch makes: a child under a Tile the batch created', () => {
    const [create] = work
    if (create === undefined) throw new Error('The batch holds a create')
    const first = fold(system, [create])
    const child = new CreateTile({ parent: id.made, slot: { leaf: 3 }, ...content('Note') })
    const next = added(first, child, id.child)
    expect(Result.isSuccess(next)).toBe(true)
    if (Result.isFailure(next)) return
    expect(next.success.batched).toEqual({ operation: child, made: id.child })
    expect(tileAt(next.success.system, id.child)).toMatchObject({ title: 'Note', parent: id.made })
    // Folded again from the System it started from, the batch makes the same System.
    expect(fold(system, [create, next.success.batched]).system).toEqual(next.success.system)
  })

  it('is refused as `decide` refuses it on the System the batch makes', () => {
    const first = fold(system, work)
    const stale = added(first, new EditTile({ id: id.made, version: 1, title: 'Late' }))
    expect(Result.isFailure(stale) && stale.failure._tag).toBe('TileChanged')
    const taken = added(
      first,
      new CreateTile({ parent: id.root, slot: 2, ...content('X') }),
      uuid(),
    )
    expect(Result.isFailure(taken) && taken.failure._tag).toBe('DirectionTaken')
  })

  it('keeps a Reference under the id it was given', () => {
    const link = new CreateReference({
      parent: id.root,
      parentVersion: 2,
      slot: -1,
      target: id.branch,
    })
    const next = added(fold(system, []), link, id.link)
    expect(Result.isSuccess(next) && next.success.system.tiles[id.link]).toMatchObject({
      _tag: 'Reference',
      target: id.branch,
    })
  })
})

describe('summariesIn, what a timeline tells of a batch', () => {
  it('summarizes each event, a Title it does not say read from the System after them', () => {
    const folded = fold(system, work)
    expect(summariesIn(folded.system, folded.events)).toEqual([
      { _tag: 'Change', verb: 'TileCreated', tile: { id: id.made, title: 'Work' } },
      { _tag: 'Change', verb: 'TileCreated', tile: { id: id.child, title: 'Team' } },
      { _tag: 'Change', verb: 'TileEdited', tile: { id: id.made, title: 'Job' } },
    ])
  })
})
