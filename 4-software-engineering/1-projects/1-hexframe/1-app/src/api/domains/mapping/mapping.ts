// Mapping's server functions: one per operation, for the signed-in Account, which the middleware has
// already put on the context as its Session. Each validates its input, then hands its program
// (./programs.ts) to the helper; its type lists the errors it can fail with.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { contextDirections, directions } from '#/domains/mapping/tile'

import { run } from '../../server/run'
import * as Mapping from './programs'

/** A Tile's id: a UUID, as the tiles repository makes every one, so nothing else reaches the domain. */
const Id = Schema.String.check(Schema.isUUID())

/** A Child's Direction and a Context slot, as Mapping names them. */
const Direction = Schema.Literals(directions)
const ContextDirection = Schema.Literals(contextDirections)

/** Where a Tile stands under its parent: a Child's Direction, 1 to 6, or a Context slot, −1 to −6. */
export const Slot = Schema.Union([Direction, ContextDirection])

/**
 * What a Tile says, bounded here, so nothing unbounded reaches the domain: what a Title and a Preview
 * must be is Mapping's to say, on the field at fault. The Preview's bound is in UTF-16 units, far
 * above the 350 characters Mapping counts, since one character a reader sees can take several.
 */
const content = {
  title: Schema.String.check(Schema.isMaxLength(1_000)),
  preview: Schema.String.check(Schema.isMaxLength(8_000)),
  body: Schema.String.check(Schema.isMaxLength(100_000)),
}

/** A Tile, by its id. */
export const TileRef = Schema.Struct({ id: Id })

/** A new Tile, in a free slot under a Tile of the System: a Child, or a Tile of its Context. */
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

/** A Context slot, by the Tile that holds it. */
export const ReferenceSlot = Schema.Struct({ parent: Id, slot: ContextDirection })

/** A Reference to put in a free Context slot: the Tile it points at, by its id. */
export const NewReference = Schema.Struct({ parent: Id, slot: ContextDirection, target: Id })

/** A call that takes nothing. */
const Nothing = Schema.toStandardSchemaV1(Schema.Undefined)

/** The Account's System: its Root, the user, with everything below it, the Root added on the first read. */
export const system = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Mapping.system))

export const createTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewTile))
  .handler(({ data, context }) => run(context, Mapping.createTile(data)))

export const editTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileEdit))
  .handler(({ data, context }) => run(context, Mapping.editTile(data)))

export const moveTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileMove))
  .handler(({ data, context }) => run(context, Mapping.moveTile(data)))

export const deleteTile = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(TileRef))
  .handler(({ data, context }) => run(context, Mapping.deleteTile(data)))

export const createReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewReference))
  .handler(({ data, context }) => run(context, Mapping.createReference(data)))

export const deleteReference = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(ReferenceSlot))
  .handler(({ data, context }) => run(context, Mapping.deleteReference(data)))
