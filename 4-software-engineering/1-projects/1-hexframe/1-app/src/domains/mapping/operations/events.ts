// Mapping's events: what an Operation did to a System, facts in the past tense, which `decide` makes
// and `evolve` applies. Each says what changed in the System and nothing of who changed it: no
// Account, no Session, no Key, which the API layer puts on the bus's envelope. Pure.
import { Schema } from 'effect'

import { ContextDirection, Frontmatter, Name, Slot, TileConfig } from '../entities'

/**
 * What a Tile keeps from the file it was imported from, each part by the Schema that checked it before
 * it was stored (`entities/kept/`), so an event holds nothing a write would refuse.
 */
const kept = {
  name: Schema.optionalKey(Name),
  config: Schema.optionalKey(TileConfig),
  frontmatter: Schema.optionalKey(Frontmatter),
}

/**
 * A Tile was created in a free slot under `parent`, under the id `id`, saying what it says, with what
 * it kept from its file when an import made it.
 */
export class TileCreated extends Schema.TaggedClass<TileCreated>()('TileCreated', {
  id: Schema.String,
  parent: Schema.String,
  slot: Slot,
  title: Schema.String,
  preview: Schema.String,
  body: Schema.String,
  ...kept,
}) {}

/** A Tile now says this: whichever of its Title, its Preview and its Body changed, as they now read. */
export class TileEdited extends Schema.TaggedClass<TileEdited>()('TileEdited', {
  id: Schema.String,
  title: Schema.optionalKey(Schema.String),
  preview: Schema.optionalKey(Schema.String),
  body: Schema.optionalKey(Schema.String),
}) {}

/** A Tile, with everything below it, now stands in `slot` under `parent`. */
export class TileMoved extends Schema.TaggedClass<TileMoved>()('TileMoved', {
  id: Schema.String,
  parent: Schema.String,
  slot: Slot,
}) {}

/** Two Tiles traded places, each with everything below it. */
export class TilesSwapped extends Schema.TaggedClass<TilesSwapped>()('TilesSwapped', {
  a: Schema.String,
  b: Schema.String,
}) {}

/** A Tile was deleted, with everything below it; a Reference to any of them elsewhere is broken. */
export class TileDeleted extends Schema.TaggedClass<TileDeleted>()('TileDeleted', {
  id: Schema.String,
}) {}

/** A Reference to the Tile `target`, under the id `id`, now holds a Context slot of `parent`. */
export class ReferenceCreated extends Schema.TaggedClass<ReferenceCreated>()('ReferenceCreated', {
  id: Schema.String,
  parent: Schema.String,
  slot: ContextDirection,
  target: Schema.String,
}) {}

/** The Reference of this id no longer holds its Context slot of `parent`; its Tile is untouched. */
export class ReferenceDeleted extends Schema.TaggedClass<ReferenceDeleted>()('ReferenceDeleted', {
  id: Schema.String,
  parent: Schema.String,
  slot: ContextDirection,
}) {}

/**
 * Mapping's events, one closed union: an Operation Mapping gains makes one more member here, and
 * `evolve` and the service fail their typecheck until they follow.
 */
export const MappingEvent = Schema.Union([
  TileCreated,
  TileEdited,
  TileMoved,
  TilesSwapped,
  TileDeleted,
  ReferenceCreated,
  ReferenceDeleted,
])
export type MappingEvent = typeof MappingEvent.Type
