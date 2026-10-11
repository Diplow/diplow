// Mapping's Operations: each change to a System described as data, before it runs. One closed union
// of tagged classes, which the application service runs, the API layer's server functions and the
// MCP's write tools take without their tag, and the Conversation's timeline names. Pure: what an
// Operation may do to a System is the service's to decide.
import { Schema } from 'effect'

import { ContextDirection, contentBounds, Slot, TileId, Version } from '../entities'

/**
 * What a Tile says, bounded so nothing unbounded reaches the service, which says what a Title and a
 * Preview must be, on the field at fault (`checked`). The Preview's bound is in UTF-16 units, far above
 * the 350 characters Mapping counts, since one character a reader sees can take several.
 */
const Title = Schema.String.check(Schema.isMaxLength(contentBounds.title))
const Preview = Schema.String.check(Schema.isMaxLength(8_000))
const Body = Schema.String.check(Schema.isMaxLength(contentBounds.body))

/**
 * Adds a Tile in a free slot under a Tile of the System: a Branch, a Leaf, or a Tile of its Context.
 * `id` is the one its caller chose, so it can name the Tile before the answer comes: a Tile's already,
 * in any System, is refused `TileIdTaken`. Without one, Mapping makes it.
 */
export class CreateTile extends Schema.TaggedClass<CreateTile>()('CreateTile', {
  id: Schema.optionalKey(TileId),
  parent: TileId,
  slot: Slot,
  title: Title,
  preview: Preview,
  body: Body,
}) {}

/**
 * Changes what a Tile says: whichever of its Title, Preview and Body it gives. Every Operation on an
 * existing Tile carries the `version` its writer read of it, refused `TileChanged` once it moved.
 */
export class EditTile extends Schema.TaggedClass<EditTile>()('EditTile', {
  id: TileId,
  version: Version,
  title: Schema.optionalKey(Title),
  preview: Schema.optionalKey(Preview),
  body: Schema.optionalKey(Body),
}) {}

/** Moves a Tile, with everything below it, to a free slot under another Tile, or of its own parent. */
export class MoveTile extends Schema.TaggedClass<MoveTile>()('MoveTile', {
  id: TileId,
  version: Version,
  parent: TileId,
  slot: Slot,
}) {}

/** Two Tiles trade places, each with everything below it, each named with the Version read of it. */
export class SwapTiles extends Schema.TaggedClass<SwapTiles>()('SwapTiles', {
  a: TileId,
  aVersion: Version,
  b: TileId,
  bVersion: Version,
}) {}

/** Deletes a Tile and everything below it. */
export class DeleteTile extends Schema.TaggedClass<DeleteTile>()('DeleteTile', {
  id: TileId,
  version: Version,
}) {}

/**
 * Puts a Reference to `target` in a free Context slot of the Tile `parent`, named with the Version
 * read of it: a Reference has none of its own, so its writes count on the Tile whose slot they change.
 */
export class CreateReference extends Schema.TaggedClass<CreateReference>()('CreateReference', {
  parent: TileId,
  parentVersion: Version,
  slot: ContextDirection,
  target: TileId,
}) {}

/** Empties a Context slot of the Tile `parent`, named with the Version read of it, that holds a Reference. */
export class DeleteReference extends Schema.TaggedClass<DeleteReference>()('DeleteReference', {
  parent: TileId,
  parentVersion: Version,
  slot: ContextDirection,
}) {}

/**
 * An Operation: a change to a System described as data, before it runs. Closed: a change Mapping
 * gains is one more member here, and everything that lists them fails its typecheck until it follows.
 */
export const Operation = Schema.Union([
  CreateTile,
  EditTile,
  MoveTile,
  SwapTiles,
  DeleteTile,
  CreateReference,
  DeleteReference,
])
export type Operation = typeof Operation.Type

/**
 * An Operation by its name, its tag in camelCase (`swapTiles`): the application service's function
 * that runs it, and the server function and the MCP write that take it.
 */
export type OperationName = Uncapitalize<Operation['_tag']>

/** Each Operation's tag by its name: exhaustive, so a member the union gains fails here until it is added. */
const tags: { readonly [T in Operation['_tag'] as Uncapitalize<T>]: T } = {
  createTile: 'CreateTile',
  editTile: 'EditTile',
  moveTile: 'MoveTile',
  swapTiles: 'SwapTiles',
  deleteTile: 'DeleteTile',
  createReference: 'CreateReference',
  deleteReference: 'DeleteReference',
}

/** Whether a name, a mutation's key say, is an Operation's. */
export const isOperationName = (name: unknown): name is OperationName =>
  typeof name === 'string' && Object.hasOwn(tags, name)

/** An Operation's tag, by its name. */
export const tagOf = (name: OperationName): Operation['_tag'] => tags[name]
