// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request proves, by its Session or its Key, or fails with IAM's `SignedOut`, and a change in the
// transaction it opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import type { Field } from '#/domains/mapping/entities'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  SwapTiles,
} from '#/domains/mapping/operations'
import * as Landing from '#/domains/mapping/landing/landing'
import * as Mapping from '#/domains/mapping/mapping'
import type { Locale } from '#/paraglide/runtime'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import { tileLink, tileOfLink } from './files/download'

/** Runs an operation for the signed-in Account: the one the request proves, never one a caller sends. */
const forAccount = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.signedIn, ({ account }) => operation(account.id))

/** Runs a change for the signed-in Account, in one transaction: it commits whole, or not at all. */
const changeForAccount = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  forAccount((accountId) => transactional(operation(accountId)))

/** The Account's System, flat: its Root, the user, and every Tile and Reference below it by id. */
export const system = forAccount(Mapping.system)

/**
 * Help whole, in the page's language, for any visitor: no Account reads it, so it asks for none. The
 * app's locales are the languages Help is written in, which its type requires.
 */
export const help = ({ language }: { language: Locale }) => Mapping.helpSystem(language)

/**
 * A Tile of the Account's System, its Root when no id is given, read to a depth with only the fields
 * asked: what the MCP's reads are made of. An agent reads Help in English there.
 */
export const readTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.readTile<F>>[1], 'language'>,
) => forAccount((accountId) => Mapping.readTile(accountId, { ...input, language: 'en' }))

/**
 * A Tile of the Account's System, its Root when no id is given, opened: it with the fields asked, its
 * parent, and its Children and Context by Title and Preview. An agent reads Help in English here too.
 */
export const openTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.openTile<F>>[1], 'language'>,
) => forAccount((accountId) => Mapping.openTile(accountId, { ...input, language: 'en' }))

/**
 * A Tile of the Account's System and everything below it, zipped: the archive's name and its bytes,
 * streamed. A Reference whose Tile is left out links it on the site the request reached.
 */
export const exportTile = ({ id }: { id: string }) =>
  forAccount((accountId) =>
    Effect.gen(function* () {
      const { url } = yield* HttpExchange
      return yield* Mapping.exportTile(accountId, { id, link: tileLink(url) })
    }),
  )

/** An Operation as a server function decodes it: its fields, without the tag its name says. */
type Fields<O> = Omit<O, '_tag'>

/**
 * A create, under the id its caller chose, which a Tile of any System may have (`TileIdTaken`), or
 * under one Mapping makes.
 */
export const createTile = (input: Fields<CreateTile>) =>
  changeForAccount((accountId) => Mapping.createTile(accountId, new CreateTile(input)))

export const editTile = (input: Fields<EditTile>) =>
  changeForAccount((accountId) => Mapping.editTile(accountId, new EditTile(input)))

export const moveTile = (input: Fields<MoveTile>) =>
  changeForAccount((accountId) => Mapping.moveTile(accountId, new MoveTile(input)))

export const swapTiles = (input: Fields<SwapTiles>) =>
  changeForAccount((accountId) => Mapping.swapTiles(accountId, new SwapTiles(input)))

export const deleteTile = (input: Fields<DeleteTile>) =>
  changeForAccount((accountId) => Mapping.deleteTile(accountId, new DeleteTile(input)))

export const createReference = (input: Fields<CreateReference>) =>
  changeForAccount((accountId) => Mapping.createReference(accountId, new CreateReference(input)))

export const deleteReference = (input: Fields<DeleteReference>) =>
  changeForAccount((accountId) => Mapping.deleteReference(accountId, new DeleteReference(input)))

/** An upload, as the import's server function decodes it: the file, what it is, where it lands. */
interface ImportUpload {
  readonly upload: File
  readonly as: Landing.Upload['as']
  readonly place: Landing.ImportPlace
}

/**
 * An import: an upload past Mapping's 4 MB refused before anything else, by its size, then, for the signed-in Account, the
 * upload read into a plan, an app link on the site the request reached read back as its Tile's id,
 * and the plan landed in one transaction. The report says what it created and what it skipped.
 */
export const importTiles = ({ upload, as, place }: ImportUpload) =>
  Effect.andThen(
    Landing.fitsUpload(upload.size),
    forAccount((accountId) =>
      Effect.gen(function* () {
        const { url } = yield* HttpExchange
        const bytes = new Uint8Array(yield* Effect.promise(() => upload.arrayBuffer()))
        const plan = yield* Landing.planImport({ as, name: upload.name, bytes }, tileOfLink(url))
        return yield* transactional(Landing.importTiles(accountId, { plan, place }))
      }),
    ),
  )
