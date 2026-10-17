// The `grant` table (../schema.ts), the Grants a System's Tiles carry, read one System at a time, found
// through the `tile` rows they belong to, by their owner's id. Part of Mapping's repository
// (./tiles.ts), which merges these in: it speaks rows, and Mapping decides what a Grant allows. No
// program writes a Grant yet: the Share widget brings the one write, a Session's (HEX-128); the tests
// set theirs through ./testing.ts.
import { eq } from 'drizzle-orm'
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
