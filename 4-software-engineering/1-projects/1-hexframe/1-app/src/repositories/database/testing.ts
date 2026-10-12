// The integration harness: a real Postgres in memory (PGlite) with every committed migration applied,
// provided as the same Database and PromiseDatabase services the deployed app gets, both over one
// PGlite. Each build of the layer is a fresh database, holding no rows, so a test file (or an
// @effect/vitest `layer` block) never sees another's.
import { readFile } from 'node:fs/promises'

import { PGlite } from '@electric-sql/pglite'
import { PgliteClient } from '@effect/sql-pglite'
import * as PgliteDrizzle from 'drizzle-orm/effect-pglite'
import * as PglitePromiseDrizzle from 'drizzle-orm/pglite'
import { Context, Effect, Layer } from 'effect'

import { Database } from './database'
import { migrated } from './migrations'
import { PromiseDatabase } from './promise'

/** The one PGlite both services share, closed with the layer. */
class Pglite extends Context.Service<Pglite, PGlite>()('hexframe/Pglite') {}

/**
 * The environment variable naming the test run's template, the tarball `migratedTemplate` made, which
 * `scripts/test-database.ts` sets for the run's workers. Unset under `pnpm dev`.
 */
export const templateVariable = 'HEXFRAME_PGLITE_TEMPLATE'

/** A PGlite the layer closes, as `create` starts it. */
const pgliteFrom = (create: () => Promise<PGlite>) =>
  Layer.effect(Pglite)(
    Effect.acquireRelease(Effect.promise(create), (instance) =>
      Effect.promise(() => instance.close()),
    ),
  )

/** An empty PGlite: its initdb run first, most of a cold start. */
const empty = pgliteFrom(() => PGlite.create())

/**
 * A PGlite started from the run's template when there is one, already migrated, without an initdb; an
 * empty one otherwise. Every test file building one at once, each initdb takes seconds, past a test's
 * timeout; from the template, a fraction of one.
 */
const pglite = pgliteFrom(async () => {
  const template = process.env[templateVariable] ?? ''
  if (template === '') return PGlite.create()
  return PGlite.create({ loadDataDir: new Blob([await readFile(template)]) })
})

const effectClient = PgliteClient.layerFrom(
  Effect.gen(function* () {
    return yield* PgliteClient.fromClient({ liveClient: yield* Pglite })
  }),
)

const database = Layer.effect(Database)(PgliteDrizzle.makeWithDefaults()).pipe(
  Layer.provide(effectClient),
)

const promiseDatabase = Layer.effect(PromiseDatabase)(
  Effect.gen(function* () {
    return PglitePromiseDrizzle.drizzle({ client: yield* Pglite })
  }),
)

/** Both services over the PGlite, migrated by the program `pnpm db:migrate` runs. */
const migratedOver = Layer.effectDiscard(Effect.orDie(migrated)).pipe(
  Layer.provideMerge(Layer.mergeAll(database, promiseDatabase)),
)

/**
 * A fresh PGlite, migrated by the program `pnpm db:migrate` runs: a no-op on the run's template, which
 * that program already migrated. A failed migration kills the test.
 */
export const TestDatabase = migratedOver.pipe(Layer.provide(pglite), Layer.orDie)

/**
 * An empty PGlite, migrated by the program `pnpm db:migrate` runs, as the tarball of its data
 * directory: what `scripts/test-database.ts` writes once per test run, and names in `templateVariable`
 * for every TestDatabase of the run to start from.
 */
export const migratedTemplate = Effect.gen(function* () {
  const instance = yield* Pglite
  const tarball = yield* Effect.promise(() => instance.dumpDataDir('none'))
  return new Uint8Array(yield* Effect.promise(() => tarball.arrayBuffer()))
}).pipe(Effect.provide(migratedOver.pipe(Layer.provideMerge(empty), Layer.orDie)))
