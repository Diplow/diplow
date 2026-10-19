// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request proves, by its Session or its Key, on the System the request names, its
// own unless a read names another, by its star or by one of its Tiles, or a change is made at a Tile
// of another (HEX-132), or fails with IAM's `SignedOut`, and a change in the transaction it opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import * as Iam from '#/domains/iam/iam'
import * as Groups from '#/domains/iam/organizations/groups'
import * as Organizations from '#/domains/iam/organizations/organizations'
import {
  type Actor,
  anyone,
  type Field,
  type GrantChange,
  groupsUnnamedIn,
  nowhere,
  type ShippedRoot,
  withGroups,
} from '#/domains/mapping/entities'
import { TileNotFound } from '#/domains/mapping/errors'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  madeAt,
  MoveTile,
  type Operation,
  SwapTiles,
} from '#/domains/mapping/operations'
import * as Landing from '#/domains/mapping/landing/landing'
import * as Mapping from '#/domains/mapping/mapping'
import * as Sharing from '#/domains/mapping/sharing/sharing'
import * as Stars from '#/domains/mapping/sharing/stars'
import type { Locale } from '#/paraglide/runtime'
import { HttpExchange } from '#/repositories/auth/auth'
import { transactional } from '#/repositories/database/database'

import * as Someone from '../assistant/someone/someone'
import { tileLink, tileOfLink } from './files/download'

/**
 * The Account acting on its own System, as Mapping takes who acts and where: the actor, the Account,
 * the Groups it belongs to and the owners it stands for, itself and the Organizations it is an admin
 * of, as IAM answers them now (`belonging`), each Organization's Members Group among its Groups, and
 * whether the change is the user's own, from a Session; the System, named by the Account's star. The
 * one place the API layer resolves both, for every program of every domain that reaches Mapping,
 * fresh on every call, never from a copy, so a member removed or an admin demoted holds from the next
 * one, on the Account's own System, which a request may then trade for another (`actingAt`,
 * `actingFor`). Every caller says whether its change is the user's own from a Session: a server
 * function a Session proves and the user's Undo do; a Key, a Turn's Key and the Assistant, an
 * accepted Proposal included, don't.
 */
export const actingOnOwn = (accountId: string, { session }: { readonly session: boolean }) =>
  Effect.map(
    Effect.all([Mapping.starOf(accountId), Organizations.belonging(accountId)]),
    ([system, { admins, groups }]): Mapping.Acting => ({
      actor: {
        account: accountId,
        groups,
        owners: [accountId, ...admins],
        session,
      } satisfies Actor,
      system,
    }),
  )

/**
 * The Account acting on the System a star names, someone else's, or on its own for none: what a
 * Turn's `elsewhere`, a Tile's `holding` and a Proposal's System name. The one rule of trading the
 * own System for another, which `actingFor` binds a Turn's Key's to its Turn's.
 */
export const actingAt = (own: Mapping.Acting, star: string | undefined): Mapping.Acting =>
  star === undefined ? own : { ...own, system: star }

/**
 * Where a request reaches: the Account acting on the System it works on (`acting`), and on its own
 * (`own`), for a program that answers whose System it read or tells someone else's write; and
 * whether its reads resolve a Reference to a Tile of another System for the Account there (Mapping's
 * `Across`), its pins.
 */
export interface Reach {
  readonly acting: Mapping.Acting
  readonly own: Mapping.Acting
  readonly across: boolean
}

/**
 * The System a Turn's Key works on: the one its Turn started in, someone else's when the Turn says so
 * (Assistant's `turnPlace`), read from the Turn on every call, never kept, once Mapping found the
 * Account still may run the agent at the Turn's Tile there (`agentStillAt`), so *@* taken back holds
 * from the next call, `TileNotFound` when it may not. The Account's own for a Turn at home, and for a
 * Key whose Turn is none of the Account's, as every Turn's Key was bound before one could start
 * elsewhere (HEX-134).
 */
const turnHome = (accountId: string, turnId: string, own: Mapping.Acting) =>
  Effect.flatMap(Assistant.turnPlace(accountId, turnId), (place) => {
    if (place?.elsewhere === undefined) return Effect.succeed(own)
    const acting = actingAt(own, place.elsewhere)
    return Effect.as(Mapping.agentStillAt(acting, place.location), acting)
  })

/**
 * Where the request of the signed-in Account reaches, the one rule of it, on the System a star names,
 * or where it works for none: the Account as `actingOnOwn` builds it, a Session said only when one
 * proves the request. A Session or an Account's Key acts on the System named, its own for none, and
 * reads what the Account may, pins included. A Turn's Key acts on the System its Turn started in
 * alone (`turnHome`), whatever else its Account may reach, its own included when the Turn started in
 * someone else's: any other named is `TileNotFound`, as a Tile Mapping keeps from it is; and it
 * resolves no pin, so its pins show unavailable.
 */
export const actingFor = (signed: Iam.SignedIn, star: string | undefined) =>
  Effect.gen(function* () {
    const own = yield* actingOnOwn(signed.account.id, { session: signed.by._tag === 'Session' })
    if (signed.by._tag !== 'TurnKey') {
      const reach: Reach = { acting: actingAt(own, star), own, across: true }
      return reach
    }
    const home = yield* turnHome(signed.account.id, signed.by.turnId, own)
    if (star !== undefined && star !== home.system) return yield* Effect.fail(new TileNotFound())
    const reach: Reach = { acting: home, own, across: false }
    return reach
  })

/**
 * Runs a program for the signed-in Account, the one the request proves, never one a caller sends,
 * where its request reaches (`actingFor`), on the System the star `named` answers names, where it
 * works when it answers none, looked up once the request is proven signed in, so nothing is looked
 * up for a request nothing proves, Mapping deciding what the Account may read and do there.
 */
const onSystem = <A, E, R, N, R2>(
  named: Effect.Effect<string | undefined, N, R2>,
  operation: (reach: Reach) => Effect.Effect<A, E, R>,
) =>
  Effect.flatMap(Iam.signedIn, (signed) =>
    Effect.flatMap(
      Effect.flatMap(named, (star) => actingFor(signed, star)),
      operation,
    ),
  )

/** Runs a program for the signed-in Account where its request works, naming no System (`onSystem`). */
const forAccount = <A, E, R>(operation: (reach: Reach) => Effect.Effect<A, E, R>) =>
  onSystem(Effect.succeed(undefined), operation)

/**
 * Runs a read from one Tile for the signed-in Account on the System it works on (Mapping's
 * `workingAt`): the one holding it, where the request works when no id is given, or for an id no
 * System holds, or a Tile hexframe ships, which Mapping reads by its id alone (`onSystem`).
 */
const fromTile = <A, E, R>(
  id: string | undefined,
  operation: (reach: Reach) => Effect.Effect<A, E, R>,
) => onSystem(id === undefined ? Effect.succeed(undefined) : Mapping.workingAt(id), operation)

/**
 * Runs a change for the signed-in Account, the Operation `made` makes, on the System the Tile it is
 * made at works on (Mapping's `madeAt`, then `workingAt`, then `actingFor`), in one transaction,
 * which commits whole or not at all: its own, by the Operation's own function, `own`; or someone
 * else's, a Grant letting it write there, by `../assistant/someone/`, where Mapping decides what it
 * may do and the owner's timeline tells it with what undoes it, its answer the Tile for a create or
 * an edit (`answer`). An id no System holds is decided where the request works, `TileNotFound`
 * there, and a Tile hexframe ships too, which every write's schema refuses first, Mapping's
 * `Shipped` there for one a schema let through. A Turn's Key changes the System its Turn started in
 * alone: another is `TileNotFound`, as for a Tile kept from it.
 */
const changeAt = <O extends Operation, A, E, R>(
  made: () => O,
  own: (acting: Mapping.Acting, operation: O) => Effect.Effect<A, E, R>,
  answer: (tile: Answered | undefined) => Effect.Effect<A>,
) =>
  Effect.gen(function* () {
    const signed = yield* Iam.signedIn
    // Made once the request is proven, as the fields a caller sent are only decoded then.
    const operation = made()
    const reach = yield* actingFor(signed, yield* Mapping.workingAt(madeAt(operation)))
    if (reach.acting.system === reach.own.system) {
      return yield* transactional(own(reach.own, operation))
    }
    return yield* transactional(
      Effect.flatMap(Someone.writtenInAnothers(signed, reach, operation), answer),
    )
  })

/** The Tile a create or an edit answers, as it now stands, with its Version. */
type Answered = Effect.Success<ReturnType<typeof Mapping.editTile>>

/** A create's or an edit's answer: the Tile it made or changed, which such a write always answers. */
const answeredTile = (tile: Answered | undefined) =>
  tile === undefined
    ? Effect.die(new Error('A create or an edit answered no Tile'))
    : Effect.succeed(tile)

/** What a write that answers no Tile answers: nothing. */
const nothing = () => Effect.void

/**
 * A System, flat, as the Account may see it: by its star, what the Account may read of it, from the
 * star's card; its own when none is named, its Root, the user, and every Tile and Reference below it
 * by id. A Tile hexframe ships, mounted in the Hexframe Organization's or pinned, in the page's
 * language, English when none is given.
 */
export const systemAt = (star: string | undefined, language?: Locale) =>
  onSystem(Effect.succeed(star), ({ acting, across }) =>
    Mapping.system(acting, { across, language }),
  )

/** The Account's own System, flat, whole: its Root, the user, and every Tile and Reference below it. */
export const system = systemAt(undefined)

/**
 * Where a link to a Tile leads the Account (`/t/<id>`): the star of the System holding it, none when
 * it is the Account's own, once Mapping found the Account is shown the Tile (`shownTile`: one it may
 * read, or the star's card, which anyone sees); `TileNotFound` otherwise, a Tile kept from it
 * answered as one that doesn't exist.
 */
export const visit = ({ tile }: { tile: string }) =>
  onSystem(Mapping.holding(tile), ({ acting, own }) => {
    const led: { readonly system?: string } =
      acting.system === own.system ? {} : { system: acting.system }
    return Effect.as(Mapping.shownTile(acting, tile), led)
  })

/**
 * The stars whose Title holds the query, by their cards, those it starts first, a few at most, the
 * Account's own left out: stars alone, a private System's included, whose card anyone sees, never a
 * Tile below one. What the star picker finds someone by (HEX-130).
 */
export const findStars = ({ query }: { query: string }) =>
  forAccount(({ acting }) => Stars.starsTitled(acting, query))

/**
 * Where a link to a Tile leads the star picker (HEX-130), on the System holding it, as `visit` names
 * it (`onSystem`): Mapping's `linkedStar`, its star by its card once the Account is shown the Tile, its
 * own said to be its own, nowhere for a Tile kept from it or none. A Turn's Key, which `actingFor` keeps
 * from every other System, is led nowhere too, an answer rather than a refusal, as Mapping answers.
 */
export const starOfLink = ({ tile }: { tile: string }) =>
  Effect.catchTag(
    onSystem(Mapping.holding(tile), ({ acting, own }) =>
      Stars.linkedStar(acting, own.system, tile),
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
 * the read-only canvas of `/t/<id>` draws signed out (HEX-129), a Tile hexframe ships among it in the
 * page's language, English when none is given, Help's and the tutorial's under the Hexframe star.
 */
export const publicSystem = ({ tile, language }: { tile: string; language?: Locale | undefined }) =>
  forEveryone(tile, (acting) => Mapping.system(acting, { language }))

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
) =>
  fromTile(input.id, ({ acting, across }) =>
    Mapping.readTile(acting, { ...input, across, language: 'en' }),
  )

/**
 * A Tile of the System holding it, as the Account may read it (`fromTile`), the Account's own Root
 * when no id is given, opened: it with the fields asked, its parent, and its Children and Context by
 * Title and Preview, a batch `over` the System shown folded over it, as `readTile` shows it. An agent
 * reads Help in English here too.
 */
export const openTile = <F extends Field>(
  input: Omit<Parameters<typeof Mapping.openTile<F>>[1], 'language'>,
) =>
  fromTile(input.id, ({ acting, across }) =>
    Mapping.openTile(acting, { ...input, across, language: 'en' }),
  )

/**
 * A Tile of the Account's System and everything below it, zipped: the archive's name and its bytes,
 * streamed. A Reference whose Tile is left out links it on the site the request reached, a pin while
 * the Account may read its Tile, but by a Turn's Key, which resolves none (`actingFor`).
 */
export const exportTile = ({ id }: { id: string }) =>
  forAccount(({ acting, across }) =>
    Effect.gen(function* () {
      const { url } = yield* HttpExchange
      return yield* Mapping.exportTile(acting, { id, link: tileLink(url), across })
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
      ([own, star]) => operation(actingAt(own, star)),
    ),
  )

/**
 * The Grant a change sets, as Mapping keeps it: one naming the star of an Organization's System is
 * for its Members Group, every one of its members (HEX-136); one naming a Group by its id, set to
 * anything but `inherit`, only once IAM found the Account the request's Session proves may name it,
 * a member of its Organization (`shareableGroup`, `GroupNotFound` otherwise, a deleted Group's
 * included), while a Grant to any Group may be removed, a dead one's too (HEX-137); any other as it
 * came, Mapping finding the Account a star names, or refusing a star that names nothing.
 */
const grantOf = (change: GrantChange) =>
  Effect.gen(function* () {
    if (change.subject._tag === 'Everyone') return change
    if (change.subject._tag === 'Group') {
      if (change.value !== 'inherit') yield* Groups.shareableGroup(change.subject.id)
      return change
    }
    const owner = yield* Effect.option(Mapping.ownerOf(change.subject.star))
    if (Option.isNone(owner) || !(yield* Organizations.isOrganization(owner.value))) return change
    const members = { _tag: 'Group', id: Organizations.membersGroupOf(owner.value) } as const
    const grant: GrantChange = { tile: change.tile, subject: members, value: change.value }
    return grant
  })

/**
 * A Tile's Grant for Everyone set, `read` or `none`, or for someone named by their star, or a Group
 * by its id, any value, or removed, `inherit`, by the owner of the System holding it, from a Session,
 * in one transaction: an Organization named by its star is its Members Group (`grantOf`). No
 * Operation: it is neither proposed nor undone. One that first opens the Tile to an Account
 * publishes Mapping's `TileShared`, which `../assistant/recording.ts` tells in their timeline once
 * the transaction committed; no other change of who reaches a Tile is told.
 */
export const setGrant = (change: GrantChange) =>
  fromSession(change.tile, (acting) =>
    transactional(Effect.flatMap(grantOf(change), (grant) => Sharing.grant(acting, grant))),
  )

/**
 * Who reaches a Tile, each subject with its value and the Tile it comes from, each Account by its
 * star's card, an Organization's Members by its star's, and each Group of an Organization's own by
 * its name, IAM's, and its Organization's star's card, read now, where the reader is one of that
 * Organization's members, with no name otherwise, so its name stays its members' (IAM's
 * `groupsSeen`); a Group IAM no longer knows, a deleted one, left out, but where its Grant is set on
 * the Tile, said gone so the owner may clear it (Mapping's `withGroups`, HEX-137). Read by the owner
 * of the System holding it, from a Session.
 */
export const whoReaches = ({ tile }: { tile: string }) =>
  fromSession(tile, (acting) =>
    Effect.gen(function* () {
      const reaching = yield* Sharing.whoReaches(acting, tile)
      const seen = yield* Groups.groupsSeen(groupsUnnamedIn(reaching))
      const shown = [...seen.values()].flatMap((group) => (group ? [group.organization] : []))
      const stars = yield* Stars.starsOf(shown)
      const cards = new Map(
        [...seen].map(([id, group]) => [
          id,
          group && { name: group.name, organization: stars.get(group.organization) },
        ]),
      )
      return withGroups(reaching, tile, cards)
    }),
  )

/** An Operation as a server function decodes it: its fields, without the tag its name says. */
type Fields<O> = Omit<O, '_tag'>

/**
 * A create, under the id its caller chose, which a Tile of any System may have (`TileIdTaken`), or
 * under one Mapping makes, under a Tile of whichever System holds it (`changeAt`).
 */
export const createTile = (input: Fields<CreateTile>) =>
  changeAt(() => new CreateTile(input), Mapping.createTile, answeredTile)

export const editTile = (input: Fields<EditTile>) =>
  changeAt(() => new EditTile(input), Mapping.editTile, answeredTile)

export const moveTile = (input: Fields<MoveTile>) =>
  changeAt(() => new MoveTile(input), Mapping.moveTile, nothing)

export const swapTiles = (input: Fields<SwapTiles>) =>
  changeAt(() => new SwapTiles(input), Mapping.swapTiles, nothing)

export const deleteTile = (input: Fields<DeleteTile>) =>
  changeAt(() => new DeleteTile(input), Mapping.deleteTile, nothing)

export const createReference = (input: Fields<CreateReference>) =>
  changeAt(() => new CreateReference(input), Mapping.createReference, nothing)

export const deleteReference = (input: Fields<DeleteReference>) =>
  changeAt(() => new DeleteReference(input), Mapping.deleteReference, nothing)

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
    forAccount(({ acting }) =>
      Effect.gen(function* () {
        const { url } = yield* HttpExchange
        const bytes = new Uint8Array(yield* Effect.promise(() => upload.arrayBuffer()))
        const plan = yield* Landing.planImport({ as, name: upload.name, bytes }, tileOfLink(url))
        return yield* transactional(Landing.importTiles(acting, { plan, place }))
      }),
    ),
  )
