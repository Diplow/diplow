// The integration harness: a real Postgres in memory (PGlite) with every committed migration applied,
// provided as the same Database service the deployed app gets. Each build of the layer is a fresh,
// empty database, so a test file (or an @effect/vitest `layer` block) never sees another's rows.
import { PgliteClient } from '@effect/sql-pglite'
import * as PgliteDrizzle from 'drizzle-orm/effect-pglite'
import { Effect, Layer } from 'effect'

import { Database } from './database'
import { migrated } from './migrations'

const pglite = Layer.effect(Database)(PgliteDrizzle.makeWithDefaults()).pipe(
  Layer.provide(PgliteClient.layer()),
)

/** A fresh PGlite, migrated by the program `pnpm db:migrate` runs. A failed migration kills the test. */
export const TestDatabase = Layer.effectDiscard(Effect.orDie(migrated)).pipe(
  Layer.provideMerge(pglite),
  Layer.orDie,
)
