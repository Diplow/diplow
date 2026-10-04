// The database as every repository sees it: Drizzle's query builder over Effect's Postgres client.
// Neon in every deployed environment, reached through DATABASE_URL; PGlite in tests (./testing.ts).
// `node scripts/migrate.ts` runs this file as it is, without a bundler: it imports packages only.
import { PgClient } from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import { Config, Context, Effect, Layer } from 'effect'
import { isSqlError } from 'effect/unstable/sql/SqlError'

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

/**
 * Present while a program runs in the transaction `transactional` opened. A repository's call that
 * only holds inside one (a lock, a write) requires it, so a program making it cannot run outside one.
 */
export class InTransaction extends Context.Service<InTransaction, true>()(
  'hexframe/InTransaction',
) {}

/**
 * Runs a program in one transaction: every query made through `Database` while it runs joins it,
 * whichever repository makes it. A failure rolls back what it wrote; a database failure is a defect.
 * The API layer opens it, around the domains' operations it composes, and nothing below does.
 */
export const transactional = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Database.use((database) =>
    database.transaction(() => Effect.provideService(program, InTransaction, true)),
  ).pipe(Effect.catchIf(isSqlError, Effect.die))
