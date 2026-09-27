// The integration harness: a real Postgres in memory (PGlite) with every committed migration applied,
// provided as the same Database and PromiseDatabase services the deployed app gets, both over one
// PGlite. Each build of the layer is a fresh, empty database, so a test file (or an @effect/vitest
// `layer` block) never sees another's rows.
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

const pglite = Layer.effect(Pglite)(
  Effect.acquireRelease(
    Effect.promise(() => PGlite.create()),
    (instance) => Effect.promise(() => instance.close()),
  ),
)

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

/** A fresh PGlite, migrated by the program `pnpm db:migrate` runs. A failed migration kills the test. */
export const TestDatabase = Layer.effectDiscard(Effect.orDie(migrated)).pipe(
  Layer.provideMerge(Layer.mergeAll(database, promiseDatabase)),
  Layer.provide(pglite),
  Layer.orDie,
)
