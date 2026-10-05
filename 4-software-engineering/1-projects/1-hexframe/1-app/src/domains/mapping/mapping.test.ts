import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expectTypeOf, it } from 'vitest'

import { type Database, type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import {
  type ContextDirection,
  type Depth,
  type Direction,
  type Field,
  type ReadTile,
  type SystemTile,
  systemOf,
} from './entities'
import * as Mapping from './mapping'
import * as Operations from './operations'

/** The Account's System, read flat, as its tree: what the canvas draws, as the client builds it. */
const systemTree = (accountId: string) => Effect.map(Mapping.system(accountId), systemOf)

const TestTiles = tilesLayer.pipe(Layer.provideMerge(TestDatabase))

/**
 * A change as the API layer runs it: its Operation, made from its fields, in the transaction the
 * layer opens.
 */
const createTile = (accountId: string, fields: Omit<Operations.CreateTile, '_tag'>) =>
  transactional(Mapping.createTile(accountId, new Operations.CreateTile(fields)))
const editTile = (
  accountId: string,
  id: string,
  changes: Omit<Operations.EditTile, '_tag' | 'id'>,
) => transactional(Mapping.editTile(accountId, new Operations.EditTile({ id, ...changes })))
const moveTile = (accountId: string, id: string, to: Omit<Operations.MoveTile, '_tag' | 'id'>) =>
  transactional(Mapping.moveTile(accountId, new Operations.MoveTile({ id, ...to })))
const swapTiles = (accountId: string, a: string, b: string) =>
  transactional(Mapping.swapTiles(accountId, new Operations.SwapTiles({ a, b })))
const deleteTile = (accountId: string, id: string) =>
  transactional(Mapping.deleteTile(accountId, new Operations.DeleteTile({ id })))
const createReference = (accountId: string, fields: Omit<Operations.CreateReference, '_tag'>) =>
  transactional(Mapping.createReference(accountId, new Operations.CreateReference(fields)))
const deleteReference = (accountId: string, fields: Omit<Operations.DeleteReference, '_tag'>) =>
  transactional(Mapping.deleteReference(accountId, new Operations.DeleteReference(fields)))

/** A read of the Account's own System, where the language Help is read in plays no part. */
const readTile = <F extends Field>(
  accountId: string,
  read: Omit<Parameters<typeof Mapping.readTile<F>>[1], 'language'>,
) => Mapping.readTile(accountId, { ...read, language: 'en' })

/** An Account no other test uses, so each test stands on its own. */
const someone = () => crypto.randomUUID()

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

const untitledContent = { title: '', preview: '', body: '' }

/** What a Tile holds with nothing below it: no Branch, no Leaf, no Context. */
const nothingBelow = { branches: {}, leaves: {}, context: {} }

/** The Account's System, read once so its Root exists, and a Child of the Root in Direction 1. */
const withAChild = Effect.gen(function* () {
  const accountId = someone()
  const root = yield* systemTree(accountId)
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
  const branches = Object.entries(tile.branches).map(
    ([slot, child]) => [slot, outline(child)] as const,
  )
  return {
    title: tile.title,
    branches: Object.fromEntries(branches),
    context: Object.fromEntries(context),
  }
}

layer(TestTiles)('a System and its Tiles, over PGlite', (it) => {
  it.effect('adds the Root, untitled, the first time a System is read, and only then', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const [first, second] = yield* Effect.all([systemTree(accountId), systemTree(accountId)], {
        concurrency: 'unbounded',
      })
      expect(first).toEqual({
        _tag: 'Tile',
        id: first.id,
        title: '',
        preview: '',
        body: '',
        ...nothingBelow,
      })
      expect(second.id).toBe(first.id)
      expect((yield* systemTree(accountId)).id).toBe(first.id)
      expect((yield* systemTree(someone())).id).not.toBe(first.id)
    }),
  )

  it.effect(
    'reads the System flat, owned by its Account: each Tile and Reference where it stands',
    () =>
      Effect.gen(function* () {
        const accountId = someone()
        const { root } = yield* Mapping.system(accountId)
        const child = yield* createTile(accountId, {
          parent: root.id,
          slot: 1,
          ...content('Child'),
        })
        const leaf = yield* createTile(accountId, {
          parent: child.id,
          slot: { leaf: 2 },
          ...content('Leaf'),
        })
        yield* createReference(accountId, { parent: child.id, slot: -3, target: root.id })
        const read = yield* Mapping.system(accountId)
        expect(read.owned).toBe(true)
        expect(read.root).toEqual({ _tag: 'Tile', id: root.id, ...untitledContent })
        expect(read.tiles[child.id]).toEqual({ _tag: 'Tile', ...child, parent: root.id, slot: 1 })
        expect(read.tiles[leaf.id]).toEqual({
          _tag: 'Tile',
          ...leaf,
          parent: child.id,
          slot: { leaf: 2 },
        })
        const references = Object.values(read.tiles).filter((held) => held._tag === 'Reference')
        expect(references).toEqual([
          { _tag: 'Reference', id: references[0]?.id, parent: child.id, slot: -3, target: root.id },
        ])
        expect(Object.keys(read.tiles)).toHaveLength(3)
      }),
  )

  it.effect('names the user by the Root’s Title, edited like any Tile’s', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const root = yield* systemTree(accountId)
      yield* editTile(accountId, root.id, { body: 'Written before any name.' })
      const named = yield* editTile(accountId, root.id, { title: '  Ada Lovelace ' })
      expect(named).toEqual({
        id: root.id,
        title: 'Ada Lovelace',
        preview: '',
        body: 'Written before any name.',
      })
      expect((yield* systemTree(accountId)).title).toBe('Ada Lovelace')
      expect(yield* editTile(accountId, root.id, {})).toEqual(named)
    }),
  )

  it.effect('holds six Children, one per Direction, and refuses a seventh', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const root = yield* systemTree(accountId)
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
      const { branches } = yield* systemTree(accountId)
      expect(Object.values(branches).map((child) => child.title)).toEqual(
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
      const found = yield* systemTree(accountId)
      expect(found.id).toBe(root.id)
      expect(found.branches[1]).toMatchObject({ _tag: 'Tile', ...child })
      expect(found.branches[1]?.context[-1]).toMatchObject({ _tag: 'Tile', ...principle })
      expect(outline(found)).toEqual({
        title: '',
        branches: {
          1: {
            title: 'Child',
            branches: {},
            context: {
              [-1]: {
                title: 'Principle',
                branches: { 2: { title: 'Detail', branches: {}, context: {} } },
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
      yield* systemTree(intruder)
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
      expect(outline(yield* systemTree(accountId))).toEqual({
        title: '',
        branches: { 1: { title: 'Child', branches: {}, context: {} } },
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
      expect(outline(yield* systemTree(accountId))).toEqual({
        title: '',
        branches: {
          4: {
            title: 'Sibling',
            branches: {
              2: {
                title: 'Child',
                branches: { 6: { title: 'Grandchild', branches: {}, context: {} } },
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
      const moved = (yield* systemTree(accountId)).branches[4]
      expect(Object.keys(moved?.branches ?? {})).toEqual([])
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
      expect(outline(yield* systemTree(accountId))).toEqual({
        title: '',
        branches: {},
        context: {},
      })
      const gone = yield* editTile(accountId, grandchild.id, { title: 'Still here?' }).pipe(
        Effect.flip,
      )
      expect(gone).toMatchObject({ _tag: 'TileNotFound' })
      const rootDeleted = yield* deleteTile(accountId, root.id).pipe(Effect.flip)
      expect(rootDeleted).toMatchObject({ _tag: 'RootFixed' })
    }),
  )
})

type Slot = Direction | ContextDirection

/** Where each Tile below this one stands, by its Title: its parent's Title and its slot. */
function places(tile: SystemTile): Record<string, string> {
  const held = [...Object.entries(tile.branches), ...Object.entries(tile.context)]
  return Object.fromEntries(
    held.flatMap(([slot, below]) =>
      below._tag === 'Tile'
        ? [[below.title, `${tile.title}/${slot}`], ...Object.entries(places(below))]
        : [],
    ),
  )
}

layer(TestTiles)('swapping Tiles, over PGlite', (it) => {
  /** A Tile of the Account's System, titled `title`, added under `parent` in `slot`. */
  const add = (accountId: string, parent: string, slot: Slot, title: string) =>
    createTile(accountId, { parent, slot, ...content(title) })

  it.effect('trades two Tiles’ places, Children, Context or across, with what lies below', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const other = yield* add(accountId, root.id, 4, 'Other')
      const aside = yield* add(accountId, other.id, -2, 'Aside')
      const principle = yield* add(accountId, root.id, -1, 'P')
      yield* add(accountId, child.id, 6, 'Below')
      yield* createReference(accountId, { parent: root.id, slot: -3, target: child.id })
      yield* swapTiles(accountId, child.id, other.id)
      const swapped = { Other: '/1', Aside: 'Other/-2', Child: '/4', Below: 'Child/6', P: '/-1' }
      expect(places(yield* systemTree(accountId))).toEqual(swapped)
      yield* swapTiles(accountId, child.id, child.id)
      yield* swapTiles(accountId, child.id, aside.id)
      expect(places(yield* systemTree(accountId))).toMatchObject({ Aside: '/4', Child: 'Other/-2' })
      yield* swapTiles(accountId, principle.id, child.id)
      const across = yield* systemTree(accountId)
      expect(places(across)).toEqual({ ...swapped, Aside: '/4', Child: '/-1', P: 'Other/-2' })
      expect(across.context[-3]).toMatchObject({ _tag: 'Reference', tile: { id: child.id } })
    }),
  )

  it.effect('refuses a swap with the Root, along one line, or with a Tile it cannot see', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      const below = yield* add(accountId, child.id, 2, 'Below')
      yield* createReference(accountId, { parent: root.id, slot: -1, target: below.id })
      const rows = yield* Tiles.use((tiles) => tiles.read(accountId, untitledContent))
      const reference = rows.find((row) => row.target !== null)?.id ?? ''
      const elsewhere = yield* withAChild
      const refusals = [
        [swapTiles(accountId, root.id, child.id), 'RootFixed'],
        [swapTiles(accountId, below.id, root.id), 'RootFixed'],
        [swapTiles(accountId, child.id, below.id), 'MovedUnderItself'],
        [swapTiles(accountId, below.id, child.id), 'MovedUnderItself'],
        [swapTiles(accountId, child.id, reference), 'TileNotFound'],
        [swapTiles(accountId, child.id, elsewhere.child.id), 'TileNotFound'],
        [swapTiles(elsewhere.accountId, elsewhere.child.id, child.id), 'TileNotFound'],
      ] as const
      for (const [refused, tag] of refusals) {
        expect(yield* Effect.flip(refused)).toMatchObject({ _tag: tag })
      }
      expect(places(yield* systemTree(accountId))).toEqual({ Child: '/1', Below: 'Child/2' })
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
        const held = yield* systemTree(accountId)
        expect(held.branches[1]?.context[-2]).toEqual({ _tag: 'Reference', tile: shared })
        expect(outline(held)).toEqual({
          title: '',
          branches: {
            1: { title: 'Child', branches: {}, context: { [-2]: '→ Shared' } },
            6: { title: 'Shared', branches: {}, context: {} },
          },
          context: {},
        })
        yield* deleteTile(accountId, shared.id)
        const broken = yield* systemTree(accountId)
        expect(broken.branches[1]?.context[-2]).toEqual({
          _tag: 'BrokenReference',
          target: shared.id,
        })
        expect(outline(broken)).toEqual({
          title: '',
          branches: { 1: { title: 'Child', branches: {}, context: { [-2]: '⚠' } } },
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
        expect(outline(yield* systemTree(accountId))).toEqual({
          title: '',
          branches: { 1: { title: 'Child', branches: {}, context: {} } },
          context: {},
        })
      }),
  )

  it.effect('leaves a Tile where it is when asked to empty its slot of a Reference', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* withAChild
      yield* createReference(accountId, { parent: root.id, slot: -4, target: child.id })
      const { context } = yield* systemTree(accountId)
      expect(context[-4]).toEqual({ _tag: 'Reference', tile: child })
      const beside = yield* createTile(accountId, {
        parent: root.id,
        slot: -5,
        ...content('Beside'),
      })
      yield* deleteReference(accountId, { parent: root.id, slot: -5 })
      expect((yield* systemTree(accountId)).context[-5]).toMatchObject({
        _tag: 'Tile',
        id: beside.id,
      })
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
  const root = yield* systemTree(accountId)
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
  tile.branches === undefined
    ? 0
    : 1 + Math.max(0, ...Object.values(tile.branches).map(generations))

/** The fields a read Tile carries, sorted, its tag and its slots aside. */
const fieldsOf = (tile: object) =>
  Object.keys(tile)
    .filter((key) => !['_tag', 'branches', 'leaves', 'context'].includes(key))
    .sort()

layer(TestTiles)('reading one Tile to a depth, over PGlite', (it) => {
  it.effect('reads the Root when no Tile is named, adding it on the first read', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const read = yield* readTile(accountId, { depth: 1, fields: ['title', 'preview', 'body'] })
      expect(read).toEqual({
        tile: { _tag: 'Tile', id: read.tile.id, ...untitledContent, ...nothingBelow },
        parent: null,
      })
      expect((yield* systemTree(accountId)).id).toBe(read.tile.id)
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
      expect(tile.branches?.[1]?.branches?.[1]?.branches?.[1]).toEqual({
        _tag: 'Tile',
        id: ids[3],
        title: 'Great-grandchild',
      })
      expect(tile.context?.[-1]).toEqual({
        _tag: 'Tile',
        id: principle,
        title: 'Principle',
        ...nothingBelow,
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
        expect(fieldsOf(tile.branches?.[1] ?? {})).toEqual(expected)
        expect(fieldsOf(tile.branches?.[1]?.branches?.[1] ?? {})).toEqual(expected)
      }
      const columns = { opened: ['body' as const], below: ['title' as const] }
      const found = yield* Tiles.use((tiles) =>
        tiles.generationsFrom(accountId, { id: ids[0] ?? '', depth: 2, columns }),
      )
      const rows = [found?.opened, ...(found?.below ?? [])]
      const content = (row: object | undefined) =>
        Object.keys(row ?? {}).filter((key) => ['title', 'preview', 'body'].includes(key))
      expect(rows.map(content)).toEqual(rows.map((_, at) => (at === 0 ? ['body'] : ['title'])))
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
        expect(tile.branches?.[1]?.context?.[-1]).toEqual({
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
        branches: { 1: { _tag: 'Tile', id: ids[3], title: 'Great-grandchild' } },
        leaves: {},
        context: {},
      })
      const child = yield* readTile(accountId, { id: ids[1], depth: 0, fields: [] })
      expect(child.parent).toEqual({ id: ids[0], title: 'Ada' })
    }),
  )

  it.effect('finds no Tile of another System, nor a deleted one, nor a Reference', () =>
    Effect.gen(function* () {
      const { accountId, ids } = yield* fourDeep
      const reference = yield* Tiles.use((tiles) =>
        tiles.read(accountId, { title: '', preview: '', body: '' }),
      ).pipe(Effect.map((rows) => rows.find((row) => row.target !== null)?.id))
      expect(reference).toBeDefined()
      const stranger = someone()
      const refusals = yield* Effect.all(
        [
          readTile(stranger, { id: ids[1], depth: 1, fields: ['title'] }),
          readTile(accountId, { id: 'gone', depth: 1, fields: ['title'] }),
          readTile(accountId, { id: reference ?? '', depth: 1, fields: ['title'] }),
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
    expectTypeOf<Requires<typeof Mapping.swapTiles>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.deleteTile>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.createReference>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.deleteReference>>().toEqualTypeOf<InTransaction | Tiles>()
    expectTypeOf<Requires<typeof Mapping.system>>().toEqualTypeOf<Tiles>()
    expectTypeOf<Requires<typeof readTile>>().toEqualTypeOf<Tiles>()
    expectTypeOf<Requires<typeof createTile>>().toEqualTypeOf<Database | Tiles>()
  })
})
