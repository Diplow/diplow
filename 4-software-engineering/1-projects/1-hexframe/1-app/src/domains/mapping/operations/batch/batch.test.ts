import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { fields, foundIn, readOf, tileAt } from '../../entities'
import * as Mapping from '../../mapping'
import {
  type Batched,
  CreateReference,
  CreateTile,
  DeleteTile,
  EditTile,
  fold,
  type Operation,
} from '..'

// A batch over the Account's System, over PGlite: Operations drafted into it, decided on the System it
// makes and written nowhere, the Tiles it creates under the ids they were given; reads and files
// showing it over the System, a read of the System held whole agreeing with the database's; and the
// batch run for good, all of it or nothing, refused whole once a Tile it names changed since. The fold
// itself is `./fold.test.ts`'s.

/** Every event the service published since a test last emptied it, in order. */
const heard: Array<DomainEvent> = []

const Heard = Layer.succeed(Bus)({ publish: (event) => Effect.sync(() => void heard.push(event)) })

const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Heard)

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Drafts Operations one after the other into a batch, as an agent drafting them would, and answers the batch. */
const drafted = (
  accountId: string,
  ...made: ReadonlyArray<(batch: ReadonlyArray<Batched>) => Operation>
) =>
  Effect.gen(function* () {
    const batch: Array<Batched> = []
    const tiles = []
    for (const operation of made) {
      const draft = yield* Mapping.draft(accountId, batch, operation(batch))
      batch.push(draft.batched)
      tiles.push(draft.tile)
    }
    return { batch, tiles }
  })

/** The id a batched create makes. */
const madeAt = (batch: ReadonlyArray<Batched>, at: number) => {
  const made = batch[at]?.made
  if (made === undefined) throw new Error(`No create at ${String(at)}`)
  return made
}

layer(TestTiles)('a batch over the System', (it) => {
  it.effect('drafts a create, then a child under it, writing nothing, and reads show both', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const before = yield* Mapping.system(accountId)
      const root = before.root.id
      heard.length = 0
      const { batch, tiles } = yield* drafted(
        accountId,
        () => new CreateTile({ parent: root, slot: 1, ...content('Work') }),
        (so) => new CreateTile({ parent: madeAt(so, 0), slot: 2, ...content('Team') }),
      )
      const [work, team] = tiles
      expect(work).toMatchObject({ id: madeAt(batch, 0), title: 'Work', version: 1 })
      expect(team).toMatchObject({ id: madeAt(batch, 1), title: 'Team', version: 1 })
      expect(yield* Mapping.system(accountId)).toEqual(before)
      expect(heard).toEqual([])

      const opened = yield* Mapping.openTile(accountId, {
        fields: ['title'],
        language: 'en',
        over: batch,
      })
      expect(opened.branches[1]).toMatchObject({ id: madeAt(batch, 0), title: 'Work' })
      const mapped = yield* Mapping.readTile(accountId, {
        id: madeAt(batch, 0),
        depth: 1,
        fields: ['title'],
        language: 'en',
        over: batch,
      })
      expect(mapped.parent).toEqual({ id: root, title: '' })
      expect(mapped.tile.branches?.[2]).toMatchObject({ title: 'Team', version: 1 })
      // Without the batch, the System as it stands: neither is there.
      const plain = yield* Mapping.openTile(accountId, { fields: ['title'], language: 'en' })
      expect(plain.branches).toEqual({})
    }),
  )

  it.effect('refuses a draft as `decide` refuses it on the System the batch makes', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const root = (yield* Mapping.system(accountId)).root.id
      const { batch } = yield* drafted(
        accountId,
        () => new CreateTile({ parent: root, slot: 1, ...content('Work') }),
      )
      const taken = new CreateTile({ parent: root, slot: 1, ...content('Again') })
      const refused = yield* Effect.flip(Mapping.draft(accountId, batch, taken))
      expect(refused._tag).toBe('DirectionTaken')
      const stale = new EditTile({ id: madeAt(batch, 0), version: 2, title: 'Job' })
      expect((yield* Effect.flip(Mapping.draft(accountId, batch, stale)))._tag).toBe('TileChanged')
    }),
  )

  it.effect('reads a Tile the batch deleted as gone, and writes the files it makes', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const root = (yield* Mapping.system(accountId)).root.id
      const { batch } = yield* drafted(
        accountId,
        () => new CreateTile({ parent: root, slot: 3, ...content('Games') }),
        (so) => new CreateTile({ parent: madeAt(so, 0), slot: { leaf: 1 }, ...content('Chess') }),
        () => new CreateTile({ parent: root, slot: 4, ...content('Gone') }),
        (so) => new DeleteTile({ id: madeAt(so, 2), version: 1 }),
      )
      const gone = Mapping.readTile(accountId, {
        id: madeAt(batch, 2),
        depth: 0,
        fields: ['title'],
        language: 'en',
        over: batch,
      })
      expect((yield* Effect.flip(gone))._tag).toBe('TileNotFound')
      const link = (id: string) => `https://hexframe.test/?center=${id}`
      const { files, places } = yield* Mapping.systemFiles(accountId, link, batch)
      const chess = places.get(madeAt(batch, 1))
      expect(chess?.file).toBe('3-games/1-chess.md')
      expect(files.map(({ path }) => path)).toContain('3-games/1-chess.md')
      expect(places.has(madeAt(batch, 2))).toBe(false)
      expect((yield* Mapping.systemFiles(accountId, link)).places.has(madeAt(batch, 0))).toBe(false)
    }),
  )

  it.effect('runs the batch whole: every event written and published, as the fold made them', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const before = yield* Mapping.system(accountId)
      const root = before.root
      const { batch } = yield* drafted(
        accountId,
        () => new CreateTile({ parent: root.id, slot: 1, ...content('Work') }),
        (so) => new CreateTile({ parent: madeAt(so, 0), slot: 2, ...content('Team') }),
        () => new EditTile({ id: root.id, version: root.version, title: 'Ada' }),
        (so) =>
          new CreateReference({
            parent: root.id,
            parentVersion: root.version + 1,
            slot: -1,
            target: madeAt(so, 1),
          }),
      )
      const folded = fold(before, batch)
      heard.length = 0
      yield* transactional(Mapping.runBatch(accountId, batch))
      const after = yield* Mapping.system(accountId)
      expect(after).toEqual(folded.system)
      expect(heard).toEqual(folded.events)
      expect(tileAt(after, madeAt(batch, 1))).toMatchObject({ title: 'Team', version: 1 })
      expect(after.version).toBe(before.version + 4)
    }),
  )

  it.effect('refuses the whole batch once a Tile it names changed since, writing nothing', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      const root = (yield* Mapping.system(accountId)).root
      const { batch } = yield* drafted(
        accountId,
        () => new CreateTile({ parent: root.id, slot: 1, ...content('Work') }),
        () => new EditTile({ id: root.id, version: root.version, title: 'Ada' }),
      )
      const edit = new EditTile({ id: root.id, version: root.version, title: 'Grace' })
      yield* transactional(Mapping.editTile(accountId, edit))
      const before = yield* Mapping.system(accountId)
      heard.length = 0
      const refused = yield* Effect.flip(transactional(Mapping.runBatch(accountId, batch)))
      expect(refused._tag).toBe('TileChanged')
      expect(yield* Mapping.system(accountId)).toEqual(before)
      expect(heard).toEqual([])
    }),
  )
})

layer(TestTiles)('a System held whole', (it) => {
  it.effect(
    'reads a System held whole as the database reads it, at every depth, from any Tile',
    () =>
      Effect.gen(function* () {
        const accountId = crypto.randomUUID()
        const root = (yield* Mapping.system(accountId)).root.id
        const create = (parent: string, slot: CreateTile['slot'], title: string) =>
          Effect.map(
            transactional(
              Mapping.createTile(accountId, new CreateTile({ parent, slot, ...content(title) })),
            ),
            ({ id }) => id,
          )
        const work = yield* create(root, 1, 'Work')
        const team = yield* create(work, 2, 'Team')
        yield* create(team, { leaf: 3 }, 'Notes')
        yield* create(root, -1, 'Values')
        const gone = yield* create(root, 4, 'Gone')
        const version = (id: string) =>
          Effect.map(Mapping.system(accountId), (held) => tileAt(held, id)?.version ?? 1)
        const refer = (slot: -2 | -3, target: string) =>
          Effect.flatMap(version(root), (parentVersion) =>
            transactional(
              Mapping.createReference(
                accountId,
                new CreateReference({ parent: root, parentVersion, slot, target }),
              ),
            ),
          )
        yield* refer(-2, team)
        yield* refer(-3, gone)
        yield* transactional(
          Mapping.deleteTile(accountId, new DeleteTile({ id: gone, version: 1 })),
        )
        const held = yield* Mapping.system(accountId)
        for (const id of [undefined, work, team]) {
          for (const depth of [0, 1, 2, 3] as const) {
            const read = yield* Mapping.readTile(accountId, { id, depth, fields, language: 'en' })
            const found = foundIn(held, { id, depth, fields: { opened: fields, below: fields } })
            if (found === undefined) throw new Error('The System held whole has no such Tile')
            expect(
              readOf(found.opened, { rows: found.rows, depth, pointedAt: found.pointedAt }),
            ).toEqual(read.tile)
            expect(found.parent).toEqual(read.parent)
          }
        }
      }),
  )
})
