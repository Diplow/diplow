// The tile widget in Mapping's words, read from the System the page holds. The widget mirrors Mapping
// (`ui/` knows no domain): a Branch, a Leaf or a Context Tile, in one of six places. Here a slot
// becomes the widget's kind and place, and back; the places a kind may take under a Tile are those
// Mapping's own placement rule leaves free (`freeSlot`); an edit's changed fields are the ones that differ from the Tile it opened
// on; and a refusal a form shows lands on the widget's fields. Pure.
import { Result } from 'effect'

import {
  below,
  contextSlotOf,
  directions,
  isContextSlot,
  isLeafSlot,
  type Direction,
  type Slot,
  type System,
} from '#/domains/mapping/entities'
import { freeSlot } from '#/domains/mapping/operations'
import type { FormErrors } from '#/front/client/channels'
import type { Place } from '#/front/ui/chat/widgets/Places'
import type { TileField, TileKind, TilePlace, TileWords } from '#/front/ui/chat/widgets/tile/parts'

/** A slot as the widget draws it: its kind, and its place among the six. */
export function placeOf(slot: Slot): { kind: TileKind; place: Place } {
  if (isLeafSlot(slot)) return { kind: 'leaf', place: slot.leaf }
  if (isContextSlot(slot)) return { kind: 'context', place: directionOf(slot) }
  return { kind: 'branch', place: slot }
}

/** The Direction a Context slot stands in. */
const directionOf = (slot: Slot): Direction =>
  directions.find((direction) => contextSlotOf(direction) === slot) ?? 1

/** The slot of a kind in a place: a Branch's Direction, a Leaf's, or the Context's. */
export function slotOf(kind: TileKind, place: Place): Slot {
  switch (kind) {
    case 'branch':
      return place
    case 'leaf':
      return { leaf: place }
    case 'context':
      return contextSlotOf(place)
  }
}

/**
 * The places a Tile of this kind may take under `parent`, as Mapping places one (`freeSlot`): those
 * it holds nothing in, and none under a Leaf or a Tile gone.
 */
export const freeFor = (system: System, parent: string, kind: TileKind): Place[] =>
  directions.filter((direction) =>
    Result.isSuccess(freeSlot(system, { parent, slot: slotOf(kind, direction) })),
  )

/** Where a Tile goes, or stands, in `slot` under `parent`, the places free for its kind with it. */
export function whereIn(
  system: System,
  parent: { id: string; title: string },
  slot: Slot,
): TilePlace {
  const { kind, place } = placeOf(slot)
  return { parent: parent.title, kind, place, free: freeFor(system, parent.id, kind) }
}

/**
 * The slot a new Tile takes once the user picks another kind: the same place if it is free for that
 * kind, else the first free one; none when that kind has no place left under its parent.
 */
export function slotForKind(system: System, parent: string, slot: Slot, kind: TileKind) {
  const free = freeFor(system, parent, kind)
  const { place } = placeOf(slot)
  const taken = free.includes(place) ? place : free[0]
  return taken === undefined ? undefined : slotOf(kind, taken)
}

/** How many Tiles go along with this one, everything below it, References aside. */
export const tilesBelow = (system: System, id: string) =>
  [...below(system, id)].filter((held) => held !== id && system.tiles[held]?._tag === 'Tile').length

const fields = ['title', 'preview', 'body'] as const satisfies readonly TileField[]

/** The fields that differ from the Tile the widget opened on: each marked, and what Save sends. */
export const editedOf = (words: TileWords, opened: TileWords): TileField[] =>
  fields.filter((field) => words[field] !== opened[field])

/** What the widget shows of a refusal, on the fields it names; one on no field is in its toast. */
export type Refusal = Partial<Record<TileField, string>>

/** A form's refusal on the widget's fields; none when it names none of them. */
export function refusalOf(shown: FormErrors | undefined): Refusal | undefined {
  if (shown === undefined || !('fields' in shown)) return undefined
  const on: Refusal = {}
  for (const field of fields) {
    const said = shown.fields[field]
    if (said !== undefined) on[field] = said
  }
  return Object.keys(on).length === 0 ? undefined : on
}

/** The refusal left once the user changed what it named: each field's clears as it changes. */
export function stillRefused(
  refused: Refusal | undefined,
  before: TileWords,
  after: TileWords,
): Refusal | undefined {
  if (refused === undefined) return undefined
  const left: Refusal = {}
  for (const field of fields) {
    const said = refused[field]
    if (said !== undefined && before[field] === after[field]) left[field] = said
  }
  return Object.keys(left).length === 0 ? undefined : left
}
