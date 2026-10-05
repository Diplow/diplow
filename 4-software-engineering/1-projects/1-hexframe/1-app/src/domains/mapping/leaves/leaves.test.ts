import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type TileRow, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import * as Mapping from '../mapping'
import { type Direction, directions, system } from '../mapping'
import { leafOf, rowDirection } from '../tile'
import { holdsNothingIfLeaf, notLeaf } from './leaves'

// Leaves beside Branches: first where a Leaf slot is stored and what a Leaf may hold, on rows made by
// hand; then over PGlite, a Tile holds six of each in their own Directions, a Leaf holds nothing, and
// a Tile changes kind only by moving, with nothing below it when it takes a Leaf slot.

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

describe('what a Leaf may hold, on rows made by hand', () => {
  const row = (id: string, parentId: string | null, direction: number | null): TileRow => ({
    id,
    parentId,
    direction,
    title: id,
    preview: '',
    body: '',
    target: null,
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
})

const TestTiles = tilesLayer.pipe(Layer.provideMerge(TestDatabase))

/** A change as the API layer runs it: in the transaction it opens. */
const inTransaction =
  <Args extends ReadonlyArray<unknown>, A, E, R>(
    change: (...args: Args) => Effect.Effect<A, E, R>,
  ) =>
  (...args: Args) =>
    transactional(change(...args))

const createTile = inTransaction(Mapping.createTile)
const editTile = inTransaction(Mapping.editTile)
const moveTile = inTransaction(Mapping.moveTile)
const swapTiles = inTransaction(Mapping.swapTiles)
const deleteTile = inTransaction(Mapping.deleteTile)
const createReference = inTransaction(Mapping.createReference)

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** A Leaf slot in this Direction. */
const leaf = (direction: Direction) => ({ leaf: direction })

/** The Account's System, read once so its Root exists, with a Branch and a Leaf in Direction 1. */
const withBoth = Effect.gen(function* () {
  const accountId = crypto.randomUUID()
  const root = yield* system(accountId)
  const branch = yield* createTile(accountId, { parent: root.id, slot: 1, ...content('Branch') })
  const file = yield* createTile(accountId, { parent: root.id, slot: leaf(1), ...content('Leaf') })
  return { accountId, root, branch, file }
})

/** The refusal a change met. */
const refused = <A, E, R>(change: Effect.Effect<A, E, R>) => Effect.flip(change)

layer(TestTiles)('Leaves beside Branches, over PGlite', (it) => {
  it.effect('holds six Leaves beside six Branches, and refuses a seventh of either', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const root = yield* system(accountId)
      for (const direction of directions) {
        const name = String(direction)
        yield* createTile(accountId, { parent: root.id, slot: direction, ...content(`B${name}`) })
        yield* createTile(accountId, {
          parent: root.id,
          slot: leaf(direction),
          ...content(`L${name}`),
        })
      }
      const seventhBranch = { parent: root.id, slot: 2, ...content('B7') } as const
      const seventhLeaf = { parent: root.id, slot: leaf(4), ...content('L7') }
      for (const seventh of [seventhBranch, seventhLeaf]) {
        expect(yield* refused(createTile(accountId, seventh))).toMatchObject({
          _tag: 'DirectionTaken',
          kind: 'Conflict',
        })
      }
      const { branches, leaves } = yield* system(accountId)
      expect(Object.values(branches).map(({ title }) => title)).toEqual(
        directions.map((direction) => `B${String(direction)}`),
      )
      expect(Object.values(leaves)).toEqual(
        directions.map((direction) => ({
          _tag: 'Tile',
          id: leaves[direction]?.id,
          ...content(`L${String(direction)}`),
        })),
      )
    }),
  )

  it.effect('lets a Leaf and a Branch share a Direction, and reads each in its own place', () =>
    Effect.gen(function* () {
      const { accountId, branch, file } = yield* withBoth
      const found = yield* system(accountId)
      expect(found.branches).toEqual({
        1: { _tag: 'Tile', ...branch, branches: {}, leaves: {}, context: {} },
      })
      expect(found.leaves).toEqual({ 1: { _tag: 'Tile', ...file } })
      const opened = yield* Mapping.openTile(accountId, { fields: ['title'], language: 'en' })
      expect(opened.leaves).toEqual({
        1: { _tag: 'Tile', id: file.id, title: 'Leaf', preview: file.preview },
      })
      const read = yield* Mapping.readTile(accountId, {
        depth: 2,
        fields: ['title'],
        language: 'en',
      })
      expect(read.tile.leaves).toEqual({ 1: { _tag: 'Tile', id: file.id, title: 'Leaf' } })
      expect(read.tile.branches?.[1]).toMatchObject({ branches: {}, leaves: {}, context: {} })
    }),
  )

  it.effect('edits and deletes a Leaf as any Tile', () =>
    Effect.gen(function* () {
      const { accountId, file } = yield* withBoth
      expect(yield* editTile(accountId, file.id, { body: 'Rewritten' })).toEqual({
        ...file,
        body: 'Rewritten',
      })
      yield* deleteTile(accountId, file.id)
      expect((yield* system(accountId)).leaves).toEqual({})
    }),
  )

  it.effect('creates nothing under a Leaf: no Branch, no Leaf, no Context, no Reference', () =>
    Effect.gen(function* () {
      const { accountId, root, file } = yield* withBoth
      for (const slot of [2, leaf(2), -2] as const) {
        expect(
          yield* refused(createTile(accountId, { parent: file.id, slot, ...content('Under') })),
        ).toMatchObject({ _tag: 'LeafHoldsNothing', kind: 'Conflict' })
      }
      const reference = { parent: file.id, slot: -1, target: root.id } as const
      expect(yield* refused(createReference(accountId, reference))).toMatchObject({
        _tag: 'LeafHoldsNothing',
      })
      expect((yield* system(accountId)).leaves[1]).toEqual({ _tag: 'Tile', ...file })
    }),
  )

  it.effect(
    'grows a Leaf into a Branch by a move, and shrinks a bare Branch back the same way',
    () =>
      Effect.gen(function* () {
        const { accountId, root, branch, file } = yield* withBoth
        yield* moveTile(accountId, file.id, { parent: root.id, slot: 3 })
        const grown = yield* createTile(accountId, {
          parent: file.id,
          slot: 1,
          ...content('Below'),
        })
        let found = yield* system(accountId)
        expect(found.leaves).toEqual({})
        expect(found.branches[3]?.branches[1]).toMatchObject({ id: grown.id })

        yield* moveTile(accountId, branch.id, { parent: root.id, slot: leaf(5) })
        found = yield* system(accountId)
        expect(found.leaves).toEqual({ 5: { _tag: 'Tile', ...branch } })
        expect(Object.keys(found.branches)).toEqual(['3'])
      }),
  )

  it.effect('moves no Tile holding anything into a Leaf slot, nor anything under a Leaf', () =>
    Effect.gen(function* () {
      const { accountId, root, branch, file } = yield* withBoth
      const other = yield* createTile(accountId, { parent: root.id, slot: 2, ...content('Other') })
      yield* createTile(accountId, { parent: branch.id, slot: -4, ...content('Why') })
      yield* createReference(accountId, { parent: other.id, slot: -1, target: root.id })
      for (const id of [branch.id, other.id]) {
        expect(
          yield* refused(moveTile(accountId, id, { parent: root.id, slot: leaf(6) })),
        ).toMatchObject({ _tag: 'LeafHoldsNothing', kind: 'Conflict' })
      }
      expect(
        yield* refused(moveTile(accountId, other.id, { parent: file.id, slot: 1 })),
      ).toMatchObject({ _tag: 'LeafHoldsNothing' })
      const found = yield* system(accountId)
      expect(Object.keys(found.branches)).toEqual(['1', '2'])
      expect(Object.keys(found.leaves)).toEqual(['1'])
    }),
  )

  it.effect('swaps a Leaf with a bare Branch, and refuses one with a Branch holding anything', () =>
    Effect.gen(function* () {
      const { accountId, root, branch, file } = yield* withBoth
      const full = yield* createTile(accountId, { parent: root.id, slot: 2, ...content('Full') })
      yield* createTile(accountId, { parent: full.id, slot: 1, ...content('Inside') })
      for (const [a, b] of [
        [file.id, full.id],
        [full.id, file.id],
      ] as const) {
        expect(yield* refused(swapTiles(accountId, a, b))).toMatchObject({
          _tag: 'LeafHoldsNothing',
          kind: 'Conflict',
        })
      }
      yield* swapTiles(accountId, file.id, branch.id)
      const found = yield* system(accountId)
      expect(found.leaves).toEqual({ 1: { _tag: 'Tile', ...branch } })
      expect(found.branches[1]).toMatchObject({ id: file.id, branches: {}, leaves: {} })
      expect(found.branches[2]?.branches[1]).toMatchObject({ title: 'Inside' })
    }),
  )
})
