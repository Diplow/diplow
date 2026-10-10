// What Mapping's tests over PGlite share: the tiles repository over PGlite with a bus that hears
// nothing, the System read as its tree, and each change run as the API layer runs it, in the
// transaction it opens, naming each Tile it changes at the Version it has just before, as a writer
// that just read the System would.
import { Effect, Layer } from 'effect'

import { Bus } from '#/domains/bus'
import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { systemOf, tileAt, type Version } from './entities'
import * as Mapping from './mapping'
import * as Operations from './operations'

/** The Account's System, read flat, as its tree: what the canvas draws, as the client builds it. */
export const tree = (accountId: string) => Effect.map(Mapping.system(accountId), systemOf)

/** The bus, as Mapping publishes on it: these tests hear nothing it publishes. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

export const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Unheard)

/** What a writer that just read the Account's System names: each Tile's Version as it stands. */
const versions = (accountId: string) =>
  Effect.map(
    Mapping.system(accountId),
    (system) =>
      (id: string): Version =>
        tileAt(system, id)?.version ?? 1,
  )

/** A change in the transaction the API layer opens, its Operation made at the Versions just before. */
const change = <A, E>(
  accountId: string,
  made: (v: (id: string) => Version) => Effect.Effect<A, E, Tiles | Bus | InTransaction>,
) => Effect.flatMap(versions(accountId), (v) => transactional(made(v)))

/** An Operation's fields, but its tag and those the helper below fills itself. */
type Fields<O, Filled extends string = never> = Omit<O, '_tag' | Filled>

export const createTile = (accountId: string, fields: Fields<Operations.CreateTile>) =>
  transactional(Mapping.createTile(accountId, new Operations.CreateTile(fields)))

export const editTile = (
  accountId: string,
  id: string,
  to: Fields<Operations.EditTile, 'id' | 'version'>,
) =>
  change(accountId, (v) =>
    Mapping.editTile(accountId, new Operations.EditTile({ id, version: v(id), ...to })),
  )

export const moveTile = (
  accountId: string,
  id: string,
  to: Fields<Operations.MoveTile, 'id' | 'version'>,
) =>
  change(accountId, (v) =>
    Mapping.moveTile(accountId, new Operations.MoveTile({ id, version: v(id), ...to })),
  )

export const swapTiles = (accountId: string, a: string, b: string) =>
  change(accountId, (v) =>
    Mapping.swapTiles(
      accountId,
      new Operations.SwapTiles({ a, aVersion: v(a), b, bVersion: v(b) }),
    ),
  )

export const deleteTile = (accountId: string, id: string) =>
  change(accountId, (v) =>
    Mapping.deleteTile(accountId, new Operations.DeleteTile({ id, version: v(id) })),
  )

export const createReference = (
  accountId: string,
  fields: Fields<Operations.CreateReference, 'parentVersion'>,
) =>
  change(accountId, (v) =>
    Mapping.createReference(
      accountId,
      new Operations.CreateReference({ ...fields, parentVersion: v(fields.parent) }),
    ),
  )

export const deleteReference = (
  accountId: string,
  fields: Fields<Operations.DeleteReference, 'parentVersion'>,
) =>
  change(accountId, (v) =>
    Mapping.deleteReference(
      accountId,
      new Operations.DeleteReference({ ...fields, parentVersion: v(fields.parent) }),
    ),
  )
