// `pnpm db:migrate`: applies the committed migrations to the database DATABASE_URL names, the same way
// the test harness applies them to PGlite. CI runs it against the pull request's Neon branch before its
// preview deploys, and against production before production deploys. A script is a process of its own,
// outside the server functions, so it runs its program itself.
import { Effect } from 'effect'

import { Database, layer } from '../src/repositories/database/database.ts'
import { migrated } from '../src/repositories/database/migrations.ts'

await Effect.runPromise(Database.use(migrated).pipe(Effect.provide(layer)))
console.log('Migrations applied.')
