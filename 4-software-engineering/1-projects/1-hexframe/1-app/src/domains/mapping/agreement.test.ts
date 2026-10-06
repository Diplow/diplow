import { expect, layer } from '@effect/vitest'
import { Effect, Layer, Result } from 'effect'

import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { configured, heldAt, named, type System } from './entities'
import * as Mapping from './mapping'
import {
  CreateReference,
  CreateTile,
  decide,
  DeleteReference,
  DeleteTile,
  EditTile,
  evolve,
  type Made,
  MoveTile,
  type Operation,
  SwapTiles,
} from './operations'

// The Decider and the service agree: for each Operation, `evolve` folded over the events `decide`
// makes on the System as it stood equals the System read back once the service ran it over PGlite.
// The client shows a write by the same two functions, so what it shows is what the server keeps.

const TestTiles = tilesLayer.pipe(Layer.provideMerge(TestDatabase))

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** A change as the service runs it, of an Operation, and, for a create, what `decide` is given. */
interface Run<A, E> {
  readonly operation: Operation
  readonly change: Effect.Effect<A, E, Tiles | InTransaction>
  /** The id the service made, read from its answer or from the System after; none but a create's. */
  readonly made?: (answer: A, after: System) => Made
}

/**
 * Runs a change through the service, as the API layer does, in a transaction, then checks that the
 * events `decide` makes of its Operation on the System as it stood before, evolved, give the System
 * read back after.
 */
const agrees = <A, E>(accountId: string, { operation, change, made }: Run<A, E>) =>
  Effect.gen(function* () {
    const before = yield* Mapping.system(accountId)
    const answer = yield* transactional(change)
    const after = yield* Mapping.system(accountId)
    const given = made?.(answer, after) ?? { id: '' }
    const events = Result.getOrThrow(decide(before, operation, given))
    expect(events.reduce(evolve, before)).toEqual(after)
  })

/**
 * An Account's System holding, under its Root, a Branch in Direction 1 with a Child in Direction 2
 * and a Context Tile in -1, a bare Branch in Direction 3, a Leaf in Direction 1, and a Reference to the
 * Child in the Root's -2.
 */
const aSystem = Effect.gen(function* () {
  const accountId = crypto.randomUUID()
  const root = (yield* Mapping.system(accountId)).root.id
  const add = (parent: string, slot: CreateTile['slot'], title: string) =>
    transactional(
      Mapping.createTile(accountId, new CreateTile({ parent, slot, ...content(title) })),
    ).pipe(Effect.map(({ id }) => id))
  const branch = yield* add(root, 1, 'Branch')
  const child = yield* add(branch, 2, 'Child')
  const why = yield* add(branch, -1, 'Why')
  const bare = yield* add(root, 3, 'Bare')
  const leaf = yield* add(root, { leaf: 1 }, 'Leaf')
  yield* transactional(
    Mapping.createReference(
      accountId,
      new CreateReference({ parent: root, slot: -2, target: child }),
    ),
  )
  return { accountId, root, branch, child, why, bare, leaf }
})

layer(TestTiles)('decide and evolve agree with the service, over PGlite', (it) => {
  it.effect('on a Tile created, a Branch, a Leaf or a Context Tile, and one an import keeps', () =>
    Effect.gen(function* () {
      const { accountId, root, branch } = yield* aSystem
      const places = [
        { parent: branch, slot: 4 },
        { parent: branch, slot: { leaf: 2 } },
        { parent: root, slot: -6 },
      ] as const
      for (const place of places) {
        const operation = new CreateTile({ ...place, ...content(' Spaced ') })
        yield* agrees(accountId, {
          operation,
          change: Mapping.createTile(accountId, operation),
          made: ({ id }) => ({ id }),
        })
      }
      const kept = {
        name: yield* named('STACK.md'),
        config: yield* configured({ fileName: 'SKILL.md' }),
      }
      const imported = new CreateTile({ parent: root, slot: 5, ...content('Stack') })
      yield* agrees(accountId, {
        operation: imported,
        change: Mapping.createTile(accountId, imported, kept),
        made: ({ id }) => ({ id, kept }),
      })
    }),
  )

  it.effect('on a Tile edited, the Root’s included, and an edit giving nothing', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* aSystem
      for (const operation of [
        new EditTile({ id: root, title: '  Ada Lovelace ' }),
        new EditTile({ id: child, preview: '', body: 'Rewritten' }),
        new EditTile({ id: child }),
      ]) {
        yield* agrees(accountId, { operation, change: Mapping.editTile(accountId, operation) })
      }
    }),
  )

  it.effect('on a Tile moved, grown, shrunk, or moved to where it stands', () =>
    Effect.gen(function* () {
      const { accountId, root, branch, bare, leaf } = yield* aSystem
      for (const operation of [
        new MoveTile({ id: branch, parent: bare, slot: -3 }),
        new MoveTile({ id: leaf, parent: root, slot: 6 }),
        new MoveTile({ id: leaf, parent: root, slot: { leaf: 4 } }),
        new MoveTile({ id: bare, parent: root, slot: 3 }),
      ]) {
        yield* agrees(accountId, { operation, change: Mapping.moveTile(accountId, operation) })
      }
    }),
  )

  it.effect('on two Tiles swapped, across Children and Context, and a Tile with itself', () =>
    Effect.gen(function* () {
      const { accountId, why, bare, leaf, child } = yield* aSystem
      for (const operation of [
        new SwapTiles({ a: why, b: bare }),
        new SwapTiles({ a: why, b: leaf }),
        new SwapTiles({ a: child, b: child }),
      ]) {
        yield* agrees(accountId, { operation, change: Mapping.swapTiles(accountId, operation) })
      }
    }),
  )

  it.effect('on a Tile deleted with everything below it, a Reference to it left broken', () =>
    Effect.gen(function* () {
      const { accountId, branch } = yield* aSystem
      const operation = new DeleteTile({ id: branch })
      yield* agrees(accountId, { operation, change: Mapping.deleteTile(accountId, operation) })
    }),
  )

  it.effect('on a Reference created and deleted, and an empty slot emptied', () =>
    Effect.gen(function* () {
      const { accountId, root, bare, leaf } = yield* aSystem
      const created = new CreateReference({ parent: bare, slot: -4, target: leaf })
      yield* agrees(accountId, {
        operation: created,
        change: Mapping.createReference(accountId, created),
        made: (_, after) => ({ id: heldAt(after, bare, -4)?.id ?? '' }),
      })
      for (const operation of [
        new DeleteReference({ parent: root, slot: -2 }),
        new DeleteReference({ parent: root, slot: -2 }),
      ]) {
        yield* agrees(accountId, {
          operation,
          change: Mapping.deleteReference(accountId, operation),
        })
      }
    }),
  )
})
