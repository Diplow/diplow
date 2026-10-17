// The `grant` table (../schema.ts), the Grants a System's Tiles carry, read and written one System at a
// time, found through the `tile` rows they belong to, by their owner's id. Part of Mapping's repository
// (./tiles.ts), which merges these in: it speaks rows, and Mapping decides what a Grant allows.
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import type { Database } from '../database'
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

/**
 * Sets a Tile's Grant for one subject, in place of the one it had: a Tile of the owner's System only,
 * which Mapping found before asking. A Tile it doesn't hold is a defect.
 */
export const granted = (database: Database['Service'], owner: string, row: GrantRow) =>
  Effect.gen(function* () {
    const [held] = yield* database
      .select({ id: tile.id })
      .from(tile)
      .where(and(eq(tile.ownerId, owner), eq(tile.id, row.tile)))
      .pipe(Effect.orDie)
    if (held === undefined)
      return yield* Effect.die(new Error('A Grant named a Tile its System does not hold'))
    const { tile: tileId, ...rest } = row
    yield* database
      .insert(grant)
      .values({ tileId, ...rest })
      .onConflictDoUpdate({
        target: [grant.tileId, grant.subject, grant.subjectId],
        set: { value: row.value },
      })
      .pipe(Effect.orDie)
  })
