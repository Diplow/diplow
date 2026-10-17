// What Mapping's tests over PGlite share: the tiles repository over PGlite with a bus that hears
// nothing, an Account acting on its own System, as the API layer resolves it, the System read as its
// tree, and each change run as the API layer runs it, on the Account's own System, in the transaction
// it opens, naming each Tile it changes at the Version it has just before, as a writer that just read
// the System would.
import { Effect, Layer, Struct } from 'effect'

import { Bus } from '#/domains/bus'
import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { type Field, type System, systemOf, tileAt, type Version } from './entities'
import * as Mapping from './mapping'
import * as Operations from './operations'

/**
 * The Account's System as Mapping holds it, flat: its read, without what its owner is shown beside it,
 * every right on every Tile and no gap, so it compares with what `decide` and `evolve` make of it.
 */
export const held = (accountId: string) =>
  Effect.map(
    Effect.flatMap(actingOnOwn(accountId), Mapping.system),
    (seen): System => Struct.omit(seen, ['rights', 'gaps']),
  )

/** The Account's System, read flat, as its tree: what the canvas draws, as the client builds it. */
export const tree = (accountId: string) =>
  Effect.map(Effect.flatMap(actingOnOwn(accountId), Mapping.system), systemOf)

/**
 * The Account acting on its own System, as the API layer resolves it from a request
 * (`api/mapping/programs.ts`, `actingOnOwn`): the actor standing for the Account alone, in no Group,
 * from a Session, as the canvas acts; the System named by its star, added on its first read.
 */
export const actingOnOwn = (accountId: string) =>
  Effect.map(Mapping.starOf(accountId), (system): Mapping.Acting => ({
    actor: { account: accountId, groups: [], owners: [accountId], session: true },
    system,
  }))

/** A read of the Account's own System, where the language Help is read in plays no part. */
export const readTile = <F extends Field>(
  accountId: string,
  read: Omit<Parameters<typeof Mapping.readTile<F>>[1], 'language'>,
) =>
  Effect.flatMap(actingOnOwn(accountId), (acting) =>
    Mapping.readTile(acting, { ...read, language: 'en' }),
  )

/** The bus, as Mapping publishes on it: these tests hear nothing it publishes. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

export const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Unheard)

/** What a writer that just read the System names: each Tile's Version as it stands. */
const versions = (acting: Mapping.Acting) =>
  Effect.map(
    Mapping.system(acting),
    (system) =>
      (id: string): Version =>
        tileAt(system, id)?.version ?? 1,
  )

/**
 * A change on the Account's own System in the transaction the API layer opens, its Operation made at
 * the Versions just before.
 */
const change = <A, E>(
  accountId: string,
  made: (
    acting: Mapping.Acting,
    v: (id: string) => Version,
  ) => Effect.Effect<A, E, Tiles | Bus | InTransaction>,
) =>
  Effect.flatMap(actingOnOwn(accountId), (acting) =>
    Effect.flatMap(versions(acting), (v) => transactional(made(acting, v))),
  )

/** An Operation's fields, but its tag and those the helper below fills itself. */
type Fields<O, Filled extends string = never> = Omit<O, '_tag' | Filled>

export const createTile = (accountId: string, fields: Fields<Operations.CreateTile>) =>
  Effect.flatMap(actingOnOwn(accountId), (acting) =>
    transactional(Mapping.createTile(acting, new Operations.CreateTile(fields))),
  )

export const editTile = (
  accountId: string,
  id: string,
  to: Fields<Operations.EditTile, 'id' | 'version'>,
) =>
  change(accountId, (acting, v) =>
    Mapping.editTile(acting, new Operations.EditTile({ id, version: v(id), ...to })),
  )

export const moveTile = (
  accountId: string,
  id: string,
  to: Fields<Operations.MoveTile, 'id' | 'version'>,
) =>
  change(accountId, (acting, v) =>
    Mapping.moveTile(acting, new Operations.MoveTile({ id, version: v(id), ...to })),
  )

export const swapTiles = (accountId: string, a: string, b: string) =>
  change(accountId, (acting, v) =>
    Mapping.swapTiles(acting, new Operations.SwapTiles({ a, aVersion: v(a), b, bVersion: v(b) })),
  )

export const deleteTile = (accountId: string, id: string) =>
  change(accountId, (acting, v) =>
    Mapping.deleteTile(acting, new Operations.DeleteTile({ id, version: v(id) })),
  )

export const createReference = (
  accountId: string,
  fields: Fields<Operations.CreateReference, 'parentVersion'>,
) =>
  change(accountId, (acting, v) =>
    Mapping.createReference(
      acting,
      new Operations.CreateReference({ ...fields, parentVersion: v(fields.parent) }),
    ),
  )

export const deleteReference = (
  accountId: string,
  fields: Fields<Operations.DeleteReference, 'parentVersion'>,
) =>
  change(accountId, (acting, v) =>
    Mapping.deleteReference(
      acting,
      new Operations.DeleteReference({ ...fields, parentVersion: v(fields.parent) }),
    ),
  )
