// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request proves, by its Session or its Key, or fails with IAM's `SignedOut`, and a change in the
// transaction it opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import type { Content, Field } from '#/domains/mapping/entities'
import type { Placement } from '#/domains/mapping/operations'
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

/** A Context slot, as Mapping takes it: the id of the Tile that holds it and its slot, -1 to -6. */
type ReferenceSlot = Parameters<typeof Mapping.deleteReference>[1]

/** The Account's System: its Root, the user, with everything below it. */
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

export const createTile = (input: Parameters<typeof Mapping.createTile>[1]) =>
  changeForAccount((accountId) => Mapping.createTile(accountId, input))

export const editTile = ({ id, ...changes }: { id: string } & Partial<Content>) =>
  changeForAccount((accountId) => Mapping.editTile(accountId, id, changes))

export const moveTile = ({ id, ...to }: { id: string } & Placement) =>
  changeForAccount((accountId) => Mapping.moveTile(accountId, id, to))

export const swapTiles = ({ a, b }: { a: string; b: string }) =>
  changeForAccount((accountId) => Mapping.swapTiles(accountId, a, b))

export const deleteTile = ({ id }: { id: string }) =>
  changeForAccount((accountId) => Mapping.deleteTile(accountId, id))

export const createReference = (input: ReferenceSlot & { target: string }) =>
  changeForAccount((accountId) => Mapping.createReference(accountId, input))

export const deleteReference = (input: ReferenceSlot) =>
  changeForAccount((accountId) => Mapping.deleteReference(accountId, input))

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
