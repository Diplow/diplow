import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expectTypeOf, it } from 'vitest'

import { type Database, type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import * as Mapping from './mapping'
import {
  type Depth,
  type Direction,
  type Field,
  type ReadTile,
  type SystemTile,
  readTile,
  system,
} from './mapping'

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
const deleteTile = inTransaction(Mapping.deleteTile)
const createReference = inTransaction(Mapping.createReference)
const deleteReference = inTransaction(Mapping.deleteReference)

/** An Account no other test uses, so each test stands on its own. */
const someone = () => crypto.randomUUID()

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

const untitledContent = { title: '', preview: '', body: '' }

/** The Account's System, read once so its Root exists, and a Child of the Root in Direction 1. */
const withAChild = Effect.gen(function* () {
  const accountId = someone()
  const root = yield* system(accountId)
  const child = yield* createTile(accountId, { parent: root.id, slot: 1, ...content('Child') })
  return { accountId, root, child }
})

/** What the canvas would show: each Tile's Title with its Children's and its Context's. */
function outline(tile: SystemTile): unknown {
  const context = Object.entries(tile.context).map(
    ([slot, held]) =>
      [
        slot,
        held._tag === 'Tile'
          ? outline(held)
          : held._tag === 'Reference'
            ? `→ ${held.tile.title}`
            : '⚠',
      ] as const,
  )
  const children = Object.entries(tile.children).map(
    ([slot, child]) => [slot, outline(child)] as const,
  )
  return {
    title: tile.title,
    children: Object.fromEntries(children),
    context: Object.fromEntries(context),
  }
}

layer(TestTiles)('a System and its Tiles, over PGlite', (it) => {
  it.effect('adds the Root, untitled, the first time a System is read, and only then', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const [first, second] = yield* Effect.all([system(accountId), system(accountId)], {
        concurrency: 'unbounded',
      })
      expect(first).toEqual({
        _tag: 'Tile',
        id: first.id,
        title: '',
        preview: '',
        body: '',
        children: {},
        context: {},
      })
      expect(second.id).toBe(first.id)
      expect((yield* system(accountId)).id).toBe(first.id)
      expect((yield* system(someone())).id).not.toBe(first.id)
    }),
  )

  it.effect('names the user by the Root’s Title, edited like any Tile’s', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const root = yield* system(accountId)
      yield* editTile(accountId, root.id, { body: 'Written before any name.' })
      const named = yield* editTile(accountId, root.id, { title: '  Ada Lovelace ' })
      expect(named).toEqual({
        id: root.id,
        title: 'Ada Lovelace',
        preview: '',
        body: 'Written before any name.',
      })
      expect((yield* system(accountId)).title).toBe('Ada Lovelace')
      expect(yield* editTile(accountId, root.id, {})).toEqual(named)
    }),
  )

  it.effect('holds six Children, one per Direction, and refuses a seventh', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const root = yield* system(accountId)
      const directions: ReadonlyArray<Direction> = [1, 2, 3, 4, 5, 6]
      for (const slot of directions) {
        yield* createTile(accountId, { parent: root.id, slot, ...content(`Child ${String(slot)}`) })
      }
      const seventh = yield* createTile(accountId, {
        parent: root.id,
        slot: 3,
        ...content('Seventh'),
      }).pipe(Effect.flip)
      expect(seventh).toMatchObject({ _tag: 'DirectionTaken', kind: 'Conflict' })
      const { children } = yield* system(accountId)
      expect(Object.values(children).map((child) => child.title)).toEqual(
        directions.map((slot) => `Child ${String(slot)}`),
      )
    }),
  )

  it.effect('keeps a Tile’s Title, Preview and Body, and a Tile in each Context slot', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const principle = yield* createTile(accountId, {
        parent: child.id,
        slot: -1,
        ...content('Principle'),
      })
      yield* createTile(accountId, { parent: principle.id, slot: 2, ...content('Detail') })
      expect(child).toEqual({ id: child.id, ...content('Child') })
      const found = yield* system(accountId)
      expect(found.id).toBe(root.id)
      expect(found.children[1]).toMatchObject({ _tag: 'Tile', ...child })
      expect(found.children[1]?.context[-1]).toMatchObject({ _tag: 'Tile', ...principle })
      expect(outline(found)).toEqual({
        title: '',
        children: {
          1: {
            title: 'Child',
            children: {},
            context: {
              [-1]: {
                title: 'Principle',
                children: { 2: { title: 'Detail', children: {}, context: {} } },
                context: {},
              },
            },
          },
        },
        context: {},
      })
    }),
  )

  it.effect('refuses an empty Title and a Preview over 350 characters, on their fields', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const place = { parent: root.id, slot: 2 } as const
      const untitled = yield* createTile(accountId, { ...place, ...content('  ') }).pipe(
        Effect.flip,
      )
      const long = { ...content('Long'), preview: '✳'.repeat(351) }
      const tooLong = yield* createTile(accountId, { ...place, ...long }).pipe(Effect.flip)
      const cleared = yield* editTile(accountId, child.id, { title: '' }).pipe(Effect.flip)
      expect(untitled).toMatchObject({ _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] })
      expect(tooLong).toMatchObject({
        _tag: 'PreviewTooLong',
        kind: 'Invalid',
        fields: ['preview'],
      })
      expect(cleared).toMatchObject({ _tag: 'TitleMissing' })
      // A family emoji is five code points and one character: 350 of them fit.
      const family = '👩‍👩‍👧'.repeat(350)
      const fits = yield* createTile(accountId, { ...place, ...long, preview: family })
      expect(fits.preview).toBe(family)
    }),
  )
})

layer(TestTiles)('moving and deleting Tiles, over PGlite', (it) => {
  it.effect('finds no Tile of another Account’s System, and changes none', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const intruder = someone()
      yield* system(intruder)
      const attempts: ReadonlyArray<Effect.Effect<unknown, object, Database | Tiles>> = [
        createTile(intruder, { parent: root.id, slot: 2, ...content('Intruder') }),
        editTile(intruder, child.id, { title: 'Taken over' }),
        moveTile(intruder, child.id, { parent: root.id, slot: 2 }),
        deleteTile(intruder, child.id),
        createReference(intruder, { parent: root.id, slot: -1, target: child.id }),
      ]
      for (const attempt of attempts) {
        expect(yield* Effect.flip(attempt)).toMatchObject({
          _tag: 'TileNotFound',
          kind: 'NotFound',
        })
      }
      expect(outline(yield* system(accountId))).toEqual({
        title: '',
        children: { 1: { title: 'Child', children: {}, context: {} } },
        context: {},
      })
    }),
  )

  it.effect('moves a Tile with everything below it, to another parent or into a Context slot', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const sibling = yield* createTile(accountId, {
        parent: root.id,
        slot: 4,
        ...content('Sibling'),
      })
      yield* createTile(accountId, { parent: child.id, slot: 6, ...content('Grandchild') })
      yield* moveTile(accountId, child.id, { parent: sibling.id, slot: 2 })
      expect(outline(yield* system(accountId))).toEqual({
        title: '',
        children: {
          4: {
            title: 'Sibling',
            children: {
              2: {
                title: 'Child',
                children: { 6: { title: 'Grandchild', children: {}, context: {} } },
                context: {},
              },
            },
            context: {},
          },
        },
        context: {},
      })
      yield* moveTile(accountId, child.id, { parent: sibling.id, slot: -3 })
      yield* moveTile(accountId, child.id, { parent: sibling.id, slot: -3 })
      const moved = (yield* system(accountId)).children[4]
      expect(Object.keys(moved?.children ?? {})).toEqual([])
      expect(moved?.context[-3]).toMatchObject({ title: 'Child' })
    }),
  )

  it.effect('refuses a move into a held slot, below the Tile itself, or of the Root', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const sibling = yield* createTile(accountId, {
        parent: root.id,
        slot: 2,
        ...content('Sibling'),
      })
      const grandchild = yield* createTile(accountId, {
        parent: child.id,
        slot: 1,
        ...content('Grandchild'),
      })
      const taken = yield* moveTile(accountId, sibling.id, { parent: root.id, slot: 1 }).pipe(
        Effect.flip,
      )
      const underItself = yield* moveTile(accountId, child.id, {
        parent: grandchild.id,
        slot: 1,
      }).pipe(Effect.flip)
      const intoItself = yield* moveTile(accountId, child.id, { parent: child.id, slot: 2 }).pipe(
        Effect.flip,
      )
      const rootMoved = yield* moveTile(accountId, root.id, { parent: child.id, slot: 2 }).pipe(
        Effect.flip,
      )
      expect(taken).toMatchObject({ _tag: 'DirectionTaken' })
      expect(underItself).toMatchObject({ _tag: 'MovedUnderItself', kind: 'Conflict' })
      expect(intoItself).toMatchObject({ _tag: 'MovedUnderItself' })
      expect(rootMoved).toMatchObject({ _tag: 'RootFixed', kind: 'Forbidden' })
    }),
  )

  it.effect('deletes a Tile with everything below it, but never the Root', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const grandchild = yield* createTile(accountId, {
        parent: child.id,
        slot: 1,
        ...content('Grandchild'),
      })
      yield* deleteTile(accountId, child.id)
      expect(outline(yield* system(accountId))).toEqual({ title: '', children: {}, context: {} })
      const gone = yield* editTile(accountId, grandchild.id, { title: 'Still here?' }).pipe(
        Effect.flip,
      )
      expect(gone).toMatchObject({ _tag: 'TileNotFound' })
      const rootDeleted = yield* deleteTile(accountId, root.id).pipe(Effect.flip)
      expect(rootDeleted).toMatchObject({ _tag: 'RootFixed' })
    }),
  )
})

layer(TestTiles)('References, over PGlite', (it) => {
  it.effect(
    'holds a Reference in a Context slot, which follows its Tile and breaks when it is deleted',
    () =>
      Effect.gen(function* () {
        const { accountId, root, child } = yield* withAChild
        const shared = yield* createTile(accountId, {
          parent: root.id,
          slot: 5,
          ...content('Shared'),
        })
        yield* createReference(accountId, { parent: child.id, slot: -2, target: shared.id })
        yield* moveTile(accountId, shared.id, { parent: root.id, slot: 6 })
        const held = yield* system(accountId)
        expect(held.children[1]?.context[-2]).toEqual({ _tag: 'Reference', tile: shared })
        expect(outline(held)).toEqual({
          title: '',
          children: {
            1: { title: 'Child', children: {}, context: { [-2]: '→ Shared' } },
            6: { title: 'Shared', children: {}, context: {} },
          },
          context: {},
        })
        yield* deleteTile(accountId, shared.id)
        const broken = yield* system(accountId)
        expect(broken.children[1]?.context[-2]).toEqual({
          _tag: 'BrokenReference',
          target: shared.id,
        })
        expect(outline(broken)).toEqual({
          title: '',
          children: { 1: { title: 'Child', children: {}, context: { [-2]: '⚠' } } },
          context: {},
        })
        const taken = yield* createTile(accountId, {
          parent: child.id,
          slot: -2,
          ...content('There'),
        }).pipe(Effect.flip)
        expect(taken).toMatchObject({ _tag: 'DirectionTaken' })
      }),
  )

  it.effect(
    'refers only to a Tile of the System, and empties a Reference’s slot without its Tile',
    () =>
      Effect.gen(function* () {
        const { accountId, root, child } = yield* withAChild
        const elsewhere = yield* withAChild
        const foreign = yield* createReference(accountId, {
          parent: root.id,
          slot: -1,
          target: elsewhere.child.id,
        }).pipe(Effect.flip)
        expect(foreign).toMatchObject({ _tag: 'TileNotFound' })
        yield* createReference(accountId, { parent: root.id, slot: -1, target: child.id })
        const held = yield* createReference(accountId, {
          parent: root.id,
          slot: -1,
          target: root.id,
        }).pipe(Effect.flip)
        expect(held).toMatchObject({ _tag: 'DirectionTaken' })
        yield* deleteReference(accountId, { parent: root.id, slot: -1 })
        yield* deleteReference(accountId, { parent: root.id, slot: -1 })
        expect(outline(yield* system(accountId))).toEqual({
          title: '',
          children: { 1: { title: 'Child', children: {}, context: {} } },
          context: {},
        })
      }),
  )

  it.effect('leaves a Tile where it is when asked to empty its slot of a Reference', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      yield* createReference(accountId, { parent: root.id, slot: -4, target: child.id })
      const { context } = yield* system(accountId)
      expect(context[-4]).toEqual({ _tag: 'Reference', tile: child })
      const beside = yield* createTile(accountId, {
        parent: root.id,
        slot: -5,
        ...content('Beside'),
      })
      yield* deleteReference(accountId, { parent: root.id, slot: -5 })
      expect((yield* system(accountId)).context[-5]).toMatchObject({ _tag: 'Tile', id: beside.id })
    }),
  )
})

/**
 * A System four generations deep below its named Root, Direction 1 each time, with a Tile in the
 * Root's Context slot -1, a Reference to the Child in its slot -2, and, in the Child's slot -1, a
 * Reference to a deleted Tile.
 */
const fourDeep = Effect.gen(function* () {
  const accountId = someone()
  const root = yield* system(accountId)
  yield* editTile(accountId, root.id, content('Ada'))
  const ids = [root.id]
  for (const title of ['Child', 'Grandchild', 'Great-grandchild', 'Fourth']) {
    const parent = ids.at(-1) ?? root.id
    ids.push((yield* createTile(accountId, { parent, slot: 1, ...content(title) })).id)
  }
  const [, child = root.id] = ids
  const principle = yield* createTile(accountId, {
    parent: root.id,
    slot: -1,
    ...content('Principle'),
  })
  yield* createReference(accountId, { parent: root.id, slot: -2, target: child })
  const gone = yield* createTile(accountId, { parent: root.id, slot: 2, ...content('Gone') })
  yield* createReference(accountId, { parent: child, slot: -1, target: gone.id })
  yield* deleteTile(accountId, gone.id)
  return { accountId, ids, principle: principle.id, gone: gone.id }
})

/** How many generations below a read Tile its read went: 0 where it stopped. */
const generations = <F extends Field>(tile: ReadTile<F>): number =>
  tile.children === undefined
    ? 0
    : 1 + Math.max(0, ...Object.values(tile.children).map(generations))

/** The fields a read Tile carries, sorted, its tag and its slots aside. */
const fieldsOf = (tile: object) =>
  Object.keys(tile)
    .filter((key) => !['_tag', 'children', 'context'].includes(key))
    .sort()

layer(TestTiles)('reading one Tile to a depth, over PGlite', (it) => {
  it.effect('reads the Root when no Tile is named, adding it on the first read', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const read = yield* readTile(accountId, { depth: 1, fields: ['title', 'preview', 'body'] })
      expect(read).toEqual({
        tile: { _tag: 'Tile', id: read.tile.id, ...untitledContent, children: {}, context: {} },
        parent: null,
      })
      expect((yield* system(accountId)).id).toBe(read.tile.id)
      expect((yield* readTile(accountId, { depth: 0, fields: [] })).tile.id).toBe(read.tile.id)
    }),
  )

  it.effect('goes down as many generations as asked, 0 to 3, and no further', () =>
    Effect.gen(function* () {
      const { accountId, ids, principle } = yield* fourDeep
      const depths: ReadonlyArray<Depth> = [0, 1, 2, 3]
      for (const depth of depths) {
        const { tile } = yield* readTile(accountId, { depth, fields: ['title'] })
        expect(generations(tile)).toBe(depth)
        const below = yield* readTile(accountId, { id: ids[1], depth, fields: ['title'] })
        expect(generations(below.tile)).toBe(depth)
      }
      const { tile } = yield* readTile(accountId, { depth: 3, fields: ['title'] })
      expect(tile.children?.[1]?.children?.[1]?.children?.[1]).toEqual({
        _tag: 'Tile',
        id: ids[3],
        title: 'Great-grandchild',
      })
      expect(tile.context?.[-1]).toEqual({
        _tag: 'Tile',
        id: principle,
        title: 'Principle',
        children: {},
        context: {},
      })
    }),
  )

  it.effect('gives each Tile only the fields asked, and reads a Body only when asked', () =>
    Effect.gen(function* () {
      const { accountId, ids } = yield* fourDeep
      const choices: ReadonlyArray<ReadonlyArray<Field>> = [
        [],
        ['title'],
        ['preview'],
        ['body'],
        ['title', 'preview'],
        ['title', 'preview', 'body'],
      ]
      for (const fields of choices) {
        const { tile } = yield* readTile(accountId, { depth: 2, fields })
        const expected = ['id', ...fields].sort()
        expect(fieldsOf(tile)).toEqual(expected)
        expect(fieldsOf(tile.children?.[1] ?? {})).toEqual(expected)
        expect(fieldsOf(tile.children?.[1]?.children?.[1] ?? {})).toEqual(expected)
        const rows = yield* Tiles.use((tiles) =>
          tiles.below(accountId, { id: ids[0] ?? '', depth: 2, columns: fields }),
        )
        expect(rows.map((row) => Object.keys(row.content).sort())).toEqual(
          rows.map(() => [...fields].sort()),
        )
      }
    }),
  )

  it.effect(
    'shows a Reference as its Tile’s id, Title and Preview, and a broken one as broken',
    () =>
      Effect.gen(function* () {
        const { accountId, ids, gone } = yield* fourDeep
        const { tile } = yield* readTile(accountId, { depth: 2, fields: ['body'] })
        expect(tile.context?.[-2]).toEqual({
          _tag: 'Reference',
          tile: { id: ids[1], title: 'Child', preview: 'Child, in short.' },
        })
        expect(tile.children?.[1]?.context?.[-1]).toEqual({
          _tag: 'BrokenReference',
          target: gone,
        })
        const shallow = yield* readTile(accountId, { depth: 0, fields: ['title'] })
        expect(shallow.tile).toEqual({ _tag: 'Tile', id: ids[0], title: 'Ada' })
      }),
  )

  it.effect('opens any Tile of the System, with its parent’s id and Title', () =>
    Effect.gen(function* () {
      const { accountId, ids } = yield* fourDeep
      const read = yield* readTile(accountId, { id: ids[2], depth: 1, fields: ['title'] })
      expect(read.parent).toEqual({ id: ids[1], title: 'Child' })
      expect(read.tile).toEqual({
        _tag: 'Tile',
        id: ids[2],
        title: 'Grandchild',
        children: { 1: { _tag: 'Tile', id: ids[3], title: 'Great-grandchild' } },
        context: {},
      })
      const child = yield* readTile(accountId, { id: ids[1], depth: 0, fields: [] })
      expect(child.parent).toEqual({ id: ids[0], title: 'Ada' })
    }),
  )

  it.effect('finds no Tile of another System, nor a deleted one, nor a Reference', () =>
    Effect.gen(function* () {
      const { accountId, ids } = yield* fourDeep
      const { tile } = yield* readTile(accountId, { depth: 1, fields: [] })
      const reference = yield* Tiles.use((tiles) =>
        tiles.below(accountId, { id: tile.id, depth: 1, columns: [] }),
      ).pipe(Effect.map((rows) => rows.find((row) => row.target !== null)?.id ?? ''))
      const stranger = someone()
      const refusals = yield* Effect.all(
        [
          readTile(stranger, { id: ids[1], depth: 1, fields: ['title'] }),
          readTile(accountId, { id: 'gone', depth: 1, fields: ['title'] }),
          readTile(accountId, { id: reference, depth: 1, fields: ['title'] }),
        ].map(Effect.flip),
      )
      for (const refusal of refusals) {
        expect(refusal).toMatchObject({ _tag: 'TileNotFound', kind: 'NotFound' })
      }
    }),
  )
})

describe('the transaction a change runs in', () => {
  it('is required of every change, and opened by whoever runs it, never by Mapping', () => {
    type Requires<F extends (...args: never[]) => Effect.Effect<unknown, unknown, unknown>> =
      Effect.Services<ReturnType<F>>
    expectTypeOf<Requires<typeof Mapping.createTile>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.editTile>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.moveTile>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.deleteTile>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.createReference>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.deleteReference>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof system>>().toEqualTypeOf<Tiles>()
    expectTypeOf<Requires<typeof readTile>>().toEqualTypeOf<Tiles>()
    expectTypeOf<Requires<typeof createTile>>().toEqualTypeOf<Database | Tiles>()
  })
})
