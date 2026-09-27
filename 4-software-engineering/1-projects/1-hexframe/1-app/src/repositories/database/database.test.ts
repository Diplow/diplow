import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, layer } from '@effect/vitest'
import { integer, pgSchema, text } from 'drizzle-orm/pg-core'
import { Effect } from 'effect'

import { Database } from './database'
import { migrated } from './migrations'
import { TestDatabase } from './testing'

const committed = readdirSync(fileURLToPath(new URL('../../../migrations', import.meta.url)))

// Where Drizzle's migrator records what it applied, read through the query builder like any table.
const applied = pgSchema('drizzle').table('__drizzle_migrations', {
  id: integer().primaryKey(),
  name: text(),
})

const recorded = Effect.gen(function* () {
  const database = yield* Database
  const rows = yield* database.select({ name: applied.name }).from(applied).orderBy(applied.id)
  return rows.map((row) => row.name)
})

layer(TestDatabase)('the test database', (it) => {
  it.effect('has every committed migration applied, in order', () =>
    Effect.gen(function* () {
      expect(yield* recorded).toEqual(committed.toSorted())
    }),
  )

  it.effect('applies nothing twice', () =>
    Effect.gen(function* () {
      yield* migrated
      expect(yield* recorded).toEqual(committed.toSorted())
    }),
  )
})
