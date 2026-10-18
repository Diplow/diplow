// Mapping's server functions: one per operation, for the signed-in Account, which the middleware has
// already put on the context as its Session, `shipped`, a System hexframe ships whole, Help or the
// tutorial, for any visitor, `publicSystem`, the System holding a Tile Everyone reads, for anyone,
// who reaches a Tile, set and read by its owner from a Session alone, and a star found by its Title
// or by a link. Each validates its input, then hands its program (./programs.ts) to the
// helper; its type lists the errors it can fail with. `exportTile` answers its zip as a download
// (./files/download.ts); `importTiles` takes a form.
import { createServerFn } from '@tanstack/react-start'
import { Schema, Struct } from 'effect'

import { GrantChange, shippedRoots, StarQuery, TileId } from '#/domains/mapping/entities'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  SwapTiles,
} from '#/domains/mapping/operations'
import { locales } from '#/paraglide/runtime'

import { run } from '../server/run'
import { asDownload } from './files/download'
import { ImportPlace } from './places'
import * as Mapping from './programs'

/**
 * An Operation as its server function takes it: its fields, bounded by Mapping, without its tag,
 * which the function's name already says.
 */
const input = <F extends Schema.Struct.Fields>({ fields }: { readonly fields: F }) =>
  Schema.Struct(Struct.omit(fields, ['_tag']))

/** The Tile an export zips, by its id. */
export const TileExport = Schema.Struct({ id: TileId })

/**
 * A new Tile, in a free slot under a Tile of the System: a Branch, a Leaf or a Context Tile, under
 * the id its caller may choose, a UUID, so the client names it before the answer comes.
 */
export const NewTile = input(CreateTile)

/** A Tile's id and whichever of its Title, Preview and Body change. */
export const TileEdit = input(EditTile)

/** A Tile, and the free slot under another Tile, or its own parent, it moves to. */
export const TileMove = input(MoveTile)

/** Two Tiles, by their ids, which trade places. */
export const TileSwap = input(SwapTiles)

/** A Tile to delete, by its id. */
export const TileDelete = input(DeleteTile)

/** A Reference to put in a free Context slot: the Tile it points at, by its id. */
export const NewReference = input(CreateReference)

/** A Context slot, by the Tile that holds it. */
export const ReferenceSlot = input(DeleteReference)

/**
 * An import as a form uploads it: `upload`, the file, a zip of a folder (`as: 'Zip'`) named by its
 * folder, or one file alone (`as: 'File'`); and `place`, where it lands, as JSON. Its size is checked
 * by the program, before anything else, so a refusal says why.
 */
export const ImportUpload = Schema.fromFormData(
  Schema.Struct({
    upload: Schema.File,
    as: Schema.Literals(['Zip', 'File']),
    place: Schema.fromJsonString(ImportPlace),
  }),
)

/**
 * A System hexframe ships, by its Root, as Mapping names it, Help's or the tutorial's, in one of the
 * app's languages: the page's.
 */
export const ShippedRead = Schema.Struct({
  root: Schema.Literals(shippedRoots),
  language: Schema.Literals(locales),
})

/**
 * The System a read names, by its star, a UUID, as Mapping's `TileId` bounds it: none for the
 * Account's own.
 */
export const SystemRead = Schema.UndefinedOr(Schema.Struct({ system: TileId }))

/**
 * A System, flat, as the Account may see it, its Root and every Tile and Reference below it by id
 * that it may read, each Tile with its rights on it: its own, the Root added on the first read, or,
 * by its star, another's, from the star's card. The client builds its tree.
 */
export const system = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(SystemRead))
  .handler(({ data, context }) => run(context, Mapping.systemAt(data?.system)))

/** The Tile a link leads to, by its id, a UUID, as Mapping's `TileId` bounds it. */
export const TileVisit = Schema.Struct({ tile: TileId })

/**
 * Where a link to a Tile leads the Account, `/t/<id>`: the star of the System holding it, none for
 * its own, once it may read the Tile; a Tile kept from it is `TileNotFound`, as one that doesn't
 * exist.
 */
export const visit = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileVisit))
  .handler(({ data, context }) => run(context, Mapping.visit(data)))

/**
 * The System holding a Tile Everyone may read, by the Tile's id, flat, as anyone holding the link sees
 * it, signed in or not: what `/t/<id>` draws signed out, read-only (HEX-129). A Tile Everyone may not
 * read is `TileNotFound`, as one that doesn't exist; no Session is asked, nor used.
 */
export const publicSystem = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileVisit))
  .handler(({ data, context }) => run(context, Mapping.publicSystem(data)))

/**
 * A System hexframe ships whole, by its Root, in the language asked: its Root with everything below
 * it, Bodies included. Signed in or not, anyone reads it.
 */
export const shipped = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(ShippedRead))
  .handler(({ data, context }) => run(context, Mapping.shipped(data)))

/**
 * A Tile of the Account's System and everything below it, as a zip to download, `<slug>.zip`: on the
 * Root, the whole System. Its bytes stream as they are zipped, so an export past the 4.5 MB to
 * which Vercel caps a buffered answer still downloads; a failure answers as any server function's.
 */
export const exportTile = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileExport))
  .handler(async ({ data, context }) => asDownload(await run(context, Mapping.exportTile(data))))

/**
 * An import, uploaded as a form: a zip or one file, landed in a free slot or as the Root of an empty
 * System, all of it or nothing. It answers what it created and skipped, or every fault at once.
 */
export const importTiles = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(ImportUpload))
  .handler(({ data, context }) => run(context, Mapping.importTiles(data)))

export const createTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewTile))
  .handler(({ data, context }) => run(context, Mapping.createTile(data)))

export const editTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileEdit))
  .handler(({ data, context }) => run(context, Mapping.editTile(data)))

export const moveTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileMove))
  .handler(({ data, context }) => run(context, Mapping.moveTile(data)))

export const swapTiles = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileSwap))
  .handler(({ data, context }) => run(context, Mapping.swapTiles(data)))

export const deleteTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileDelete))
  .handler(({ data, context }) => run(context, Mapping.deleteTile(data)))

export const createReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewReference))
  .handler(({ data, context }) => run(context, Mapping.createReference(data)))

export const deleteReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(ReferenceSlot))
  .handler(({ data, context }) => run(context, Mapping.deleteReference(data)))

/**
 * Sets a Tile's Grant for Everyone, `read` or `none`, or removes it, `inherit`, so the Tile inherits
 * again, its input Mapping's `GrantChange`, never more than `read`: its owner's alone, from
 * a Session, never a Key's (`SessionRequired`); anyone else is `NotAllowed`, or `TileNotFound` where
 * they may not read the Tile, and a Tile hexframe ships is `ShippedReadOnly`.
 */
export const setGrant = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(GrantChange))
  .handler(({ data, context }) => run(context, Mapping.setGrant(data)))

/** The Tile whose reach is read, by its id, a UUID, as Mapping's `TileId` bounds it. */
export const TileReach = Schema.Struct({ tile: TileId })

/**
 * Who reaches a Tile, Everyone and each subject a Grant names, with its value and the Tile it comes
 * from: read by its owner alone, from a Session, as `setGrant` refuses everyone else.
 */
export const whoReaches = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileReach))
  .handler(({ data, context }) => run(context, Mapping.whoReaches(data)))

/** A star search: the Title, or part of one, trimmed, as Mapping's `StarQuery` bounds it. */
export const StarSearch = Schema.Struct({ query: StarQuery })

/**
 * The stars whose Title holds the query, whatever its case, by their cards, their Title and Preview,
 * those it starts first, a few at most, the Account's own left out: stars alone, never a Tile below
 * one, a private System's found by its card too. For the signed-in Account (HEX-130).
 */
export const findStars = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(StarSearch))
  .handler(({ data, context }) => run(context, Mapping.findStars(data)))

/**
 * Where a link to a Tile leads the star picker, by the Tile's id, the same `TileVisit` a link's
 * visit takes: the star of the System holding it, by its card, once the Account is shown the Tile,
 * its own said to be its own, nowhere for a Tile kept from it, as for none (HEX-130).
 */
export const starOfLink = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileVisit))
  .handler(({ data, context }) => run(context, Mapping.starOfLink(data)))
