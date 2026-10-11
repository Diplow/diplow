import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import { keepsNothing } from '../kept/kept'
import type { Row } from '../rows'
import { systemFrom, type SystemTile, systemOf, tileAt } from '../system'
import { directions, isContextSlot, isLeafSlot, leafOf, rowDirection, type Slot } from '../tile'
import { holdsNothing, holdsNothingIfLeaf, isEmptySystem, notLeaf, onlyALeafIn } from './leaves'

// Leaves beside Branches, on rows and Systems made by hand: where a Leaf slot is stored, what holds
// nothing and what a Leaf may hold. Over PGlite, a Tile holds six of each in their own Directions, a
// Leaf holds nothing, and a Tile changes kind only by moving: `../../leaves.test.ts`.

/** What a rule refused, `undefined` when it let the change through. */
const refusalOf = <E>(result: Result.Result<unknown, E>) =>
  Result.isFailure(result) ? result.failure : undefined

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

  it('tells a Leaf slot and a Context slot from a Branch’s and from each other', () => {
    const leafFirst: ReadonlyArray<Slot> = [{ leaf: 4 }, 4, -4]
    const contextFirst: ReadonlyArray<Slot> = [-6, 6, { leaf: 6 }]
    expect(leafFirst.map((slot) => isLeafSlot(slot))).toEqual([true, false, false])
    expect(contextFirst.map((slot) => isContextSlot(slot))).toEqual([true, false, false])
  })
})

describe('what holds nothing, on Systems made by hand', () => {
  const tile = (id: string): SystemTile => ({
    _tag: 'Tile',
    id,
    version: 1,
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

describe('what a Leaf may hold, on a System made by hand', () => {
  const row = (id: string, parentId: string | null, direction: number | null): Row => ({
    id,
    parentId,
    direction,
    title: id,
    preview: '',
    body: '',
    version: 1,
    systemVersion: 0,
    target: null,
    ...keepsNothing,
  })
  /** The flat System these rows hold, owned by an Account. */
  const flat = (rows: ReadonlyArray<Row>) => {
    const found = systemFrom(rows, { owned: true })
    if (found === undefined) throw new Error('These rows hold no Root')
    return found
  }
  // A Root with a Leaf in Direction 1, a bare Branch in Direction 1 and a Branch holding a Child.
  const system = flat([
    row('root', null, null),
    row('leaf', 'root', 7),
    row('bare', 'root', 1),
    row('full', 'root', 2),
    row('inside', 'full', -3),
  ])
  const refusal = { _tag: 'LeafHoldsNothing', kind: 'Conflict' }
  const tileOf = (id: string) => {
    const found = tileAt(system, id)
    if (found === undefined) throw new Error(`No Tile ${id}`)
    return found
  }

  it('puts nothing under a Leaf, and lets anything under a Branch or the Root', () => {
    expect(refusalOf(notLeaf(tileOf('leaf')))).toMatchObject(refusal)
    expect(Result.getOrThrow(notLeaf(tileOf('bare')))).toMatchObject({ id: 'bare' })
    expect(Result.isSuccess(notLeaf(tileOf('root')))).toBe(true)
  })

  it('takes into a Leaf slot only a Tile with nothing below it', () => {
    expect(refusalOf(holdsNothingIfLeaf(system, 'full', { leaf: 3 }))).toMatchObject(refusal)
    for (const [id, slot] of [
      ['bare', { leaf: 3 }],
      ['full', 3],
      ['full', -1],
    ] as const) {
      expect(Result.isSuccess(holdsNothingIfLeaf(system, id, slot)), id).toBe(true)
    }
  })

  it('refuses a Leaf slot exactly to a Tile the System’s tree says holds something', () => {
    // A Branch holding a Branch, a Leaf, a Context Tile, a Reference; one holding nothing.
    const held = flat([
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
    ])
    const tree = systemOf(held)
    for (const [id, direction] of [
      ['bare', 1],
      ['a', 2],
      ['b', 3],
      ['c', 4],
      ['d', 5],
    ] as const) {
      const tile = tree.branches[direction]
      if (tile?.id !== id) throw new Error(`No ${id} in Direction ${String(direction)}`)
      const taken = holdsNothingIfLeaf(held, id, { leaf: 1 })
      expect(Result.isSuccess(taken), id).toBe(holdsNothing(tile))
    }
  })
})

describe('what an import lands in a Leaf slot', () => {
  it('takes one file alone there, and a Tile with anything below it elsewhere only', () => {
    expect(refusalOf(onlyALeafIn({ leaf: 2 }, { _tag: 'Tile' }))).toMatchObject({
      _tag: 'LeafHoldsNothing',
    })
    expect(Result.isSuccess(onlyALeafIn({ leaf: 2 }, { _tag: 'Leaf' }))).toBe(true)
    for (const slot of [2, -2] as const) {
      expect(Result.isSuccess(onlyALeafIn(slot, { _tag: 'Tile' }))).toBe(true)
      expect(Result.isSuccess(onlyALeafIn(slot, { _tag: 'Leaf' }))).toBe(true)
    }
  })
})
