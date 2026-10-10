import { expect, layer } from '@effect/vitest'
import { Effect, Layer, Result } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { configured, heldAt, named, type System, tileAt, type Version } from '../../entities'
import * as Mapping from '../../mapping'
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
} from '..'

// The Decider and the service agree: for each Operation, `evolve` folded over the events `decide`
// makes on the System as it stood equals the System read back once the service ran it over PGlite,
// every Tile's Version included; and what `decide` refuses, the service refuses alike, writing and
// publishing nothing.
// The client shows a write by the same two functions, so what it shows is what the server keeps.

/** Every event the service published since `agrees` last asked, in order. */
const heard: Array<DomainEvent> = []

/** The bus, as Mapping publishes on it: it keeps what it hears. */
const Heard = Layer.succeed(Bus)({ publish: (event) => Effect.sync(() => void heard.push(event)) })

const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Heard)

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** A change as the service runs it, of an Operation, and, for a create, what `decide` is given. */
interface Run<A, E> {
  readonly operation: Operation
  readonly change: Effect.Effect<A, E, Tiles | Bus | InTransaction>
  /** The id the service made, read from its answer or from the System after; none but a create's. */
  readonly made?: (answer: A, after: System) => Made
}

/**
 * Runs a change through the service, as the API layer does, in a transaction, then checks that the
 * events `decide` makes of its Operation on the System as it stood before, evolved, give the System
 * read back after, and are the events the service published, in their order.
 */
const agrees = <A, E>(accountId: string, { operation, change, made }: Run<A, E>) =>
  Effect.gen(function* () {
    const before = yield* Mapping.system(accountId)
    heard.length = 0
    const answer = yield* transactional(change)
    const after = yield* Mapping.system(accountId)
    // An Operation that makes nothing never reads what it is given.
    const given = made?.(answer, after) ?? { id: crypto.randomUUID() }
    const events = Result.getOrThrow(decide(before, operation, given))
    expect(events.reduce(evolve, before)).toEqual(after)
    expect(heard).toEqual(events)
  })

/**
 * Runs a change `decide` refuses on the System as it stands, and checks the service refuses it alike,
 * with nothing written and nothing published.
 */
const refusedAlike = <A, E>(accountId: string, { operation, change }: Run<A, E>) =>
  Effect.gen(function* () {
    const before = yield* Mapping.system(accountId)
    heard.length = 0
    const decided = decide(before, operation, { id: crypto.randomUUID() })
    if (Result.isSuccess(decided)) throw new Error(`decide made events of ${operation._tag}`)
    expect(yield* Effect.flip(transactional(change))).toEqual(decided.failure)
    expect(yield* Mapping.system(accountId)).toEqual(before)
    expect(heard).toEqual([])
  })

/** The Version of each Tile of the Account's System as it stands, which a writer reading it names. */
const versions = (accountId: string) =>
  Effect.map(
    Mapping.system(accountId),
    (system) =>
      (id: string): Version =>
        tileAt(system, id)?.version ?? 1,
  )

/** An Operation made once the one before it ran, at the Versions it left. */
type Next<O extends Operation = Operation> = (v: (id: string) => Version) => O

/**
 * An Account's System holding, under its Root, a Branch in Direction 1 with a Child in Direction 2
 * and a Context Tile in -1, a bare Branch in Direction 3, a Leaf in Direction 1, and a Reference to the
 * Child in the Root's -2.
 */
const aSystem = Effect.gen(function* () {
  const accountId = crypto.randomUUID()
  const { id: root, version } = (yield* Mapping.system(accountId)).root
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
      new CreateReference({ parent: root, parentVersion: version, slot: -2, target: child }),
    ),
  )
  return { accountId, root, branch, child, why, bare, leaf }
})

layer(TestTiles)('decide and evolve agree with the service, over PGlite', (it) => {
  it.effect('on a Tile created, of each kind, under a chosen id, and one an import keeps', () =>
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
      // The client decides a create under the id it chose, before the answer comes.
      const id = crypto.randomUUID()
      const chosen = new CreateTile({ id, parent: branch, slot: 5, ...content('Chosen') })
      yield* agrees(accountId, {
        operation: chosen,
        change: Mapping.createTile(accountId, chosen),
        made: () => ({ id }),
      })
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
      const edits: ReadonlyArray<Next<EditTile>> = [
        (v) => new EditTile({ id: root, version: v(root), title: '  Ada Lovelace ' }),
        (v) => new EditTile({ id: child, version: v(child), preview: '', body: 'Rewritten' }),
        (v) => new EditTile({ id: child, version: v(child) }),
      ]
      for (const next of edits) {
        const operation = next(yield* versions(accountId))
        yield* agrees(accountId, { operation, change: Mapping.editTile(accountId, operation) })
      }
    }),
  )

  it.effect('on a Tile moved, grown, shrunk, or moved to where it stands', () =>
    Effect.gen(function* () {
      const { accountId, root, branch, bare, leaf } = yield* aSystem
      const moves: ReadonlyArray<Next<MoveTile>> = [
        (v) => new MoveTile({ id: branch, version: v(branch), parent: bare, slot: -3 }),
        (v) => new MoveTile({ id: leaf, version: v(leaf), parent: root, slot: 6 }),
        (v) => new MoveTile({ id: leaf, version: v(leaf), parent: root, slot: { leaf: 4 } }),
        (v) => new MoveTile({ id: bare, version: v(bare), parent: root, slot: 3 }),
      ]
      for (const next of moves) {
        const operation = next(yield* versions(accountId))
        yield* agrees(accountId, { operation, change: Mapping.moveTile(accountId, operation) })
      }
    }),
  )

  it.effect('on two Tiles swapped, across Children and Context, and a Tile with itself', () =>
    Effect.gen(function* () {
      const { accountId, why, bare, leaf, child } = yield* aSystem
      const swap =
        (a: string, b: string): Next<SwapTiles> =>
        (v) =>
          new SwapTiles({ a, aVersion: v(a), b, bVersion: v(b) })
      for (const next of [swap(why, bare), swap(why, leaf), swap(child, child)]) {
        const operation = next(yield* versions(accountId))
        yield* agrees(accountId, { operation, change: Mapping.swapTiles(accountId, operation) })
      }
    }),
  )

  it.effect('on a Tile deleted with everything below it, a Reference to it left broken', () =>
    Effect.gen(function* () {
      const { accountId, branch } = yield* aSystem
      const operation = new DeleteTile({ id: branch, version: 1 })
      yield* agrees(accountId, { operation, change: Mapping.deleteTile(accountId, operation) })
    }),
  )

  it.effect('on a Reference created and deleted, and an empty slot emptied', () =>
    Effect.gen(function* () {
      const { accountId, root, bare, leaf } = yield* aSystem
      const created = new CreateReference({
        parent: bare,
        parentVersion: 1,
        slot: -4,
        target: leaf,
      })
      yield* agrees(accountId, {
        operation: created,
        change: Mapping.createReference(accountId, created),
        made: (_, after) => ({ id: heldAt(after, bare, -4)?.id ?? '' }),
      })
      const empty: Next<DeleteReference> = (v) =>
        new DeleteReference({ parent: root, parentVersion: v(root), slot: -2 })
      for (const next of [empty, empty]) {
        const operation = next(yield* versions(accountId))
        yield* agrees(accountId, {
          operation,
          change: Mapping.deleteReference(accountId, operation),
        })
      }
    }),
  )

  it.effect('on a write naming a Version its Tile no longer has, refused alike', () =>
    Effect.gen(function* () {
      const { accountId, root, child } = yield* aSystem
      // Another writer renamed the Child after this one read it at its first Version; the Root
      // counted the Reference in its slot -2 since.
      const theirs = new EditTile({ id: child, version: 1, title: 'Theirs' })
      yield* agrees(accountId, { operation: theirs, change: Mapping.editTile(accountId, theirs) })
      const mine = new EditTile({ id: child, version: 1, title: 'Mine' })
      yield* refusedAlike(accountId, { operation: mine, change: Mapping.editTile(accountId, mine) })
      const gone = new DeleteTile({ id: child, version: 1 })
      yield* refusedAlike(accountId, {
        operation: gone,
        change: Mapping.deleteTile(accountId, gone),
      })
      const emptied = new DeleteReference({ parent: root, parentVersion: 1, slot: -2 })
      yield* refusedAlike(accountId, {
        operation: emptied,
        change: Mapping.deleteReference(accountId, emptied),
      })
    }),
  )
})
