// The database as every repository sees it: Drizzle's query builder over Effect's Postgres client.
// Neon in every deployed environment, reached through DATABASE_URL; PGlite in tests (./testing.ts).
// This file and ./migrations.ts import packages only, so `node scripts/migrate.ts` runs them as they are.
import { PgClient } from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import { Config, Context, Layer } from 'effect'

/** Drizzle over one connection pool, shared by every repository. */
export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  'hexframe/Database',
) {}

/** The Postgres DATABASE_URL names: the pull request's Neon branch on a preview, the main one in production. */
const postgres = PgClient.layerConfig({ url: Config.Redacted('DATABASE_URL') })

/** The deployed database. Fails to build when DATABASE_URL is unset or the server does not answer. */
export const layer = Layer.effect(Database)(PgDrizzle.makeWithDefaults()).pipe(
  Layer.provide(postgres),
)
