import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { keepsNothing } from '../kept/kept'
import type { Row } from '../rows'
import { type SystemTile, systemOf } from '../system'
import { directions, leafOf, rowDirection } from '../tile'
import { holdsNothing, holdsNothingIfLeaf, isEmptySystem, notLeaf, onlyALeafIn } from './leaves'

// Leaves beside Branches, on rows and Systems made by hand: where a Leaf slot is stored, what holds
// nothing and what a Leaf may hold. Over PGlite, a Tile holds six of each in their own Directions, a
// Leaf holds nothing, and a Tile changes kind only by moving: `../../leaves.test.ts`.

describe('where a Leaf slot is stored', () => {
  it('stores a Leaf past the six Branch slots, and reads its Direction back', () => {
    const stored = directions.map((direction) => rowDirection({ leaf: direction }))
    expect(stored).toEqual([7, 8, 9, 10, 11, 12])
    expect(stored.map(leafOf)).toEqual([...directions])
  })

  it('stores a Branch and a Context slot as they are, and reads neither as a Leaf', () => {
    const slots = [1, 6, -1, -6] as const
    expect(slots.map((slot) => rowDirection(slot))).toEqual([...slots])
    expect([null, 0, 1, 6, -1, -6, 13].map(leafOf)).toEqual(Array(7).fill(undefined))
  })
})

describe('what holds nothing, on Systems made by hand', () => {
  const tile = (id: string): SystemTile => ({
    _tag: 'Tile',
    id,
    title: id,
    preview: '',
    body: '',
    branches: {},
    leaves: {},
    context: {},
  })
  const root = { ...tile('root'), title: '' }

  it('is a Tile with no Branch, no Leaf, no Context Tile nor Reference, broken or not', () => {
    expect(holdsNothing(tile('a'))).toBe(true)
    const held: ReadonlyArray<Partial<SystemTile>> = [
      { branches: { 1: tile('b') } },
      { leaves: { 2: tile('l') } },
      { context: { [-1]: tile('why') } },
      { context: { [-2]: { _tag: 'Reference', tile: tile('b') } } },
      { context: { [-3]: { _tag: 'BrokenReference', target: 'gone' } } },
    ]
    for (const below of held) expect(holdsNothing({ ...tile('a'), ...below })).toBe(false)
  })

  it('is an empty System: its Root untitled, without Preview nor Body, holding nothing', () => {
    expect(isEmptySystem(root)).toBe(true)
    expect(isEmptySystem({ ...root, title: 'Ulysse' })).toBe(false)
    // An import would replace a Preview or a Body written before the Root's name.
    expect(isEmptySystem({ ...root, preview: 'Me' })).toBe(false)
    expect(isEmptySystem({ ...root, body: '# Me' })).toBe(false)
    expect(isEmptySystem({ ...root, branches: { 1: tile('a') } })).toBe(false)
    expect(isEmptySystem({ ...root, leaves: { 2: tile('l') } })).toBe(false)
    expect(isEmptySystem({ ...root, context: { [-1]: tile('why') } })).toBe(false)
  })
})

describe('what a Leaf may hold, on rows made by hand', () => {
  const row = (id: string, parentId: string | null, direction: number | null): Row => ({
    id,
    parentId,
    direction,
    title: id,
    preview: '',
    body: '',
    target: null,
    ...keepsNothing,
  })
  // A Root with a Leaf in Direction 1, a bare Branch in Direction 1 and a Branch holding a Child.
  const rows = [
    row('root', null, null),
    row('leaf', 'root', 7),
    row('bare', 'root', 1),
    row('full', 'root', 2),
    row('inside', 'full', -3),
  ]
  const refusal = { _tag: 'LeafHoldsNothing', kind: 'Conflict' }

  it.effect('puts nothing under a Leaf, and lets anything under a Branch', () =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(notLeaf(row('leaf', 'root', 7)))).toMatchObject(refusal)
      expect(yield* notLeaf(row('bare', 'root', 1))).toMatchObject({ id: 'bare' })
    }),
  )

  it.effect('takes into a Leaf slot only a Tile with nothing below it', () =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(holdsNothingIfLeaf(rows, 'full', 9))).toMatchObject(refusal)
      for (const [id, direction] of [
        ['bare', 9],
        ['full', 3],
        ['full', -1],
      ] as const) {
        yield* holdsNothingIfLeaf(rows, id, direction)
      }
    }),
  )
  it.effect('refuses a Leaf slot exactly to a Tile a System read says holds something', () =>
    Effect.gen(function* () {
      // A Branch holding a Branch, a Leaf, a Context Tile, a Reference; one holding nothing.
      const held = [
        row('root', null, null),
        row('bare', 'root', 1),
        row('a', 'root', 2),
        row('a1', 'a', 1),
        row('b', 'root', 3),
        row('b1', 'b', 8),
        row('c', 'root', 4),
        row('c1', 'c', -1),
        row('d', 'root', 5),
        { ...row('d1', 'd', -2), target: 'bare' },
      ]
      const read = systemOf(held)
      for (const [id, direction] of [
        ['bare', 1],
        ['a', 2],
        ['b', 3],
        ['c', 4],
        ['d', 5],
      ] as const) {
        const tile = read?.branches[direction]
        if (tile?.id !== id) throw new Error(`No ${id} in Direction ${String(direction)}`)
        const taken = yield* Effect.exit(holdsNothingIfLeaf(held, id, 7))
        expect(taken._tag === 'Success', id).toBe(holdsNothing(tile))
      }
    }),
  )
})

describe('what an import lands in a Leaf slot', () => {
  it.effect('takes one file alone there, and a Tile with anything below it elsewhere only', () =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(onlyALeafIn({ leaf: 2 }, { _tag: 'Tile' }))).toMatchObject({
        _tag: 'LeafHoldsNothing',
      })
      yield* onlyALeafIn({ leaf: 2 }, { _tag: 'Leaf' })
      for (const slot of [2, -2] as const) {
        yield* onlyALeafIn(slot, { _tag: 'Tile' })
        yield* onlyALeafIn(slot, { _tag: 'Leaf' })
      }
    }),
  )
})
