// Mapping's events: what a change did to a System, facts in the past tense, which `evolve` applies,
// each counting one on the System's Version. `decide` makes those of an Operation; an import, which
// is no Operation, makes its own, `TilesImported`, from its plan. Each says what changed in the System
// and nothing of who changed it: no Account, no Session, no Key, which the API layer puts on the bus's
// envelope. Pure.
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

/**
 * A Tile was deleted, with everything below it; a Reference to any of them elsewhere is broken. It
 * says the Title the Tile had, which no reader can read once it is gone: the timeline names it so.
 */
export class TileDeleted extends Schema.TaggedClass<TileDeleted>()('TileDeleted', {
  id: Schema.String,
  title: Schema.String,
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
 * An import landed: the Tile it landed as, `id`, a new one in a free slot or the Root of an empty
 * System, and `count`, how many Tiles came with it, below it, its References aside. The one event no
 * Operation makes: an import's plan makes it (`files/import/plan.ts`). It names none of the Tiles it
 * brought, so a System it evolves holds none of them: a reader reads the System again.
 */
export class TilesImported extends Schema.TaggedClass<TilesImported>()('TilesImported', {
  id: Schema.String,
  count: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_147_483_647 })),
}) {}

/**
 * The events an Operation makes, which `decide` answers and the service writes one change each: an
 * Operation Mapping gains makes one more member here, and `evolve` and the service fail their
 * typecheck until they follow.
 */
export const OperationEvent = Schema.Union([
  TileCreated,
  TileEdited,
  TileMoved,
  TilesSwapped,
  TileDeleted,
  ReferenceCreated,
  ReferenceDeleted,
])
export type OperationEvent = typeof OperationEvent.Type

/** Mapping's events, one closed union: an Operation's, and an import's. */
export const MappingEvent = Schema.Union([...OperationEvent.members, TilesImported])
export type MappingEvent = typeof MappingEvent.Type

/** A Tile as a summary names it: its id and its Title, empty when the System no longer holds it. */
interface Named {
  readonly id: string
  readonly title: string
}

/**
 * Mapping's own summary of one of its events, what a timeline tells of it. A change: its verb, the
 * event's tag; the Tile it is about, the one it changed or the one whose Context slot a Reference's
 * create or delete changed; and the other Tile a swap traded places with, or a Reference points at.
 * An import: the Tile it landed as, and how many Tiles came with it.
 */
export type Summary =
  | {
      readonly _tag: 'Change'
      readonly verb: OperationEvent['_tag']
      readonly tile: Named
      readonly other?: Named
    }
  | { readonly _tag: 'Import'; readonly tile: Named; readonly count: number }

/** A change as Mapping summarizes it: what an Operation's event did, never an import. */
export type ChangeSummary = Extract<Summary, { readonly _tag: 'Change' }>

/** The ids an event names, the Tile it is about first, with the Title it says of it, if it says one. */
function subjectsOf(event: MappingEvent): { tile: string; title?: string; other?: string } {
  switch (event._tag) {
    case 'TileCreated':
    case 'TileDeleted':
      return { tile: event.id, title: event.title }
    case 'TileEdited':
      return { tile: event.id, ...(event.title !== undefined && { title: event.title }) }
    case 'TileMoved':
    case 'TilesImported':
      return { tile: event.id }
    case 'TilesSwapped':
      return { tile: event.a, other: event.b }
    case 'ReferenceCreated':
      return { tile: event.parent, other: event.target }
    case 'ReferenceDeleted':
      return { tile: event.parent }
  }
}

/** The Tiles an event names whose Title it does not say: those its summary reads from a System. */
export function untitledIn(event: MappingEvent): ReadonlyArray<string> {
  const { tile, title, other } = subjectsOf(event)
  return [...(title === undefined ? [tile] : []), ...(other === undefined ? [] : [other])]
}

/** The Tile an event is about, its Title from the event or, when it says none, `titleOf` it. */
const aboutOf = (event: MappingEvent, titleOf: (id: string) => string) => {
  const { tile, title, other } = subjectsOf(event)
  return { about: { id: tile, title: title ?? titleOf(tile) }, other }
}

/**
 * Summarizes an Operation's event, a change. A Title the event does not say is `titleOf` the Tile, as
 * the System holds it after the change, `''` once it no longer does; a deleted Tile's comes from its
 * event, since no read finds it.
 */
export function changeOf(event: OperationEvent, titleOf: (id: string) => string): ChangeSummary {
  const { about, other } = aboutOf(event, titleOf)
  return {
    _tag: 'Change',
    verb: event._tag,
    tile: about,
    ...(other !== undefined && { other: { id: other, title: titleOf(other) } }),
  }
}

/** Summarizes one of Mapping's events, a change (`changeOf`) or an import, its Titles as `changeOf` reads them. */
export function summaryOf(event: MappingEvent, titleOf: (id: string) => string): Summary {
  if (event._tag !== 'TilesImported') return changeOf(event, titleOf)
  return { _tag: 'Import', tile: aboutOf(event, titleOf).about, count: event.count }
}
