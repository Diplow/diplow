// Vitest's global setup (vitest.config.ts), once per test run, before any test file: the migrated
// PGlite every TestDatabase of the run starts from, written to a folder of its own and named in the
// environment the run's workers inherit, so no test file runs PGlite's initdb and the migrations
// itself (src/repositories/database/testing.ts). The teardown removes it. A step of the run, outside
// the server functions, so it runs its program itself, as migrate.ts does.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Effect } from 'effect'

import { migratedTemplate, templateVariable } from '../src/repositories/database/testing'

export async function setup() {
  const folder = await mkdtemp(join(tmpdir(), 'hexframe-pglite-'))
  const template = join(folder, 'migrated.tar')
  await writeFile(template, await Effect.runPromise(migratedTemplate))
  process.env[templateVariable] = template
  return async () => {
    Reflect.deleteProperty(process.env, templateVariable)
    await rm(folder, { recursive: true, force: true })
  }
}
