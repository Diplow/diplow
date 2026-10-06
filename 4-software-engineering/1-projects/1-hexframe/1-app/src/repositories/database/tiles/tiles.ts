// Mapping's repository: the `tile` table (../schema.ts), read and written one System at a time. It
// speaks rows, not Tiles: Mapping, above, decides what a row means and which changes are allowed.
// A change locks the System's Root first, inside the transaction the API layer opened, so two
// changes to one System never interleave between what Mapping checked and what it wrote. A read from
// one Tile walks down a generation per query and selects only the content columns asked, so a Body
// nobody asked for never leaves the database.
import { type SQL, and, eq, inArray, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { type FrontmatterColumn, type TileConfigColumn, tile } from '../schema'

/**
 * One row of the `tile` table, as the Account that owns it reads it. A Root has no parent and no
 * direction; a row with a `target` is a Reference to the row of that id. `name`, `config` and
 * `frontmatter` are what an imported file carried, null when it carried nothing.
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
}

/** The columns keeping what an imported file carried: null when it carried nothing. */
type KeptColumn = 'name' | 'config' | 'frontmatter'

/** The columns holding what a Tile says, which a read from one Tile names one by one. */
export type ContentColumn = 'title' | 'preview' | 'body'

/**
 * A row as a read from one Tile gives it: where it stands, whether it is a Reference, and only the
 * content columns asked. Mapping shapes it (`domains/mapping/entities/rows.ts`).
 */
export type TileRowWith<C extends ContentColumn> = Omit<TileRow, ContentColumn | KeptColumn> &
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

/** A row to add under a parent, keeping what an imported file carried or not. */
type NewTileRow = Omit<TileRow, 'id' | 'parentId' | 'direction' | KeptColumn> &
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

/** What a change may write, to the System it locked only, inside the same transaction. */
export interface Writes {
  /** Adds a row under the id `Tiles.newId` made for it. */
  readonly insert: (
    row: NewTileRow & Pick<TileRow, 'id'>,
  ) => Effect.Effect<void, never, InTransaction>
  /**
   * Adds every row of a batch, in its order, a few hundred per statement, and answers each one's id
   * by its key. A row comes after the row of the batch it stands under; a key named before it is
   * given, or given twice, is a defect.
   */
  readonly insertAll: (
    rows: ReadonlyArray<BatchRow>,
  ) => Effect.Effect<ReadonlyMap<string, string>, never, InTransaction>
  /** Changes the columns given; with none, writes nothing. */
  readonly update: (
    id: string,
    changes: Partial<Omit<NewTileRow, 'target'>>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Deletes a row and every row below it. */
  readonly remove: (id: string) => Effect.Effect<void, never, InTransaction>
  /**
   * Two rows trade places, each with every row below it: each takes the other's parent and
   * direction. Neither may be the Root, nor lie below the other: Mapping checks it first.
   */
  readonly swap: (a: string, b: string) => Effect.Effect<void, never, InTransaction>
}

export class Tiles extends Context.Service<
  Tiles,
  {
    /**
     * Every row of the Account's System, its Root added first with the content given when it has
     * none. Two reads at once add one Root.
     */
    readonly read: (
      accountId: string,
      root: Pick<TileRow, ContentColumn>,
    ) => Effect.Effect<ReadonlyArray<TileRow>>
    /** The id of the Account's Root, added first with the content given when it has none. */
    readonly root: (accountId: string, root: Pick<TileRow, ContentColumn>) => Effect.Effect<string>
    /**
     * The row of this id in the Account's System, then the rows below it, `depth` generations down,
     * one query per generation, that row and the rows below each with only the content columns
     * asked of them. `undefined` when the System holds no row of this id.
     */
    readonly generationsFrom: <O extends ContentColumn, C extends ContentColumn>(
      accountId: string,
      from: {
        readonly id: string
        readonly depth: number
        readonly columns: ColumnsAsked<O, C>
      },
    ) => Effect.Effect<Generations<O, C> | undefined>
    /** The rows of these ids in the Account's System, each with only the content columns asked. */
    readonly ofIds: <C extends ContentColumn>(
      accountId: string,
      ids: ReadonlyArray<string>,
      columns: ReadonlyArray<C>,
    ) => Effect.Effect<ReadonlyArray<TileRowWith<C>>>
    /**
     * Locks the System's Root until the transaction ends, then answers its rows as they stand: no
     * other change to the System runs until then. An Account without a Root has no rows.
     */
    readonly lock: (
      accountId: string,
    ) => Effect.Effect<ReadonlyArray<TileRow>, never, InTransaction>
    /** What a change may write to the Account's System, once it locked it. */
    readonly writes: (accountId: string) => Writes
    /**
     * The id a row about to be added takes, made here as every row's is, so that a change knows it
     * before it writes the row (`Writes.insert`).
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

const columns = { ...placeColumns, ...contentColumns, ...keptColumns }

/** The rows standing under another, for a row to find what lies below it. */
const under = alias(tile, 'under')

/** A query that only holds inside a transaction: it requires one, so it runs in no other. */
const inTransaction = <A>(query: Effect.Effect<A>) => InTransaction.use(() => query)

const ofAccount = (accountId: string) => eq(tile.accountId, accountId)

/**
 * Two rows of the Account's System trade places. The slot index is checked row by row, never at the
 * end of the statement, so two rows cannot trade slots in one update: the first waits under a spare
 * row, one with nothing below it and so every slot free, which a finite System always holds, while
 * the second takes its place.
 */
const swapRows = (database: Database['Service'], accountId: string, a: string, b: string) =>
  Effect.gen(function* () {
    const place = (id: string, at: Pick<TileRow, 'parentId' | 'direction'>) =>
      database
        .update(tile)
        .set(at)
        .where(and(ofAccount(accountId), eq(tile.id, id)))
        .pipe(Effect.asVoid, Effect.orDie)
    const placed = yield* database
      .select(placeColumns)
      .from(tile)
      .where(and(ofAccount(accountId), inArray(tile.id, [a, b])))
      .pipe(Effect.orDie)
    const [spare] = yield* database
      .select({ id: tile.id })
      .from(tile)
      .leftJoin(under, eq(under.parentId, tile.id))
      .where(and(ofAccount(accountId), isNull(under.id)))
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

/** The service over the given database; a database failure is a defect. */
const make = Effect.gen(function* () {
  const database = yield* Database
  const rootOf = (accountId: string) => and(ofAccount(accountId), isNull(tile.parentId))
  const rowsOf = (accountId: string) =>
    database.select(columns).from(tile).where(ofAccount(accountId)).pipe(Effect.orDie)

  const writes = (accountId: string): Writes => ({
    insert: (row) =>
      inTransaction(
        database
          .insert(tile)
          .values({ ...row, accountId })
          .pipe(Effect.asVoid, Effect.orDie),
      ),
    insertAll: (rows) =>
      inTransaction(
        Effect.gen(function* () {
          // A key named before it is given throws: a defect.
          const { ids, placed } = yield* Effect.sync(() => idsOf(rows))
          for (let at = 0; at < placed.length; at += batchSize) {
            const values = placed.slice(at, at + batchSize).map((row) => ({ ...row, accountId }))
            yield* database.insert(tile).values(values).pipe(Effect.orDie)
          }
          return ids
        }),
      ),
    update: (id, changes) =>
      inTransaction(
        Object.keys(changes).length === 0
          ? Effect.void
          : database
              .update(tile)
              .set(changes)
              .where(and(ofAccount(accountId), eq(tile.id, id)))
              .pipe(Effect.asVoid, Effect.orDie),
      ),
    remove: (id) =>
      inTransaction(
        database
          .delete(tile)
          .where(and(ofAccount(accountId), eq(tile.id, id)))
          .pipe(Effect.asVoid, Effect.orDie),
      ),
    swap: (a, b) => inTransaction(swapRows(database, accountId, a, b)),
  })

  const ensureRoot = (accountId: string, root: Pick<TileRow, ContentColumn>) =>
    database
      .insert(tile)
      .values({ ...root, id: crypto.randomUUID(), accountId })
      .onConflictDoNothing()
      .pipe(Effect.asVoid, Effect.orDie)

  /** The Account's rows matching `where`, with only the content columns asked. */
  const rowsWith = <C extends ContentColumn>(
    accountId: string,
    where: SQL,
    columns: ReadonlyArray<C>,
  ): Effect.Effect<ReadonlyArray<TileRowWith<C>>> =>
    database
      .select({ ...placeColumns, ...contentColumnsOf(columns) })
      .from(tile)
      .where(and(ofAccount(accountId), where))
      .pipe(Effect.orDie)

  const root = (accountId: string, content: Pick<TileRow, ContentColumn>) =>
    ensureRoot(accountId, content).pipe(
      Effect.andThen(
        database.select({ id: tile.id }).from(tile).where(rootOf(accountId)).pipe(Effect.orDie),
      ),
      Effect.flatMap(([found]) =>
        found === undefined
          ? Effect.die(new Error('A Root was added, then not found'))
          : Effect.succeed(found.id),
      ),
    )

  const generationsFrom = <O extends ContentColumn, C extends ContentColumn>(
    accountId: string,
    from: { readonly id: string; readonly depth: number; readonly columns: ColumnsAsked<O, C> },
  ) =>
    Effect.gen(function* () {
      const [opened] = yield* rowsWith(accountId, eq(tile.id, from.id), from.columns.opened)
      if (opened === undefined) return undefined
      const below: Array<TileRowWith<C>> = []
      let parents = [opened.id]
      for (let left = from.depth; left > 0 && parents.length > 0; left--) {
        const generation = yield* rowsWith(
          accountId,
          inArray(tile.parentId, parents),
          from.columns.below,
        )
        below.push(...generation)
        parents = generation.map((row) => row.id)
      }
      return { opened, below } satisfies Generations<O, C>
    })

  const ofIds = <C extends ContentColumn>(
    accountId: string,
    ids: ReadonlyArray<string>,
    columns: ReadonlyArray<C>,
  ) =>
    ids.length === 0 ? Effect.succeed([]) : rowsWith(accountId, inArray(tile.id, [...ids]), columns)

  return Tiles.of({
    read: (accountId, root) => Effect.andThen(ensureRoot(accountId, root), rowsOf(accountId)),
    root,
    generationsFrom,
    ofIds,
    lock: (accountId) =>
      inTransaction(
        database
          .select({ id: tile.id })
          .from(tile)
          .where(rootOf(accountId))
          .for('update')
          .pipe(Effect.orDie, Effect.andThen(rowsOf(accountId))),
      ),
    writes,
    newId: Effect.sync(() => crypto.randomUUID()),
  })
})

/** The tiles repository, over the `Database` it is given. */
export const layer = Layer.effect(Tiles)(make)
