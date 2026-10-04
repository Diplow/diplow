// `pnpm db:migrate`: applies the committed migrations to the database DATABASE_URL names, the same way
// the test harness applies them to PGlite. Vercel runs it before each build (vercel.json), against the
// Neon branch the deployment gets: its git branch's on a preview, the main one in production. A script
// is a process of its own, outside the server functions, so it runs its program itself.
import { Effect } from 'effect'

import { layer } from '../src/repositories/database/database.ts'
import { migrated } from '../src/repositories/database/migrations.ts'

await Effect.runPromise(migrated.pipe(Effect.provide(layer)))
console.log('Migrations applied.')
