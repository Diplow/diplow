import { describe, expect, it } from 'vitest'

import type { PlacedTile, System } from '#/domains/mapping/entities'

import {
  editedOf,
  freeFor,
  seatOf,
  refusalOf,
  slotForKind,
  slotOf,
  stillRefused,
  tilesBelow,
  whereIn,
} from './place'

// The tile widget in Mapping's words, over a System made by hand: a slot as the widget's kind and
// place and back, the places Mapping holds nothing in, the slot another kind takes, the Tiles that go
// along with one, an edit's changed fields, and a refusal on the widget's fields, cleared as they
// change.

const words = { title: 'Work', preview: 'What I do', body: '# Work' }

const placed = (id: string, parent: string, slot: PlacedTile['slot']): PlacedTile => ({
  _tag: 'Tile',
  id,
  ...words,
  version: 1,
  parent,
  slot,
})

const system: System = {
  root: { _tag: 'Tile', id: 'root', ...words, version: 1 },
  tiles: {
    a: placed('a', 'root', 1),
    b: placed('b', 'root', 2),
    notes: placed('notes', 'root', { leaf: 1 }),
    why: placed('why', 'root', -3),
    inner: placed('inner', 'a', 4),
    deeper: placed('deeper', 'inner', { leaf: 2 }),
    link: { _tag: 'Reference', id: 'link', parent: 'a', slot: -1, target: 'b' },
  },
  version: 7,
}

describe('a slot as the widget draws it', () => {
  it('reads a Branch, a Leaf and a Context slot as their kind and place, and back', () => {
    const slots = [5, { leaf: 3 }, -6] as const
    expect(slots.map(seatOf)).toEqual([
      { kind: 'branch', place: 5 },
      { kind: 'leaf', place: 3 },
      { kind: 'context', place: 6 },
    ])
    expect(slots.map((slot) => seatOf(slot)).map(({ kind, place }) => slotOf(kind, place))).toEqual(
      slots,
    )
  })

  it('offers the places Mapping holds nothing in, for each kind', () => {
    expect(freeFor(system, 'root', 'branch')).toEqual([3, 4, 5, 6])
    expect(freeFor(system, 'root', 'leaf')).toEqual([2, 3, 4, 5, 6])
    expect(freeFor(system, 'root', 'context')).toEqual([1, 2, 4, 5, 6])
    // A Reference takes its Context slot.
    expect(freeFor(system, 'a', 'context')).toEqual([2, 3, 4, 5, 6])
    // A Leaf holds nothing, and a Tile gone has no place at all.
    expect(freeFor(system, 'notes', 'branch')).toEqual([])
    expect(freeFor(system, 'gone', 'leaf')).toEqual([])
  })

  it('says where a Tile goes under its parent, by its Title', () => {
    expect(whereIn(system, { id: 'root', title: 'Ada' }, { leaf: 4 })).toEqual({
      parent: 'Ada',
      kind: 'leaf',
      place: 4,
      free: [2, 3, 4, 5, 6],
    })
  })
})

describe('another kind picked', () => {
  it('keeps the place when it is free for that kind', () => {
    expect(slotForKind(system, 'root', 3, 'leaf')).toEqual({ leaf: 3 })
    expect(slotForKind(system, 'root', { leaf: 4 }, 'context')).toBe(-4)
  })

  it('takes the first free place when that one is taken', () => {
    expect(slotForKind(system, 'root', { leaf: 2 }, 'branch')).toBe(3)
  })

  it('takes none when that kind has no place left', () => {
    const full: System = {
      ...system,
      tiles: Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((direction) => [
          `c${String(direction)}`,
          placed(`c${String(direction)}`, 'b', { leaf: direction as 1 }),
        ]),
      ),
    }
    expect(slotForKind(full, 'b', 1, 'leaf')).toBeUndefined()
  })
})

describe('what goes along with a Tile', () => {
  it('counts every Tile below it, References aside', () => {
    expect(tilesBelow(system, 'a')).toBe(2)
    expect(tilesBelow(system, 'b')).toBe(0)
    expect(tilesBelow(system, 'root')).toBe(6)
  })
})

describe('an edit', () => {
  it('marks the fields that differ from the Tile it opened on', () => {
    expect(editedOf(words, words)).toEqual([])
    expect(editedOf({ ...words, preview: 'Less', body: '' }, words)).toEqual(['preview', 'body'])
  })
})

describe('a refusal on the widget', () => {
  it("lands on the fields it names, and one on no field is the toast's", () => {
    expect(refusalOf({ fields: { title: 'Name it.', other: 'Ignored' } })).toEqual({
      title: 'Name it.',
    })
    expect(refusalOf({ fields: { other: 'Ignored' } })).toBeUndefined()
    expect(refusalOf({ form: 'Changed meanwhile.' })).toBeUndefined()
    expect(refusalOf(undefined)).toBeUndefined()
  })

  it('clears from each field the user changes, and stays on the others', () => {
    const refused = { title: 'Name it.', preview: 'Too long.' }
    expect(stillRefused(refused, words, { ...words, title: 'Job' })).toEqual({
      preview: 'Too long.',
    })
    expect(stillRefused(refused, words, { ...words, title: 'Job', preview: '' })).toBeUndefined()
    expect(stillRefused(undefined, words, words)).toBeUndefined()
  })
})
