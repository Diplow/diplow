// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request proves, by its Session or its Key, on the System the request names, its
// own unless a read names another, by its star or by one of its Tiles, or fails with IAM's
// `SignedOut`, and a change in the transaction it opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import {
  type Actor,
  anyone,
  type Field,
  type GrantChange,
  nowhere,
  type ShippedRoot,
} from '#/domains/mapping/entities'
import { TileNotFound } from '#/domains/mapping/errors'
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
import * as Sharing from '#/domains/mapping/sharing/sharing'
import * as Stars from '#/domains/mapping/sharing/stars'
import type { Locale } from '#/paraglide/runtime'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import { tileLink, tileOfLink } from './files/download'

/**
 * The Account acting on its own System, as Mapping takes who acts and where: the actor, the Account,
 * its Groups and the owners it stands for, for now itself alone and in no Group, until IAM knows its
 * Organizations and Groups, and whether the change is the user's own, from a Session; the System,
 * named by the Account's star. The one place the API layer resolves both, for every program of every
 * domain that reaches Mapping, fresh on every call, on the Account's own System, which a read may
 * then trade for another (`onSystem`). Every caller says whether its change is the user's own from a
 * Session: a server function a Session proves and the user's Undo do; a Key, a Turn's Key and the
 * Assistant, an accepted Proposal included, don't.
 */
export const actingOnOwn = (accountId: string, { session }: { readonly session: boolean }) =>
  Effect.map(Mapping.starOf(accountId), (system): Mapping.Acting => ({
    actor: { account: accountId, groups: [], owners: [accountId], session } satisfies Actor,
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

/**
 * Runs a read for the signed-in Account on the System the star `named` answers names, its own when
 * it answers none, looked up once the request is proven signed in, so nothing is looked up for a
 * request nothing proves,
 * Mapping deciding what the Account may read there. A Turn's Key reads the System its Turn started in
 * alone, its Account's own, whatever else the Account may read: another it names is `TileNotFound`,
 * as a Tile Mapping keeps from it is. The read is handed the Account acting on its own System too,
 * for one that answers whose System it read.
 */
const onSystem = <A, E, R, N, R2>(
  named: (signed: Iam.SignedIn) => Effect.Effect<string | undefined, N, R2>,
  operation: (acting: Mapping.Acting, own: Mapping.Acting) => Effect.Effect<A, E, R>,
) =>
  Effect.flatMap(Iam.signedIn, (signed) =>
    Effect.flatMap(
      Effect.all([
        actingOnOwn(signed.account.id, { session: signed.by._tag === 'Session' }),
        named(signed),
      ]),
      ([own, star]): Effect.Effect<A, E | TileNotFound, R> => {
        if (star === undefined || star === own.system) return operation(own, own)
        if (signed.by._tag === 'TurnKey') return Effect.fail(new TileNotFound())
        return operation({ ...own, system: star }, own)
      },
    ),
  )

/**
 * Runs a read from one Tile for the signed-in Account on the System holding it (`Mapping.holding`),
 * its own when no id is given, or for an id no System holds, a shipped System's included, which
 * Mapping reads by its id alone (`onSystem`).
 */
const fromTile = <A, E, R>(
  id: string | undefined,
  operation: (acting: Mapping.Acting) => Effect.Effect<A, E, R>,
) => onSystem(() => (id === undefined ? Effect.succeed(undefined) : Mapping.holding(id)), operation)

/** Runs a change for the signed-in Account, in one transaction: it commits whole, or not at all. */
const changeForAccount = <A, E, R>(operation: (acting: Mapping.Acting) => Effect.Effect<A, E, R>) =>
  forAccount((acting) => transactional(operation(acting)))

/**
 * A System, flat, as the Account may see it: by its star, what the Account may read of it, from the
 * star's card; its own when none is named, its Root, the user, and every Tile and Reference below it
 * by id.
 */
export const systemAt = (star: string | undefined) =>
  onSystem(() => Effect.succeed(star), Mapping.system)

/** The Account's own System, flat, whole: its Root, the user, and every Tile and Reference below it. */
export const system = systemAt(undefined)

/**
 * Where a link to a Tile leads the Account (`/t/<id>`): the star of the System holding it, none when
 * it is the Account's own, once Mapping found the Account is shown the Tile (`shownTile`: one it may
 * read, or the star's card, which anyone sees); `TileNotFound` otherwise, a Tile kept from it
 * answered as one that doesn't exist.
 */
export const visit = ({ tile }: { tile: string }) =>
  onSystem(
    () => Mapping.holding(tile),
    (acting, own) => {
      const led: { readonly system?: string } =
        acting.system === own.system ? {} : { system: acting.system }
      return Effect.as(Mapping.shownTile(acting, tile), led)
    },
  )

/**
 * The stars whose Title holds the query, by their cards, those it starts first, a few at most, the
 * Account's own left out: stars alone, a private System's included, whose card anyone sees, never a
 * Tile below one. What the star picker finds someone by (HEX-130).
 */
export const findStars = ({ query }: { query: string }) =>
  forAccount((acting) => Stars.starsTitled(acting, query))

/**
 * Where a link to a Tile leads the star picker (HEX-130), on the System holding it, as `visit` names
 * it (`onSystem`): Mapping's `linkedStar`, its star by its card once the Account is shown the Tile, its
 * own said to be its own, nowhere for a Tile kept from it or none. A Turn's Key, which `onSystem` keeps
 * from every other System, is led nowhere too, an answer rather than a refusal, as Mapping answers.
 */
export const starOfLink = ({ tile }: { tile: string }) =>
  Effect.catchTag(
    onSystem(
      () => Mapping.holding(tile),
      (acting, own) => Stars.linkedStar(acting, own.system, tile),
    ),
    'TileNotFound',
    () => Effect.succeed(nowhere),
  )

/**
 * Runs a read for anyone holding the link to a Tile, signed in or not, proving nothing (Mapping's
 * `anyone`, whom Everyone alone covers), on the System holding it, once Mapping found Everyone may
 * read it (`ownTile`): a Tile it may not, a star's card included, is `TileNotFound`, as one that
 * doesn't exist, and so is an id no System holds. No Session nor Key is asked, and none is used, so
 * a signed-in caller reads it as anyone would.
 */
const forEveryone = <A, E, R>(
  tile: string,
  read: (acting: Mapping.Acting) => Effect.Effect<A, E, R>,
) =>
  Effect.flatMap(Mapping.holding(tile), (star) => {
    if (star === undefined) return Effect.fail(new TileNotFound())
    const acting: Mapping.Acting = { actor: anyone, system: star }
    return Effect.andThen(Mapping.ownTile(acting, tile), read(acting))
  })

/**
 * The System holding a public Tile, flat, as anyone may see it, from its star's card (`Seen`): what
 * the read-only canvas of `/t/<id>` draws signed out (HEX-129).
 */
export const publicSystem = ({ tile }: { tile: string }) => forEveryone(tile, Mapping.system)

/**
 * A public Tile opened as anyone may read it, as the MCP's `open_tile` opens one (`Mapping.openTile`,
 * the same read): its Title, Preview and Body, its parent, and its Branches, Leaves and Context by
 * Title and Preview, what Everyone may not read of them left out. What `/t/<id>.md` writes as Markdown.
 */
export const publicTile = ({ tile }: { tile: string }) =>
  forEveryone(tile, (acting) =>
    Mapping.openTile(acting, { id: tile, fields: ['title', 'preview', 'body'], language: 'en' }),
  )

/**
 * A System hexframe ships whole, by its Root, in the page's language, for any visitor: no Account
 * owns it, so it asks for none. The app's locales are the languages the shipped Systems are written
 * in, which its type requires.
 */
export const shipped = ({ root, language }: { root: ShippedRoot; language: Locale }) =>
  Mapping.shippedSystem(root, language)

/**
 * A Tile of the System holding it, as the Account may read it (`fromTile`), the Account's own Root
 * when no id is given, read to a depth with only the fields asked: what the MCP's reads are made of,
 * a batch `over` the System shown folded over it, the Proposal of a Turn that drafts
 * (`../assistant/proposal/`), on its Account's own System. An agent reads Help in English there.
 */
export const readTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.readTile<F>>[1], 'language'>,
) => fromTile(input.id, (acting) => Mapping.readTile(acting, { ...input, language: 'en' }))

/**
 * A Tile of the System holding it, as the Account may read it (`fromTile`), the Account's own Root
 * when no id is given, opened: it with the fields asked, its parent, and its Children and Context by
 * Title and Preview, a batch `over` the System shown folded over it, as `readTile` shows it. An agent
 * reads Help in English here too.
 */
export const openTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.openTile<F>>[1], 'language'>,
) => fromTile(input.id, (acting) => Mapping.openTile(acting, { ...input, language: 'en' }))

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

/**
 * Runs a read or a change of who reaches a Tile for the Account the request's Session proves, never a
 * Key's nor a Turn's Key's (IAM's `sessionOnly`, `SessionRequired`), on the System holding the Tile
 * (`Mapping.holding`), its own for an id none holds: Mapping refuses anyone but the owner there.
 */
const fromSession = <A, E, R>(
  tile: string,
  operation: (acting: Mapping.Acting) => Effect.Effect<A, E, R>,
) =>
  Effect.flatMap(Iam.sessionOnly, ({ account }) =>
    Effect.flatMap(
      Effect.all([actingOnOwn(account.id, { session: true }), Mapping.holding(tile)]),
      ([own, star]) => operation(star === undefined ? own : { ...own, system: star }),
    ),
  )

/**
 * A Tile's Grant for Everyone set, `read` or `none`, or for someone named by their star, any value,
 * or removed, `inherit`, by the owner of the System holding it, from a Session, in one transaction.
 * No Operation: it is neither proposed nor undone. One that first opens the Tile to someone
 * publishes Mapping's `TileShared`, which `../assistant/recording.ts` tells in their timeline once
 * the transaction committed; no other change of who reaches a Tile is told.
 */
export const setGrant = (change: GrantChange) =>
  fromSession(change.tile, (acting) => transactional(Sharing.grant(acting, change)))

/**
 * Who reaches a Tile, each subject with its value and the Tile it comes from, each Account by its
 * star's card, read by the owner of the System holding it, from a Session.
 */
export const whoReaches = ({ tile }: { tile: string }) =>
  fromSession(tile, (acting) => Sharing.whoReaches(acting, tile))

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
