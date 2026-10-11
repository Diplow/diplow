// The same database through Drizzle's promise API, for Better Auth's Drizzle adapter, which awaits its
// queries where every repository yields them (./database.ts). Only the auth repository may import this
// file (dependency-cruiser.config.ts): every other repository uses `Database`.
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as NodePgDrizzle from 'drizzle-orm/node-postgres'
import { Config, Context, Effect, Layer, Redacted } from 'effect'
import { Pool } from 'pg'

import { captureError } from '../observability/sentry'

/** Drizzle's promise API over the database: node-postgres when deployed, PGlite in tests. */
export class PromiseDatabase extends Context.Service<
  PromiseDatabase,
  PgAsyncDatabase<PgQueryResultHKT>
>()('hexframe/PromiseDatabase') {}

/**
 * A node-postgres pool on DATABASE_URL, ended with the layer, which connects on its first query. An
 * idle connection the server drops is reported and replaced; unheard, it would crash the process.
 */
const pool = Effect.acquireRelease(
  Effect.gen(function* () {
    const pool = new Pool({
      connectionString: Redacted.value(yield* Config.Redacted('DATABASE_URL')),
    })
    pool.on('error', (error) => {
      // A pool callback runs outside any program, so no logger hears it: straight to Sentry, and to the
      // server's console, as the runtime's own failures go (api/report/observability/server.ts, `unobserved`).
      const tags = { kind: 'Unexpected', code: 'Unexpected', scope: 'databasePool' }
      captureError(error, tags)
      console.error('An idle database connection failed', tags, error.message)
    })
    return pool
  }),
  (pool) => Effect.promise(() => pool.end()),
)

/** The deployed promise database. Fails to build when DATABASE_URL is unset. */
export const layer = Layer.effect(PromiseDatabase)(
  Effect.map(pool, (client) => NodePgDrizzle.drizzle({ client })),
)
