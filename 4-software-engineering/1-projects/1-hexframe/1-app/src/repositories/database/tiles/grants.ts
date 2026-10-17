// The `grant` table (../schema.ts), the Grants a System's Tiles carry, read one System at a time, found
// through the `tile` rows they belong to, by their owner's id, and written to a Tile of the System a
// change locked, inside its transaction: set for one subject in place of what it had, or removed, so
// the subject inherits again. Part of Mapping's repository (./tiles.ts), which merges these in: it
// speaks rows, and Mapping decides what a Grant allows and who may set one, its owner from a Session
// alone (`domains/mapping/sharing/`). The tests set theirs below any check through ./testing.ts.
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Effect } from 'effect'

import { type Database, InTransaction } from '../database'
import { grant, tile } from '../schema'

/**
 * One row of the `grant` table: the Tile's id, the subject's kind, its id, none for Everyone, and the
 * value. Mapping's `GrantRow` reads it.
 */
export interface GrantRow {
  readonly tile: string
  readonly subject: typeof grant.$inferSelect.subject
  readonly subjectId: string | null
  readonly value: typeof grant.$inferSelect.value
}

/** Where a row stands, as rights read it: its id and its parent's, none for the Root. */
export interface PlaceRow {
  readonly id: string
  readonly parentId: string | null
}

const grantColumns = {
  tile: grant.tileId,
  subject: grant.subject,
  subjectId: grant.subjectId,
  value: grant.value,
}

/** The reads of a System's Grants, and of where its rows stand. */
export const grantsOf = (database: Database['Service']) => ({
  grants: (owner: string): Effect.Effect<ReadonlyArray<GrantRow>> =>
    database
      .select(grantColumns)
      .from(grant)
      .innerJoin(tile, eq(tile.id, grant.tileId))
      .where(eq(tile.ownerId, owner))
      .pipe(Effect.orDie),
  places: (owner: string): Effect.Effect<ReadonlyArray<PlaceRow>> =>
    database
      .select({ id: tile.id, parentId: tile.parentId })
      .from(tile)
      .where(eq(tile.ownerId, owner))
      .pipe(Effect.orDie),
})

/** The subject of a Grant, as a row names it: its kind, and its id, none for Everyone. */
export type GrantSubjectRow = Pick<GrantRow, 'subject' | 'subjectId'>

/** The rows of a subject's Grants: its kind, and its id or, for Everyone, none. */
const ofSubject = ({ subject, subjectId }: GrantSubjectRow) =>
  and(
    eq(grant.subject, subject),
    subjectId === null ? isNull(grant.subjectId) : eq(grant.subjectId, subjectId),
  )

/** What a change may write of the Grants of the owner's System, once it locked it. */
export interface GrantWrites {
  /**
   * Sets a Tile's Grant for one subject, in place of the one it had. A Tile the owner's System
   * doesn't hold is a defect: Mapping found it there first.
   */
  readonly setGrant: (row: GrantRow) => Effect.Effect<void, never, InTransaction>
  /** Removes a Tile's Grant for one subject, if it has one: the subject inherits there again. */
  readonly removeGrant: (
    tileId: string,
    subject: GrantSubjectRow,
  ) => Effect.Effect<void, never, InTransaction>
}

/** A query that only holds inside a transaction: it requires one, so it runs in no other. */
const inTransaction = <A, E>(query: Effect.Effect<A, E>) => InTransaction.use(() => query)

/** The writes of the Grants of the owner's System, each to a Tile it holds alone. */
export const grantWritesOf = (database: Database['Service'], owner: string): GrantWrites => {
  const tilesOfOwner = database
    .select({ id: tile.id })
    .from(tile)
    .where(eq(tile.ownerId, owner))
  return {
    setGrant: (row) =>
      inTransaction(
        Effect.gen(function* () {
          const [held] = yield* database
            .select({ id: tile.id })
            .from(tile)
            .where(and(eq(tile.ownerId, owner), eq(tile.id, row.tile)))
            .pipe(Effect.orDie)
          if (held === undefined) {
            return yield* Effect.die(new Error('A Grant named a Tile its System does not hold'))
          }
          const { tile: tileId, ...rest } = row
          yield* database
            .insert(grant)
            .values({ tileId, ...rest })
            .onConflictDoUpdate({
              target: [grant.tileId, grant.subject, grant.subjectId],
              set: { value: row.value },
            })
            .pipe(Effect.orDie)
        }),
      ),
    removeGrant: (tileId, subject) =>
      inTransaction(
        database
          .delete(grant)
          .where(
            and(eq(grant.tileId, tileId), ofSubject(subject), inArray(grant.tileId, tilesOfOwner)),
          )
          .pipe(Effect.asVoid, Effect.orDie),
      ),
  }
}
