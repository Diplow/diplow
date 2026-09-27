// The database as every repository sees it: Drizzle's query builder over Effect's Postgres client.
// Neon in every deployed environment, reached through DATABASE_URL; PGlite in tests (./testing.ts).
// `node scripts/migrate.ts` runs this file as it is, without a bundler: it imports packages only.
import { PgClient } from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import { Config, Context, Layer } from 'effect'

/**
 * Drizzle over one Effect connection pool, the one every repository reads and writes through. Only
 * Better Auth's adapter, which awaits its queries, has a pool of its own (./promise.ts).
 */
export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  'hexframe/Database',
) {}

/** The Postgres DATABASE_URL names: the pull request's Neon branch on a preview, the main one in production. */
const postgres = PgClient.layerConfig({ url: Config.Redacted('DATABASE_URL') })

/** The deployed database. Fails to build when DATABASE_URL is unset or the server does not answer. */
export const layer = Layer.effect(Database)(PgDrizzle.makeWithDefaults()).pipe(
  Layer.provide(postgres),
)
