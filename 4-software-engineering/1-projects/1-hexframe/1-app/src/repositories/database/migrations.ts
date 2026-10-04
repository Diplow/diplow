// The committed migrations, applied by one program everywhere: to a Neon branch by `pnpm db:migrate`,
// to a fresh PGlite by the test harness (./testing.ts). `pnpm db:generate` writes the next one.
// `node scripts/migrate.ts` runs this file without a bundler, hence the `.ts` in its one relative import.
import { fileURLToPath } from 'node:url'

import { migrate } from 'drizzle-orm/effect-postgres/migrator'

import { Database } from './database.ts'

/** Where drizzle-kit writes them (drizzle.config.ts): `migrations/` at the package's root. */
const migrationsFolder = fileURLToPath(new URL('../../../migrations', import.meta.url))

/** Applies every migration the database has not recorded yet, in order; a no-op when it is up to date. */
export const migrated = Database.use((database) => migrate(database, { migrationsFolder }))
