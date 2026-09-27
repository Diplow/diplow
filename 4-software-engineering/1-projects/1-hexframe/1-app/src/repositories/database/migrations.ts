// The committed migrations, applied the same way everywhere: to a Neon branch by `pnpm db:migrate`,
// to a fresh PGlite by the test harness (./testing.ts). `pnpm db:generate` writes the next one.
import { fileURLToPath } from 'node:url'

import type { EffectPgDatabase } from 'drizzle-orm/effect-postgres'
import { migrate } from 'drizzle-orm/effect-postgres/migrator'

/** Where drizzle-kit writes them (drizzle.config.ts): `migrations/` at the package's root. */
const migrationsFolder = fileURLToPath(new URL('../../../migrations', import.meta.url))

/** Applies every migration the database has not recorded yet, in order; a no-op when it is up to date. */
export const migrated = (database: EffectPgDatabase) => migrate(database, { migrationsFolder })
