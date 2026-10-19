// What Mapping's tests set below it, past every check: a Tile's Grant for any subject, outside any
// transaction, which no program does. A program sets one through `Writes.setGrant` (./grants.ts),
// which Mapping's sharing asks only of the System's owner, from a Session (HEX-128). For tests only.
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import { Database } from '../database'
import { grant, tile } from '../schema'
import type { GrantRow } from './grants'

/**
 * Sets a Tile's Grant for one subject, in place of the one it had: a Tile of the owner's System only.
 * A Tile it doesn't hold is a defect.
 */
export const granted = (owner: string, row: GrantRow) =>
  Database.use((database) =>
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
  )
