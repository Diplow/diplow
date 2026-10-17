// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request proves, by its Session or its Key, on the System the request names, for
// now always that Account's own, or fails with IAM's `SignedOut`, and a change in the transaction it
// opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import type { Field, ShippedRoot } from '#/domains/mapping/entities'
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

/**
 * The Account acting on its own System, as Mapping takes who acts and where: the actor, the Account,
 * its Groups and the owners it stands for, for now itself alone and in no Group, until IAM knows its
 * Organizations and Groups, and whether a Session proves the request, which only a server function
 * the user calls from the app says; the System, named by the Account's star. The one place the API
 * layer resolves both, for every program of every domain that reaches Mapping, fresh on every call,
 * for now always on the Account's own System. Every caller says whether a Session proves it: anything
 * acting for the user without one, a Key, a Turn's Key or the Assistant, says it doesn't.
 */
export const actingOnOwn = (accountId: string, { session }: { readonly session: boolean }) =>
  Effect.map(Mapping.starOf(accountId), (system): Mapping.Acting => ({
    actor: { account: accountId, groups: [], owners: [accountId], session },
    system,
  }))

/**
 * Runs an operation for the signed-in Account, the one the request proves, never one a caller sends,
 * on its own System (`actingOnOwn`), a Session said only when one proves the request.
 */
const forAccount = <A, E, R>(operation: (acting: Mapping.Acting) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.signedIn, ({ account, by }) =>
    Effect.flatMap(actingOnOwn(account.id, { session: by._tag === 'Session' }), operation),
  )

/** Runs a change for the signed-in Account, in one transaction: it commits whole, or not at all. */
const changeForAccount = <A, E, R>(operation: (acting: Mapping.Acting) => Effect.Effect<A, E, R>) =>
  forAccount((acting) => transactional(operation(acting)))

/** The Account's System, flat: its Root, the user, and every Tile and Reference below it by id. */
export const system = forAccount(Mapping.system)

/**
 * A System hexframe ships whole, by its Root, in the page's language, for any visitor: no Account
 * owns it, so it asks for none. The app's locales are the languages the shipped Systems are written
 * in, which its type requires.
 */
export const shipped = ({ root, language }: { root: ShippedRoot; language: Locale }) =>
  Mapping.shippedSystem(root, language)

/**
 * A Tile of the Account's System, its Root when no id is given, read to a depth with only the fields
 * asked: what the MCP's reads are made of, a batch `over` the System shown folded over it, the
 * Proposal of a Turn that drafts (`../assistant/proposal/`). An agent reads Help in English there.
 */
export const readTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.readTile<F>>[1], 'language'>,
) => forAccount((acting) => Mapping.readTile(acting, { ...input, language: 'en' }))

/**
 * A Tile of the Account's System, its Root when no id is given, opened: it with the fields asked, its
 * parent, and its Children and Context by Title and Preview, a batch `over` the System shown folded
 * over it, as `readTile` shows it. An agent reads Help in English here too.
 */
export const openTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.openTile<F>>[1], 'language'>,
) => forAccount((acting) => Mapping.openTile(acting, { ...input, language: 'en' }))

/**
 * A Tile of the Account's System and everything below it, zipped: the archive's name and its bytes,
 * streamed. A Reference whose Tile is left out links it on the site the request reached.
 */
export const exportTile = ({ id }: { id: string }) =>
  forAccount((acting) =>
    Effect.gen(function* () {
      const { url } = yield* HttpExchange
      return yield* Mapping.exportTile(acting, { id, link: tileLink(url) })
    }),
  )

/** An Operation as a server function decodes it: its fields, without the tag its name says. */
type Fields<O> = Omit<O, '_tag'>

/**
 * A create, under the id its caller chose, which a Tile of any System may have (`TileIdTaken`), or
 * under one Mapping makes.
 */
export const createTile = (input: Fields<CreateTile>) =>
  changeForAccount((acting) => Mapping.createTile(acting, new CreateTile(input)))

export const editTile = (input: Fields<EditTile>) =>
  changeForAccount((acting) => Mapping.editTile(acting, new EditTile(input)))

export const moveTile = (input: Fields<MoveTile>) =>
  changeForAccount((acting) => Mapping.moveTile(acting, new MoveTile(input)))

export const swapTiles = (input: Fields<SwapTiles>) =>
  changeForAccount((acting) => Mapping.swapTiles(acting, new SwapTiles(input)))

export const deleteTile = (input: Fields<DeleteTile>) =>
  changeForAccount((acting) => Mapping.deleteTile(acting, new DeleteTile(input)))

export const createReference = (input: Fields<CreateReference>) =>
  changeForAccount((acting) => Mapping.createReference(acting, new CreateReference(input)))

export const deleteReference = (input: Fields<DeleteReference>) =>
  changeForAccount((acting) => Mapping.deleteReference(acting, new DeleteReference(input)))

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
    forAccount((acting) =>
      Effect.gen(function* () {
        const { url } = yield* HttpExchange
        const bytes = new Uint8Array(yield* Effect.promise(() => upload.arrayBuffer()))
        const plan = yield* Landing.planImport({ as, name: upload.name, bytes }, tileOfLink(url))
        return yield* transactional(Landing.importTiles(acting, { plan, place }))
      }),
    ),
  )
