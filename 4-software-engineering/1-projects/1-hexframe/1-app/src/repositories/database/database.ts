// The database as every repository sees it: Drizzle's query builder over Effect's Postgres client.
// Neon in every deployed environment, reached through DATABASE_URL; PGlite in tests (./testing.ts).
// `node scripts/migrate.ts` runs this file as it is, without a bundler: it imports packages only.
import { PgClient } from '@effect/sql-pg'
import * as NodePgDrizzle from 'drizzle-orm/node-postgres'
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import { Config, Context, Effect, Layer, Redacted } from 'effect'
import { Pool } from 'pg'

/** Drizzle over one connection pool, shared by every repository. */
export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  'hexframe/Database',
) {}

/** The Postgres DATABASE_URL names: the pull request's Neon branch on a preview, the main one in production. */
const url = Config.Redacted('DATABASE_URL')

const postgres = PgClient.layerConfig({ url })

/** The deployed database. Fails to build when DATABASE_URL is unset or the server does not answer. */
export const layer = Layer.effect(Database)(PgDrizzle.makeWithDefaults()).pipe(
  Layer.provide(postgres),
)

/**
 * The same database through Drizzle's promise API, for a library that awaits its queries rather than
 * yielding them: Better Auth's Drizzle adapter (../auth/). Every other repository uses `Database`.
 */
export class PromiseDatabase extends Context.Service<
  PromiseDatabase,
  PgAsyncDatabase<PgQueryResultHKT>
>()('hexframe/PromiseDatabase') {}

/** A node-postgres pool on DATABASE_URL, ended with the layer. Connects on the first query. */
const pool = Effect.acquireRelease(
  Effect.gen(function* () {
    const connectionString = Redacted.value(yield* url)
    return new Pool({ connectionString })
  }),
  (pool) => Effect.promise(() => pool.end()),
)

/** The deployed promise database. Fails to build when DATABASE_URL is unset. */
export const promiseLayer = Layer.effect(PromiseDatabase)(
  Effect.map(pool, (client) => NodePgDrizzle.drizzle({ client })),
)
