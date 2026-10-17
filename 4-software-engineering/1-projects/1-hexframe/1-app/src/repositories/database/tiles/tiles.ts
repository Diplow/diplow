// Mapping's repository: the `tile` table (../schema.ts), read and written one System at a time, each
// System found by its owner's id, which every row of it carries, opaque here as it is to Mapping: an
// Account's today, an Organization's later. It speaks rows, not Tiles: Mapping, above, decides what a
// row means, who may act on a System and which changes are allowed. A change locks the System's Root,
// its star, first, inside the transaction the API layer opened, so two changes to one System never
// interleave between what Mapping checked and what it wrote. A read from
// one Tile walks down a generation per query and selects only the content columns asked, so a Body
// nobody asked for never leaves the database.
import { type SQL, and, eq, inArray, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Context, Data, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { type FrontmatterColumn, type TileConfigColumn, tile } from '../schema'

/**
 * One row of the `tile` table, as its System's owner reads it. A Root has no parent and no
 * direction; a row with a `target` is a Reference to the row of that id. `name`, `config` and
 * `frontmatter` are what an imported file carried, null when it carried nothing. `version` is the
 * Tile's Version, 1 once added, which Mapping decides and a change writes; `systemVersion`, on the
 * Root's row, the System's, 0 once added, which a change writes too, and 0 on every other row.
 */
export interface TileRow {
  readonly id: string
  readonly parentId: string | null
  readonly direction: number | null
  readonly title: string
  readonly preview: string
  readonly body: string
  readonly target: string | null
  readonly name: string | null
  readonly config: TileConfigColumn | null
  readonly frontmatter: FrontmatterColumn | null
  readonly version: number
  readonly systemVersion: number
}

/** The columns keeping what an imported file carried: null when it carried nothing. */
type KeptColumn = 'name' | 'config' | 'frontmatter'

/** The columns holding what a Tile says, which a read from one Tile names one by one. */
export type ContentColumn = 'title' | 'preview' | 'body'

/**
 * A row as a read from one Tile gives it: where it stands, whether it is a Reference, its Version, and
 * only the content columns asked. Mapping shapes it (`domains/mapping/entities/rows.ts`).
 */
export type TileRowWith<C extends ContentColumn> = Omit<
  TileRow,
  ContentColumn | KeptColumn | 'systemVersion'
> &
  Pick<TileRow, C>

/** What a read from one row asks of each: the content columns of that row, and of the rows below it. */
export interface ColumnsAsked<O extends ContentColumn, C extends ContentColumn> {
  readonly opened: ReadonlyArray<O>
  readonly below: ReadonlyArray<C>
}

/** A read from one row: that row, then the rows below it, each with the content columns asked. */
export interface Generations<O extends ContentColumn, C extends ContentColumn> {
  readonly opened: TileRowWith<O>
  readonly below: ReadonlyArray<TileRowWith<C>>
}

/** A row to add under a parent, keeping what an imported file carried or not, at Version 1. */
type NewTileRow = Omit<
  TileRow,
  'id' | 'parentId' | 'direction' | 'version' | 'systemVersion' | KeptColumn
> &
  Partial<Pick<TileRow, KeptColumn>> & {
    readonly parentId: string
    readonly direction: number
  }

/** A row a batch names: one of the batch, by the key the caller gave it, or one already stored. */
export type RowRef =
  | { readonly _tag: 'Batch'; readonly key: string }
  | { readonly _tag: 'Stored'; readonly id: string }

/**
 * A row of a batch, named by a key of the caller's, under a row of the batch or one already stored.
 * Its `target`, a Reference's, names a row the same way, or `Nowhere`: a row of its own id made here,
 * so it names no row, as a Reference to a deleted one does; `null` for a Tile.
 */
export interface BatchRow extends Omit<NewTileRow, 'parentId' | 'target'> {
  readonly key: string
  readonly parent: RowRef
  readonly target: RowRef | { readonly _tag: 'Nowhere' } | null
}

/**
 * A row was to be added under an id a row already has, in any System: `tile.id` is the table's key. Nothing was written.
 */
export class IdTaken extends Data.TaggedError('IdTaken')<{ readonly id: string }> {}

/** What a change may write, to the System it locked only, inside the same transaction. */
export interface Writes {
  /**
   * Adds a row under the id it carries, made by `Tiles.newId` or chosen by a caller. An id a row of
   * any System already has is `IdTaken`, and nothing is written.
   */
  readonly insert: (
    row: NewTileRow & Pick<TileRow, 'id'>,
  ) => Effect.Effect<void, IdTaken, InTransaction>
  /**
   * Adds every row of a batch, in its order, a few hundred per statement, and answers each one's id
   * by its key. A row comes after the row of the batch it stands under; a key named before it is
   * given, or given twice, is a defect.
   */
  readonly insertAll: (
    rows: ReadonlyArray<BatchRow>,
  ) => Effect.Effect<ReadonlyMap<string, string>, never, InTransaction>
  /**
   * Changes the columns given, and always the Version Mapping decided for the row, so no change to a
   * Tile leaves its Version behind.
   */
  readonly update: (
    id: string,
    changes: Partial<Omit<NewTileRow, 'target'>> & Pick<TileRow, 'version'>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Deletes a row and every row below it. */
  readonly remove: (id: string) => Effect.Effect<void, never, InTransaction>
  /**
   * Two rows trade places, each with every row below it: each takes the other's parent and
   * direction. Neither may be the Root, nor lie below the other: Mapping checks it first.
   */
  readonly swap: (a: string, b: string) => Effect.Effect<void, never, InTransaction>
  /** Sets the System's Version, on its Root's row, to the one Mapping decided after a change. */
  readonly setSystemVersion: (version: number) => Effect.Effect<void, never, InTransaction>
}

export class Tiles extends Context.Service<
  Tiles,
  {
    /** Every row of the owner's System, none for an owner without a Root. */
    readonly read: (owner: string) => Effect.Effect<ReadonlyArray<TileRow>>
    /**
     * The `system_version` of the owner's Root's row, read alone, `undefined` for an owner without a
     * Root.
     */
    readonly systemVersion: (owner: string) => Effect.Effect<number | undefined>
    /**
     * The id of the owner's Root, its star, added first with the content given when it has none. Two
     * calls at once add one Root.
     */
    readonly root: (owner: string, root: Pick<TileRow, ContentColumn>) => Effect.Effect<string>
    /**
     * The owner of the System whose Root has this id, `undefined` when no Root has it: what names a
     * System by its star.
     */
    readonly ownerOf: (star: string) => Effect.Effect<string | undefined>
    /**
     * The row of this id in the owner's System, then the rows below it, `depth` generations down,
     * one query per generation, that row and the rows below each with only the content columns
     * asked of them. `undefined` when the System holds no row of this id.
     */
    readonly generationsFrom: <O extends ContentColumn, C extends ContentColumn>(
      owner: string,
      from: {
        readonly id: string
        readonly depth: number
        readonly columns: ColumnsAsked<O, C>
      },
    ) => Effect.Effect<Generations<O, C> | undefined>
    /** The rows of these ids in the owner's System, each with only the content columns asked. */
    readonly ofIds: <C extends ContentColumn>(
      owner: string,
      ids: ReadonlyArray<string>,
      columns: ReadonlyArray<C>,
    ) => Effect.Effect<ReadonlyArray<TileRowWith<C>>>
    /**
     * Locks the owner's Root, its System's star, until the transaction ends, then answers the
     * System's rows as they stand: no other change to the System runs until then. An owner without
     * a Root has no rows.
     */
    readonly lock: (owner: string) => Effect.Effect<ReadonlyArray<TileRow>, never, InTransaction>
    /** What a change may write to the owner's System, once it locked it. */
    readonly writes: (owner: string) => Writes
    /**
     * A fresh id for a row about to be added, for a change whose caller chose none, so that it knows
     * the id before it writes the row (`Writes.insert`).
     */
    readonly newId: Effect.Effect<string>
  }
>()('hexframe/Tiles') {}

/** Where a row stands, and whether it is a Reference. */
const placeColumns = {
  id: tile.id,
  parentId: tile.parentId,
  direction: tile.direction,
  target: tile.target,
}

/** How many events touched a Tile: what a write names to be refused once the Tile changed since. */
const versionColumns = { version: tile.version }

/** How many events changed the System: on its Root's row, read with every row of a System. */
const systemVersionColumns = { systemVersion: tile.systemVersion }

/** What a Tile says. */
const contentColumns = { title: tile.title, preview: tile.preview, body: tile.body }

/** The content columns asked, for a select, and no other. */
const contentColumnsOf = <C extends ContentColumn>(asked: ReadonlyArray<C>) =>
  // Built from the columns asked, each of them, which a type cannot follow.
  Object.fromEntries(asked.map((column) => [column, contentColumns[column]])) as Pick<
    typeof contentColumns,
    C
  >

/** What an imported file carried. */
const keptColumns = { name: tile.name, config: tile.config, frontmatter: tile.frontmatter }

const columns = {
  ...placeColumns,
  ...versionColumns,
  ...systemVersionColumns,
  ...contentColumns,
  ...keptColumns,
}

/** The rows standing under another, for a row to find what lies below it. */
const under = alias(tile, 'under')

/** A query that only holds inside a transaction: it requires one, so it runs in no other. */
const inTransaction = <A, E>(query: Effect.Effect<A, E>) => InTransaction.use(() => query)

/** The rows of the owner's System: every row carries its System's owner. */
const ofOwner = (owner: string) => eq(tile.ownerId, owner)

/** The owner's Root, its System's star: the one row of its System with no parent. */
const rootOf = (owner: string) => and(ofOwner(owner), isNull(tile.parentId))

/**
 * Two rows of the owner's System trade places. The slot index is checked row by row, never at the
 * end of the statement, so two rows cannot trade slots in one update: the first waits under a spare
 * row, one with nothing below it and so every slot free, which a finite System always holds, while
 * the second takes its place.
 */
const swapRows = (database: Database['Service'], owner: string, a: string, b: string) =>
  Effect.gen(function* () {
    const place = (id: string, at: Pick<TileRow, 'parentId' | 'direction'>) =>
      database
        .update(tile)
        .set(at)
        .where(and(ofOwner(owner), eq(tile.id, id)))
        .pipe(Effect.asVoid, Effect.orDie)
    const placed = yield* database
      .select(placeColumns)
      .from(tile)
      .where(and(ofOwner(owner), inArray(tile.id, [a, b])))
      .pipe(Effect.orDie)
    const [spare] = yield* database
      .select({ id: tile.id })
      .from(tile)
      .leftJoin(under, eq(under.parentId, tile.id))
      .where(and(ofOwner(owner), isNull(under.id)))
      .limit(1)
      .pipe(Effect.orDie)
    const first = placed.find((row) => row.id === a)
    const second = placed.find((row) => row.id === b)
    if (first === undefined || second === undefined || spare === undefined) {
      return yield* Effect.die(new Error('A swap named a row its System does not hold'))
    }
    yield* place(a, { parentId: spare.id, direction: 1 })
    yield* place(b, { parentId: first.parentId, direction: first.direction })
    yield* place(a, { parentId: second.parentId, direction: second.direction })
  })

/** How many rows one statement of a batch adds: a few hundred, well within Postgres' parameters. */
const batchSize = 500

/**
 * A batch's rows with their ids, made here, every key it names resolved: a row's parent before it,
 * its target anywhere in the batch.
 */
function idsOf(rows: ReadonlyArray<BatchRow>) {
  const ids = new Map<string, string>()
  for (const { key } of rows) {
    if (ids.has(key)) throw new Error(`A batch gave the key ${key} twice`)
    ids.set(key, crypto.randomUUID())
  }
  const seen = new Set<string>()
  const idOf = (ref: RowRef, before: boolean) => {
    if (ref._tag === 'Stored') return ref.id
    const id = ids.get(ref.key)
    if (id === undefined || (before && !seen.has(ref.key))) {
      throw new Error(`A batch named the key ${ref.key} before giving it`)
    }
    return id
  }
  const placed = rows.map(({ key, parent, target, ...row }) => {
    const placedRow = {
      ...row,
      id: ids.get(key) ?? '',
      parentId: idOf(parent, true),
      target:
        target === null
          ? null
          : target._tag === 'Nowhere'
            ? crypto.randomUUID()
            : idOf(target, false),
    }
    seen.add(key)
    return placedRow
  })
  return { ids, placed }
}

/** A System's star, the id of its owner's Root, and the owner a star names. */
const starsOf = (database: Database['Service']) => {
  const rootId = (owner: string) =>
    database
      .select({ id: tile.id })
      .from(tile)
      .where(rootOf(owner))
      .pipe(
        Effect.orDie,
        Effect.map(([found]) => found?.id),
      )
  const ensureRoot = (owner: string, root: Pick<TileRow, ContentColumn>) =>
    database
      .insert(tile)
      .values({ ...root, id: crypto.randomUUID(), ownerId: owner })
      .onConflictDoNothing()
      .pipe(Effect.asVoid, Effect.orDie)
  return {
    // Read first, so that a System read again, as most are, writes nothing.
    root: (owner: string, content: Pick<TileRow, ContentColumn>) =>
      Effect.flatMap(rootId(owner), (found) =>
        found !== undefined
          ? Effect.succeed(found)
          : ensureRoot(owner, content).pipe(
              Effect.andThen(rootId(owner)),
              Effect.flatMap((added) =>
                added === undefined
                  ? Effect.die(new Error('A Root was added, then not found'))
                  : Effect.succeed(added),
              ),
            ),
      ),
    ownerOf: (star: string) =>
      database
        .select({ ownerId: tile.ownerId })
        .from(tile)
        .where(and(eq(tile.id, star), isNull(tile.parentId)))
        .pipe(
          Effect.orDie,
          Effect.map(([found]) => found?.ownerId),
        ),
  }
}

/** The service over the given database; a database failure is a defect. */
const make = Effect.gen(function* () {
  const database = yield* Database
  const rowsOf = (owner: string) =>
    database.select(columns).from(tile).where(ofOwner(owner)).pipe(Effect.orDie)

  const writes = (owner: string): Writes => ({
    insert: (row) =>
      inTransaction(
        database
          .insert(tile)
          .values({ ...row, ownerId: owner })
          // Only a clash on the key is answered: any other constraint broken is a defect.
          .onConflictDoNothing({ target: tile.id })
          .returning({ id: tile.id })
          .pipe(
            Effect.orDie,
            Effect.flatMap((added) =>
              added.length === 0 ? Effect.fail(new IdTaken({ id: row.id })) : Effect.void,
            ),
          ),
      ),
    insertAll: (rows) =>
      inTransaction(
        Effect.gen(function* () {
          // A key named before it is given throws: a defect.
          const { ids, placed } = yield* Effect.sync(() => idsOf(rows))
          for (let at = 0; at < placed.length; at += batchSize) {
            const values = placed
              .slice(at, at + batchSize)
              .map((row) => ({ ...row, ownerId: owner }))
            yield* database.insert(tile).values(values).pipe(Effect.orDie)
          }
          return ids
        }),
      ),
    update: (id, changes) =>
      inTransaction(
        database
          .update(tile)
          .set(changes)
          .where(and(ofOwner(owner), eq(tile.id, id)))
          .pipe(Effect.asVoid, Effect.orDie),
      ),
    remove: (id) =>
      inTransaction(
        database
          .delete(tile)
          .where(and(ofOwner(owner), eq(tile.id, id)))
          .pipe(Effect.asVoid, Effect.orDie),
      ),
    swap: (a, b) => inTransaction(swapRows(database, owner, a, b)),
    setSystemVersion: (version) =>
      inTransaction(
        database
          .update(tile)
          .set({ systemVersion: version })
          .where(rootOf(owner))
          .pipe(Effect.asVoid, Effect.orDie),
      ),
  })

  /** The owner's rows matching `where`, with only the content columns asked. */
  const rowsWith = <C extends ContentColumn>(
    owner: string,
    where: SQL,
    columns: ReadonlyArray<C>,
  ): Effect.Effect<ReadonlyArray<TileRowWith<C>>> =>
    database
      .select({ ...placeColumns, ...versionColumns, ...contentColumnsOf(columns) })
      .from(tile)
      .where(and(ofOwner(owner), where))
      .pipe(Effect.orDie)

  const generationsFrom = <O extends ContentColumn, C extends ContentColumn>(
    owner: string,
    from: { readonly id: string; readonly depth: number; readonly columns: ColumnsAsked<O, C> },
  ) =>
    Effect.gen(function* () {
      const [opened] = yield* rowsWith(owner, eq(tile.id, from.id), from.columns.opened)
      if (opened === undefined) return undefined
      const below: Array<TileRowWith<C>> = []
      let parents = [opened.id]
      for (let left = from.depth; left > 0 && parents.length > 0; left--) {
        const generation = yield* rowsWith(
          owner,
          inArray(tile.parentId, parents),
          from.columns.below,
        )
        below.push(...generation)
        parents = generation.map((row) => row.id)
      }
      return { opened, below } satisfies Generations<O, C>
    })

  const ofIds = <C extends ContentColumn>(
    owner: string,
    ids: ReadonlyArray<string>,
    columns: ReadonlyArray<C>,
  ) =>
    ids.length === 0 ? Effect.succeed([]) : rowsWith(owner, inArray(tile.id, [...ids]), columns)

  return Tiles.of({
    read: rowsOf,
    systemVersion: (owner) =>
      database
        .select(systemVersionColumns)
        .from(tile)
        .where(rootOf(owner))
        .pipe(
          Effect.orDie,
          Effect.map(([found]) => found?.systemVersion),
        ),
    ...starsOf(database),
    generationsFrom,
    ofIds,
    lock: (owner) =>
      inTransaction(
        database
          .select({ id: tile.id })
          .from(tile)
          .where(rootOf(owner))
          .for('update')
          .pipe(Effect.orDie, Effect.andThen(rowsOf(owner))),
      ),
    writes,
    newId: Effect.sync(() => crypto.randomUUID()),
  })
})

/** The tiles repository, over the `Database` it is given. */
export const layer = Layer.effect(Tiles)(make)
