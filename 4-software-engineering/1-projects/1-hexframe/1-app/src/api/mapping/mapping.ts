// Mapping's server functions: one per operation, for the signed-in Account, which the middleware has
// already put on the context as its Session, and `help`, Help whole, for any visitor. Each validates
// its input, then hands its program (./programs.ts) to the helper; its type lists the errors it can
// fail with. `exportTile` answers its zip as a download (./download.ts); `importTiles` takes a form.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { contentBounds, contextDirections, directions } from '#/domains/mapping/tile'
import { locales } from '#/paraglide/runtime'

import { run } from '../server/run'
import { asDownload } from './download'
import * as Mapping from './programs'

/** A Tile's id: a UUID, as the tiles repository makes every one, so nothing else reaches the domain. */
export const Id = Schema.String.check(Schema.isUUID())

/** A Child's Direction and a Context slot, as Mapping names them. */
const Direction = Schema.Literals(directions)
const ContextDirection = Schema.Literals(contextDirections)

/** A Leaf's slot: one of its parent's six Leaf Directions, beside the six its Branches take. */
const LeafSlot = Schema.Struct({ leaf: Direction })

/**
 * Where a Tile stands under its parent: a Branch's Direction, 1 to 6, a Leaf's, `{ leaf: 1 }` to
 * `{ leaf: 6 }`, or a Context slot, −1 to −6.
 */
export const Slot = Schema.Union([Direction, LeafSlot, ContextDirection])

/**
 * What a Tile says, bounded here, so nothing unbounded reaches the domain: what a Title and a Preview
 * must be is Mapping's to say, on the field at fault. The Preview's bound is in UTF-16 units, far
 * above the 350 characters Mapping counts, since one character a reader sees can take several.
 */
const content = {
  title: Schema.String.check(Schema.isMaxLength(contentBounds.title)),
  preview: Schema.String.check(Schema.isMaxLength(8_000)),
  body: Schema.String.check(Schema.isMaxLength(contentBounds.body)),
}

/** A Tile, by its id. */
export const TileRef = Schema.Struct({ id: Id })

/** A new Tile, in a free slot under a Tile of the System: a Branch, a Leaf or a Context Tile. */
export const NewTile = Schema.Struct({ parent: Id, slot: Slot, ...content })

/** A Tile's id and whichever of its Title, Preview and Body change. */
export const TileEdit = Schema.Struct({
  id: Id,
  title: Schema.optionalKey(content.title),
  preview: Schema.optionalKey(content.preview),
  body: Schema.optionalKey(content.body),
})

/** A Tile, and the free slot under another Tile, or its own parent, it moves to. */
export const TileMove = Schema.Struct({ id: Id, parent: Id, slot: Slot })

/** Two Tiles, by their ids, which trade places. */
export const TileSwap = Schema.Struct({ a: Id, b: Id })

/** A Context slot, by the Tile that holds it. */
export const ReferenceSlot = Schema.Struct({ parent: Id, slot: ContextDirection })

/** A Reference to put in a free Context slot: the Tile it points at, by its id. */
export const NewReference = Schema.Struct({ parent: Id, slot: ContextDirection, target: Id })

/**
 * Where an import lands: a free slot under a Tile of the System, a Branch's, a Leaf's or a Context
 * slot, or the Root of an empty System.
 */
const ImportPlace = Schema.Union([
  Schema.Struct({ _tag: Schema.tag('Slot'), parent: Id, slot: Slot }),
  Schema.Struct({ _tag: Schema.tag('Root') }),
])

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

/** Help, in one of the app's languages: the page's, from its URL. */
export const HelpLanguage = Schema.Struct({ language: Schema.Literals(locales) })

/** A call that takes nothing. */
const Nothing = Schema.toStandardSchemaV1(Schema.Undefined)

/** The Account's System: its Root, the user, with everything below it, the Root added on the first read. */
export const system = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Mapping.system))

/**
 * Help whole, in the language asked: its Root with everything below it, Bodies included. Signed in or
 * not, anyone reads it.
 */
export const help = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(HelpLanguage))
  .handler(({ data, context }) => run(context, Mapping.help(data)))

/**
 * A Tile of the Account's System and everything below it, as a zip to download, `<slug>.zip`: on the
 * Root, the whole System. Its bytes stream as they are zipped, so an export past the 4.5 MB to
 * which Vercel caps a buffered answer still downloads; a failure answers as any server function's.
 */
export const exportTile = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(TileRef))
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
  .validator(Schema.toStandardSchemaV1(TileRef))
  .handler(({ data, context }) => run(context, Mapping.deleteTile(data)))

export const createReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewReference))
  .handler(({ data, context }) => run(context, Mapping.createReference(data)))

export const deleteReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(ReferenceSlot))
  .handler(({ data, context }) => run(context, Mapping.deleteReference(data)))
