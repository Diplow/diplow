// Mapping's server functions: one per operation, for the signed-in Account, which the middleware has
// already put on the context as its Session, and `shipped`, a System hexframe ships whole, Help or the
// tutorial, for any visitor. Each validates its input, then hands its program (./programs.ts) to the
// helper; its type lists the errors it can fail with. `exportTile` answers its zip as a download
// (./files/download.ts); `importTiles` takes a form.
import { createServerFn } from '@tanstack/react-start'
import { Schema, Struct } from 'effect'

import { shippedRoots, TileId } from '#/domains/mapping/entities'
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
