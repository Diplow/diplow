import { expect, layer } from '@effect/vitest'
import { Effect, Layer, Struct } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { type System, tileAt } from '../../entities'
import * as Mapping from '../../mapping'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  type Undo,
} from '..'

// An undo over the database, over PGlite: a batch run whole answers what undoes it, and the undo puts
// the System back as it stood, a deleted Tile under its id, each event published as an Operation's;
// refused whole once a Tile it touched changed since, nothing written nor published; and Operations
// applied one after the other, as a Turn in apply writes them, keeping one undo of all of them,
// outdated once another writer changed a Tile they touched between two of them. The inverse itself is
// `./inverse.test.ts`'s.

/** Every event the service published since a test last emptied it, in order. */
const heard: Array<DomainEvent> = []

const Heard = Layer.succeed(Bus)({ publish: (event) => Effect.sync(() => void heard.push(event)) })

const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Heard)

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** A System as a reader sees it, its Versions aside: what an undo gives back. */
const said = (held: System) => ({
  root: Struct.omit(held.root, ['version']),
  tiles: Object.fromEntries(
    Object.entries(held.tiles).map(([key, found]): [string, object] => [
      key,
      found._tag === 'Tile' ? Struct.omit(found, ['version']) : found,
    ]),
  ),
})

/** The Version the Account's System holds a Tile at now, as a writer reads it before it writes. */
const versionOf = (accountId: string, id: string) =>
  Effect.map(
    Effect.flatMap(Mapping.ownSystem(accountId), Mapping.system),
    (held) => tileAt(held, id)?.version ?? 1,
  )

/** An Account whose Root holds Work, which holds Team, and a Reference to Team in its Context. */
const seeded = Effect.gen(function* () {
  const accountId = crypto.randomUUID()
  const root = (yield* Mapping.system(yield* Mapping.ownSystem(accountId))).root
  const create = (parent: string, slot: CreateTile['slot'], title: string) =>
    Effect.map(
      transactional(
        Effect.flatMap(Mapping.ownSystem(accountId), (acting) =>
          Mapping.createTile(acting, new CreateTile({ parent, slot, ...content(title) })),
        ),
      ),
      ({ id }) => id,
    )
  const work = yield* create(root.id, 1, 'Work')
  const team = yield* create(work, 2, 'Team')
  const parentVersion = yield* versionOf(accountId, root.id)
  yield* transactional(
    Mapping.createReference(
      yield* Mapping.ownSystem(accountId),
      new CreateReference({ parent: root.id, parentVersion, slot: -1, target: team }),
    ),
  )
  return { accountId, root: root.id, work, team }
})

/** Runs an undo for good, in its own transaction. */
const undone = (accountId: string, undo: Undo) =>
  Effect.flatMap(Mapping.ownSystem(accountId), (acting) =>
    transactional(Mapping.undo(acting, undo)),
  )

layer(TestTiles)('an undo over the System', (it) => {
  it.effect('undoes a batch run whole: the System as it stood, a deleted Tile under its id', () =>
    Effect.gen(function* () {
      const { accountId, root, work, team } = yield* seeded
      const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
      const made = crypto.randomUUID()
      const { undo, changes } = yield* transactional(
        Mapping.runBatch(yield* Mapping.ownSystem(accountId), [
          { operation: new CreateTile({ parent: root, slot: 3, ...content('Plans') }), made },
          { operation: new EditTile({ id: team, version: 1, title: 'Crew' }) },
          { operation: new DeleteTile({ id: work, version: 1 }) },
        ]),
      )
      expect(changes).toBe(3)
      expect(
        tileAt(yield* Mapping.system(yield* Mapping.ownSystem(accountId)), team),
      ).toBeUndefined()
      heard.length = 0
      yield* undone(accountId, undo)
      const back = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
      expect(said(back)).toEqual(said(before))
      expect(heard.map(({ _tag }) => _tag)).toEqual([
        'TileCreated',
        'TileCreated',
        'TileEdited',
        'TileDeleted',
      ])
      // The Reference to Team, which the delete left broken, points at it again.
      expect(Object.values(back.tiles).find((held) => held._tag === 'Reference')).toMatchObject({
        target: team,
      })
      // Each Tile at the Version its rows were written at, as `evolve` counts it.
      expect(tileAt(back, team)?.version).toBe(2)
    }),
  )

  it.effect('refuses the whole undo once a Tile it touched changed since, nothing written', () =>
    Effect.gen(function* () {
      const { accountId, team } = yield* seeded
      const { undo } = yield* transactional(
        Mapping.runBatch(yield* Mapping.ownSystem(accountId), [
          { operation: new EditTile({ id: team, version: 1, title: 'Crew' }) },
        ]),
      )
      const version = yield* versionOf(accountId, team)
      yield* transactional(
        Mapping.editTile(
          yield* Mapping.ownSystem(accountId),
          new EditTile({ id: team, version, body: 'Mine.' }),
        ),
      )
      const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
      heard.length = 0
      const refused = yield* Effect.flip(undone(accountId, undo))
      expect(refused._tag).toBe('BatchOutdated')
      expect(yield* Mapping.system(yield* Mapping.ownSystem(accountId))).toEqual(before)
      expect(heard).toEqual([])
      const outdated = yield* Effect.flip(undone(accountId, { _tag: 'Outdated' }))
      expect(outdated._tag).toBe('BatchOutdated')
    }),
  )

  it.effect(
    'keeps one undo of Operations applied one after the other, as a Turn in apply writes',
    () =>
      Effect.gen(function* () {
        const { accountId, root, work, team } = yield* seeded
        const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
        const create = new CreateTile({ parent: root, slot: 4, ...content('Plans') })
        const first = yield* transactional(
          Mapping.runOperation(yield* Mapping.ownSystem(accountId), create, undefined),
        )
        expect(first.tile).toMatchObject({ title: 'Plans', version: 1 })
        expect(first.changes).toBe(1)
        const plans = first.tile?.id ?? ''
        const move = new MoveTile({ id: team, version: 1, parent: plans, slot: 1 })
        const second = yield* transactional(
          Mapping.runOperation(yield* Mapping.ownSystem(accountId), move, first.undo),
        )
        expect(second.tile).toBeUndefined()
        const version = yield* versionOf(accountId, work)
        const remove = new DeleteTile({ id: work, version })
        const third = yield* transactional(
          Mapping.runOperation(yield* Mapping.ownSystem(accountId), remove, second.undo),
        )
        yield* undone(accountId, third.undo)
        expect(said(yield* Mapping.system(yield* Mapping.ownSystem(accountId)))).toEqual(
          said(before),
        )
      }),
  )

  it.effect('refuses to delete a Tile it made once the user put a Tile below it since', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* seeded
      const made = crypto.randomUUID()
      const { undo } = yield* transactional(
        Mapping.runBatch(yield* Mapping.ownSystem(accountId), [
          { operation: new CreateTile({ parent: root, slot: 3, ...content('Plans') }), made },
        ]),
      )
      const mine = new CreateTile({ parent: made, slot: 1, ...content('Mine') })
      yield* transactional(Mapping.createTile(yield* Mapping.ownSystem(accountId), mine))
      const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
      const refused = yield* Effect.flip(undone(accountId, undo))
      expect(refused._tag).toBe('BatchOutdated')
      expect(yield* Mapping.system(yield* Mapping.ownSystem(accountId))).toEqual(before)
    }),
  )

  it.effect('is outdated once another writer changed a Tile an earlier write touched', () =>
    Effect.gen(function* () {
      const { accountId, team } = yield* seeded
      const edit = (version: number, title: string) => new EditTile({ id: team, version, title })
      const first = yield* transactional(
        Mapping.runOperation(yield* Mapping.ownSystem(accountId), edit(1, 'Crew'), undefined),
      )
      yield* transactional(Mapping.editTile(yield* Mapping.ownSystem(accountId), edit(2, 'Mine')))
      const second = yield* transactional(
        Mapping.runOperation(yield* Mapping.ownSystem(accountId), edit(3, 'Squad'), first.undo),
      )
      expect(second.undo).toEqual({ _tag: 'Outdated' })
      const refused = yield* Effect.flip(undone(accountId, second.undo))
      expect(refused._tag).toBe('BatchOutdated')
    }),
  )

  it.effect('refuses an applied Operation as its own function does, nothing written', () =>
    Effect.gen(function* () {
      const { accountId, team } = yield* seeded
      const refused = yield* Effect.flip(
        transactional(
          Mapping.runOperation(
            yield* Mapping.ownSystem(accountId),
            new EditTile({ id: team, version: 9, title: 'X' }),
            undefined,
          ),
        ),
      )
      expect(refused._tag).toBe('TileChanged')
    }),
  )
})

layer(TestTiles)('an undo of a Reference whose Tile its batch deleted before it', (it) => {
  it.effect(
    'undoes a batch that put a Reference under a Tile it made, deleted its Tile, then it',
    () =>
      Effect.gen(function* () {
        const { accountId, root, team } = yield* seeded
        const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
        const plans = crypto.randomUUID()
        const { undo } = yield* transactional(
          Mapping.runBatch(yield* Mapping.ownSystem(accountId), [
            {
              operation: new CreateTile({ parent: root, slot: 3, ...content('Plans') }),
              made: plans,
            },
            {
              operation: new CreateReference({
                parent: plans,
                parentVersion: 1,
                slot: -1,
                target: team,
              }),
              made: crypto.randomUUID(),
            },
            { operation: new DeleteTile({ id: team, version: 1 }) },
            { operation: new DeleteReference({ parent: plans, parentVersion: 2, slot: -1 }) },
          ]),
        )
        yield* undone(accountId, undo)
        expect(said(yield* Mapping.system(yield* Mapping.ownSystem(accountId)))).toEqual(
          said(before),
        )
      }),
  )

  it.effect(
    'puts back a Reference a later write deleted, whose Tile an earlier write deleted',
    () =>
      Effect.gen(function* () {
        const { accountId, root, team } = yield* seeded
        const before = yield* Mapping.system(yield* Mapping.ownSystem(accountId))
        const remove = new DeleteTile({ id: team, version: 1 })
        const first = yield* transactional(
          Mapping.runOperation(yield* Mapping.ownSystem(accountId), remove, undefined),
        )
        const parentVersion = yield* versionOf(accountId, root)
        const unlink = new DeleteReference({ parent: root, parentVersion, slot: -1 })
        const second = yield* transactional(
          Mapping.runOperation(yield* Mapping.ownSystem(accountId), unlink, first.undo),
        )
        yield* undone(accountId, second.undo)
        expect(said(yield* Mapping.system(yield* Mapping.ownSystem(accountId)))).toEqual(
          said(before),
        )
      }),
  )
})
