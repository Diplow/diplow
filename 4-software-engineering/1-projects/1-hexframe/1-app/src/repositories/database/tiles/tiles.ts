// Mapping's repository: the `tile` table (../schema.ts), read and written one System at a time. It
// speaks rows, not Tiles: Mapping, above, decides what a row means and which changes are allowed.
// A change locks the System's Root first, inside the transaction the API layer opened, so two
// changes to one System never interleave between what Mapping checked and what it wrote. A read from
// one Tile walks down a generation per query and selects only the content columns asked, so a Body
// nobody asked for never leaves the database.
import { type SQL, and, eq, inArray, isNull } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction } from '../database'
import { tile } from '../schema'

/**
 * One row of the `tile` table, as the Account that owns it reads it. A Root has no parent and no
 * direction; a row with a `target` is a Reference to the row of that id.
 */
export interface TileRow {
  readonly id: string
  readonly parentId: string | null
  readonly direction: number | null
  readonly title: string
  readonly preview: string
  readonly body: string
  readonly target: string | null
}

/** The columns holding what a Tile says, which a read from one Tile names one by one. */
export type ContentColumn = 'title' | 'preview' | 'body'

/**
 * A row as a read from one Tile gives it: where it stands, whether it is a Reference, and, apart,
 * only the content columns asked.
 */
export interface TileRowWith<C extends ContentColumn> {
  readonly id: string
  readonly parentId: string | null
  readonly direction: number | null
  readonly target: string | null
  readonly content: Pick<TileRow, C>
}

/** A row to add under a parent. Its id is made here. */
type NewTileRow = Omit<TileRow, 'id' | 'parentId' | 'direction'> & {
  readonly parentId: string
  readonly direction: number
}

/** What a change may write, to the System it locked only, inside the same transaction. */
export interface Writes {
  /** Adds a row and answers its id. */
  readonly insert: (row: NewTileRow) => Effect.Effect<string, never, InTransaction>
  /** Changes the columns given; with none, writes nothing. */
  readonly update: (
    id: string,
    changes: Partial<Omit<NewTileRow, 'target'>>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Deletes a row and every row below it. */
  readonly remove: (id: string) => Effect.Effect<void, never, InTransaction>
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
      root: Pick<TileRow, 'title' | 'preview' | 'body'>,
    ) => Effect.Effect<ReadonlyArray<TileRow>>
    /** The id of the Account's Root, added first with the content given when it has none. */
    readonly root: (
      accountId: string,
      root: Pick<TileRow, 'title' | 'preview' | 'body'>,
    ) => Effect.Effect<string>
    /**
     * The row of this id in the Account's System, then the rows below it, `depth` generations down,
     * one query per generation, each row with only the content columns asked. Nothing when the
     * System holds no row of this id.
     */
    readonly below: <C extends ContentColumn>(
      accountId: string,
      from: { readonly id: string; readonly depth: number; readonly columns: ReadonlyArray<C> },
    ) => Effect.Effect<ReadonlyArray<TileRowWith<C>>>
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

const columns = { ...placeColumns, ...contentColumns }

/** A query that only holds inside a transaction: it requires one, so it runs in no other. */
const inTransaction = <A>(query: Effect.Effect<A>) => InTransaction.use(() => query)

/** The service over the given database; a database failure is a defect. */
const make = Effect.gen(function* () {
  const database = yield* Database
  const ofAccount = (accountId: string) => eq(tile.accountId, accountId)
  const rootOf = (accountId: string) => and(ofAccount(accountId), isNull(tile.parentId))
  const rowsOf = (accountId: string) =>
    database.select(columns).from(tile).where(ofAccount(accountId)).pipe(Effect.orDie)

  const writes = (accountId: string): Writes => ({
    insert: (row) => {
      const id = crypto.randomUUID()
      return inTransaction(
        database
          .insert(tile)
          .values({ ...row, id, accountId })
          .pipe(Effect.as(id), Effect.orDie),
      )
    },
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
  })

  const ensureRoot = (accountId: string, root: Pick<TileRow, 'title' | 'preview' | 'body'>) =>
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
  ) => {
    const asked: Partial<typeof contentColumns> = Object.fromEntries(
      columns.map((column) => [column, contentColumns[column]]),
    )
    return database
      .select({ ...placeColumns, ...asked })
      .from(tile)
      .where(and(ofAccount(accountId), where))
      .pipe(
        Effect.orDie,
        Effect.map((rows) =>
          rows.map(({ id, parentId, direction, target, ...content }) => ({
            id,
            parentId,
            direction,
            target,
            // Built from the columns asked, which Drizzle's types cannot follow.
            content: content as Pick<TileRow, C>,
          })),
        ),
      )
  }

  const root = (accountId: string, content: Pick<TileRow, 'title' | 'preview' | 'body'>) =>
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

  const below = <C extends ContentColumn>(
    accountId: string,
    from: { readonly id: string; readonly depth: number; readonly columns: ReadonlyArray<C> },
  ) =>
    Effect.gen(function* () {
      let generation = yield* rowsWith(accountId, eq(tile.id, from.id), from.columns)
      const found = [...generation]
      for (let left = from.depth; left > 0 && generation.length > 0; left--) {
        const parents = generation.map((row) => row.id)
        generation = yield* rowsWith(accountId, inArray(tile.parentId, parents), from.columns)
        found.push(...generation)
      }
      return found
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
    below,
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
  })
})

/** The tiles repository, over the `Database` it is given. */
export const layer = Layer.effect(Tiles)(make)
