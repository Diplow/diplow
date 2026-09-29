// Mapping's repository: the `tile` table (../schema.ts), read and written one System at a time. It
// speaks rows, not Tiles: Mapping, above, decides what a row means and which changes are allowed.
// Every change runs in one transaction that first locks the System's Root, so two changes to one
// System never interleave between what Mapping checked and what it wrote.
import { and, eq, isNull } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { isSqlError } from 'effect/unstable/sql/SqlError'

import { Database } from '../database'
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

/** A row to add under a parent. Its id is made here. */
type NewTileRow = Omit<TileRow, 'id' | 'parentId' | 'direction'> & {
  readonly parentId: string
  readonly direction: number
}

/** What a change may write, to the System it was opened on only. */
export interface Writes {
  /** Adds a row and answers its id. */
  readonly insert: (row: NewTileRow) => Effect.Effect<string>
  readonly update: (id: string, changes: Partial<Omit<NewTileRow, 'target'>>) => Effect.Effect<void>
  /** Deletes a row and every row below it. */
  readonly remove: (id: string) => Effect.Effect<void>
}

export class Tiles extends Context.Service<
  Tiles,
  {
    /** Every row of the Account's System, its Root added first when it has none. */
    readonly read: (accountId: string) => Effect.Effect<ReadonlyArray<TileRow>>
    /**
     * Runs `change` in one transaction, on the System's rows as they stand once its Root is locked.
     * A failure of `change` rolls back what it wrote. An Account without a Root has no rows.
     */
    readonly change: <A, E, R>(
      accountId: string,
      change: (rows: ReadonlyArray<TileRow>, writes: Writes) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>
  }
>()('hexframe/Tiles') {}

const columns = {
  id: tile.id,
  parentId: tile.parentId,
  direction: tile.direction,
  title: tile.title,
  preview: tile.preview,
  body: tile.body,
  target: tile.target,
}

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
      return database
        .insert(tile)
        .values({ ...row, id, accountId })
        .pipe(Effect.as(id), Effect.orDie)
    },
    update: (id, changes) =>
      database
        .update(tile)
        .set(changes)
        .where(and(ofAccount(accountId), eq(tile.id, id)))
        .pipe(Effect.asVoid, Effect.orDie),
    remove: (id) =>
      database
        .delete(tile)
        .where(and(ofAccount(accountId), eq(tile.id, id)))
        .pipe(Effect.asVoid, Effect.orDie),
  })

  const ensureRoot = (accountId: string) =>
    database
      .insert(tile)
      .values({ id: crypto.randomUUID(), accountId, title: '', preview: '', body: '' })
      .onConflictDoNothing()
      .pipe(Effect.asVoid, Effect.orDie)

  return Tiles.of({
    read: (accountId) => Effect.andThen(ensureRoot(accountId), rowsOf(accountId)),
    change: (accountId, change) =>
      database
        .transaction(() =>
          Effect.gen(function* () {
            yield* database
              .select({ id: tile.id })
              .from(tile)
              .where(rootOf(accountId))
              .for('update')
              .pipe(Effect.orDie)
            return yield* change(yield* rowsOf(accountId), writes(accountId))
          }),
        )
        .pipe(Effect.catchIf(isSqlError, Effect.die)),
  })
})

/** The tiles repository, over the `Database` it is given. */
export const layer = Layer.effect(Tiles)(make)
