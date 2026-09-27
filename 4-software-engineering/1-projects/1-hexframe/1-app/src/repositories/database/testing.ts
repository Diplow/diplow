// The integration harness: a real Postgres in memory (PGlite) with every committed migration applied,
// provided as the same Database service the deployed app gets. Each build of the layer is a fresh,
// empty database, so a test file (or an @effect/vitest `layer` block) never sees another's rows.
import { PgliteClient } from '@effect/sql-pglite'
import * as PgliteDrizzle from 'drizzle-orm/effect-pglite'
import { Effect, Layer } from 'effect'

import { Database } from './database'
import { migrated } from './migrations'

/** A fresh PGlite, migrated, as the Database service. A migration that fails is a defect: the test dies. */
export const TestDatabase = Layer.effect(Database)(
  PgliteDrizzle.makeWithDefaults().pipe(Effect.tap(migrated), Effect.orDie),
).pipe(Layer.provide(PgliteClient.layer()), Layer.orDie)
