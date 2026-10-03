import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, layer } from '@effect/vitest'
import { integer, pgSchema, text } from 'drizzle-orm/pg-core'
import { ConfigProvider, Effect, Exit } from 'effect'

import { Database } from './database'
import { migrated } from './migrations'
import { PromiseDatabase, layer as promiseLayer } from './promise'
import { tile } from './schema'
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

  it.effect('keeps a tile in a Direction or a Context slot, and a Root in none', () =>
    Effect.gen(function* () {
      const database = yield* Database
      // Each row of an Account of its own, so no unique index refuses it: only the checks may.
      const row = (parentId: string | null, direction: number | null) => ({
        id: crypto.randomUUID(),
        accountId: crypto.randomUUID(),
        parentId,
        direction,
        title: '',
        preview: '',
        body: '',
      })
      const root = row(null, null)
      yield* database.insert(tile).values(root)
      const written = (parentId: string | null, direction: number | null) =>
        database
          .insert(tile)
          .values(row(parentId, direction))
          .pipe(Effect.exit, Effect.map(Exit.isSuccess))
      const [rootDirected, undirected, ...slots] = yield* Effect.all([
        written(null, 1),
        written(root.id, null),
        ...[0, 7, -7, 6, -6].map((direction) => written(root.id, direction)),
      ])
      expect({ rootDirected, undirected, slots }).toEqual({
        rootDirected: false,
        undirected: false,
        slots: [false, false, false, true, true],
      })
    }),
  )
})

describe("Better Auth's promise database, deployed", () => {
  const builtWith = (env: Record<string, string>) =>
    Effect.gen(function* () {
      return typeof (yield* PromiseDatabase).select
    }).pipe(
      Effect.provide(promiseLayer),
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
      Effect.exit,
    )

  it.effect('is a Drizzle database over DATABASE_URL, built without connecting', () =>
    Effect.gen(function* () {
      // A pool connects on its first query, so a server that is not there is enough to build it.
      const url = 'postgres://nobody@127.0.0.1:1/none'
      expect(yield* builtWith({ DATABASE_URL: url })).toEqual(Exit.succeed('function'))
    }),
  )

  it.effect('fails to build without DATABASE_URL', () =>
    Effect.gen(function* () {
      expect(Exit.isFailure(yield* builtWith({}))).toBe(true)
    }),
  )
})
