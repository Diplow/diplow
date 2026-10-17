// Acting on the System from the canvas, a Tile's menu as Mapping reads it: what the menu says of a
// Tile (`Subject`: its kind, where it stands, what is below it, whether it takes a new Tile or turns
// into the other kind), the frames its Add and Move submenus draw, each place offering what Mapping
// would make of it, and the lines home leaves out, those the user's rights on the Tile don't let
// through among them (`Reach`, HEX-127). What a line sends: a Tile moved to a place of its ring or
// turned into the other kind, a swap, a Reference removed. Pure: Mapping's `decide` rules on the
// flat System the page shows, and Mapping's rights on each Tile say who may do what, so the client
// knows no rule of its own.
import { Result } from 'effect'

import {
  contextSlotOf,
  type Direction,
  directions,
  isEmptySystem,
  Right,
  type Slot,
  type System,
  type SystemTile,
  tileAt,
} from '#/domains/mapping/entities'
import { decide } from '#/domains/mapping/operations'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { PickerFrame } from '#/front/ui/canvas/tile/menu/Picker'
import { groupsOf, type Subject, type Verb } from '#/front/ui/canvas/tile/menu/verbs'
import type { EmptySlotTarget } from '#/front/ui/canvas/geometry/shape'
import { lookOf } from '#/front/ui/canvas/view/looks'
import { pathTo, type TileNode } from '#/front/ui/canvas/view/tiles'

import { moveOf, swapOf, swapsWith, tileIn, type Located } from './tree'
import { tilesBelow } from './widget/place'

/** The swap of a moving Tile with another, where Mapping makes something of it; none otherwise. */
export function tradeOf(flat: System, moving: TileNode, held: TileNode) {
  return swapsWith(flat, moving, held) ? swapOf(flat, moving.id, held.id) : undefined
}

/**
 * What the user may do on the System the canvas draws: their rights on each Tile, by its id, as
 * Mapping's `Seen` says them, and whether the System is their own, which an export and an import as
 * its Root ask, the API layer reading the System whole for its owner alone.
 */
export interface Reach {
  readonly rights: (id: string) => ReadonlySet<Right>
  readonly yours: boolean
}

/** Every right on every Tile, the user's own System's: what its owner may do there. */
export const owned: Reach = { rights: () => new Set(Right.literals), yours: true }

/** The System three ways: its tree, Mapping's; flat, which `decide` rules on; as the canvas draws it. */
export interface Systems {
  root: SystemTile
  flat: System
  tree: TileNode
  /** What the user may do on it. */
  reach: Reach
}

/** A Tile's lines that change it, or what is under it: each needs *write* on it. */
const writes = ['edit', 'make-leaf', 'make-branch', 'add', 'move', 'delete'] as const

/**
 * The lines of a Tile's menu the user's rights don't let through: those that change it without
 * *write* on it; removing a Reference without *write* on the Tile holding it; the agent's without
 * *@*; an export and an import as the Root anywhere but on their own System.
 */
export function withheldOn({ rights, yours }: Reach, hex: TileHex): Verb[] {
  const on = rights(hex.tile.id)
  const holder = hex.parent === undefined ? on : rights(hex.parent.id)
  return [
    ...(on.has('write') ? [] : writes),
    ...(holder.has('write') ? [] : (['remove-reference'] as const)),
    ...(on.has('@') ? [] : (['ask-agent'] as const)),
    ...(yours ? [] : (['export', 'import'] as const)),
  ]
}

/**
 * The lines of a free slot's menu the user's rights on the Tile it stands under don't let through: a
 * new Tile there and an import into it without *write*, an import anywhere but on their own System,
 * the agent's without *@*.
 */
export function withheldUnder({ rights, yours }: Reach, parent: string): Verb[] {
  const under = rights(parent)
  return [
    ...(under.has('write') ? [] : (['new-tile'] as const)),
    ...(under.has('write') && yours ? [] : (['import'] as const)),
    ...(under.has('@') ? [] : (['ask-agent'] as const)),
  ]
}

/**
 * What a free slot's menu says of it and leaves out (`withheldUnder`); none when the user's rights on
 * the Tile it stands under let no line of it through.
 */
export function slotMenuOf(reach: Reach, target: EmptySlotTarget) {
  const subject = { kind: 'slot', at: target.direction, parent: target.parent.title } as const
  const without = withheldUnder(reach, target.parent.id)
  const offers = groupsOf(subject)
    .flat()
    .some((verb) => !without.includes(verb))
  return offers ? { subject, without } : undefined
}

/** Whether the user may write this Tile, or put a Tile under it: what a move or a swap asks of both. */
export const writable = ({ rights }: Reach, id: string) => rights(id).has('write')

/**
 * The move of a Tile to a place, where Mapping would make it on the System as the page shows it:
 * the menu's Move frame and the canvas's landing slots alike.
 */
export function allows(flat: System, id: string, place: { parent: string; slot: Slot }) {
  const moved = moveOf(flat, id, place)
  if (moved === undefined) return undefined
  const decided = decide(flat, { _tag: 'MoveTile', ...moved })
  return Result.isSuccess(decided) && decided.success.length > 0 ? moved : undefined
}

/**
 * The move that turns a Tile into the other kind, in its own Direction, as Mapping has no operation
 * for it: a Leaf to the Branch's slot, a Branch to the Leaf's; none where Mapping refuses it, a
 * Branch holding anything, a Direction taken, nor for any other Tile.
 */
export function turnOf(flat: System, located: Located | undefined) {
  switch (located?.kind) {
    case 'leaf':
      return allows(flat, located.tile.id, {
        parent: located.parent.id,
        slot: located.direction,
      })
    case 'branch':
      return allows(flat, located.tile.id, {
        parent: located.parent.id,
        slot: { leaf: located.direction },
      })
    default:
      return undefined
  }
}

/** The Direction a Tile stands in under its parent, a Context Tile's its slot's. */
function directionOf(located: Located): Direction | undefined {
  switch (located.kind) {
    case 'root':
      return undefined
    case 'context':
      return -located.slot as Direction
    default:
      return located.direction
  }
}

/** Whether a Tile has room for another: a Direction neither a Branch nor a Leaf holds. */
const holds = (tile: SystemTile) =>
  directions.some((direction) => !tile.branches[direction] && !tile.leaves[direction])

/** The ring of Children a Tile holds, as a picker draws it: a Branch, else a Leaf, by Direction. */
function childrenOf(tile: TileNode): PickerFrame['seats'] {
  const seats: PickerFrame['seats'] = {}
  for (const direction of directions) {
    const child = tile.branches?.[direction] ?? tile.leaves?.[direction]
    if (child !== undefined) seats[direction] = { title: child.title, swaps: false }
  }
  return seats
}

/**
 * Whether a new Tile fits under it: a Direction neither a Branch nor a Leaf holds; under a Leaf, any,
 * once it grows into a Branch, where Mapping lets it (`turnOf`), as a Leaf does once its owner adds a
 * Tile under it.
 */
function takesOne(flat: System, located: Located | undefined) {
  if (located?.kind === 'leaf') return turnOf(flat, located) !== undefined
  return located !== undefined && holds(located.tile)
}

/**
 * What a Tile's menu says of it: its kind as the canvas draws it, where it stands, the center or a
 * Direction of the ring it is in, the Tile above it, how many are below it, and whether it takes a
 * new Tile, a Leaf growing into a Branch for it, or turns into the other kind; none for a ring too
 * full, which is no Tile.
 */
export function subjectOf({ root, flat, tree }: Systems, hex: TileHex): Subject | undefined {
  const { kind } = lookOf(hex)
  if (kind === 'list') return undefined
  const { id, title } = hex.tile
  const located = hex.tile.reference === undefined ? tileIn(root, id) : undefined
  const own = {
    title,
    holds: takesOne(flat, located),
    ...(located && { below: tilesBelow(flat, id) }),
    turns: turnOf(flat, located) !== undefined,
  }
  if (hex.role === 'center') {
    const parent = pathTo(tree, id).at(-2)?.title
    return { kind, at: 'center', ...own, ...(parent !== undefined && { parent }) }
  }
  const at = (located && directionOf(located)) ?? hex.direction
  if (kind === 'root' || kind === 'untitled' || at === undefined) return undefined
  return { kind, at, ...own, ...(hex.parent && { parent: hex.parent.title }) }
}

/**
 * The ring a Tile stands in, by Direction, as its picker seats it: its parent's Context for a Context
 * Tile, its parent's Children otherwise, a Branch before a Leaf of the same Direction.
 */
function ringOf(parent: TileNode, located: Located): Partial<Record<Direction, TileNode>> {
  if (located.kind === 'context') return parent.context ?? {}
  return { ...parent.leaves, ...parent.branches }
}

/** The slot of its own kind a Tile goes to in a Direction of its ring: a Context, a Leaf or a Branch slot. */
function slotAt(located: Located, direction: Direction): Slot {
  switch (located.kind) {
    case 'context':
      return contextSlotOf(direction)
    case 'leaf':
      return { leaf: direction }
    default:
      return direction
  }
}

/** The ring a Tile stands in, as its Move submenu draws it: whom it trades with, where it lands. */
function standsIn(systems: Systems, hex: TileHex, located: Located): PickerFrame | undefined {
  const { flat } = systems
  const parent = hex.parent
  if (parent === undefined || located.kind === 'root') return undefined
  const ring = ringOf(parent, located)
  const seats: PickerFrame['seats'] = {}
  for (const direction of directions) {
    const seated = ring[direction]
    if (seated !== undefined) {
      seats[direction] = { title: seated.title, swaps: swapsWith(flat, hex.tile, seated) }
    }
  }
  return {
    hub: parent.title,
    seats,
    lands: (direction) =>
      allows(flat, hex.tile.id, { parent: parent.id, slot: slotAt(located, direction) }) !==
      undefined,
  }
}

/**
 * The frames a Tile's Add and Move submenus draw: the ring it holds, a Leaf's empty until it grows,
 * the one it stands in.
 */
export function framesOf(systems: Systems, hex: TileHex) {
  const located = hex.tile.reference === undefined ? tileIn(systems.root, hex.tile.id) : undefined
  if (located === undefined) return {}
  const frames: { holds?: PickerFrame; standsIn?: PickerFrame } = {}
  if (takesOne(systems.flat, located)) {
    frames.holds = { hub: hex.tile.title, seats: childrenOf(hex.tile) }
  }
  const ring = standsIn(systems, hex, located)
  if (ring !== undefined) frames.standsIn = ring
  return frames
}

/**
 * The lines home leaves out of a Tile's menu: a Leaf's Context, which a Leaf has none of; an import
 * as the Root, but into an empty System's; the agent's on a broken Reference, which names no Tile;
 * and those the user's rights don't let through (`withheldOn`).
 */
export function withoutOf({ root, reach }: Systems, hex: TileHex): Verb[] {
  const left: Verb[] = [
    ...(hex.tile.broken === true ? (['ask-agent'] as const) : []),
    ...(hex.tile.leaf === true ? (['show-context'] as const) : []),
    ...(hex.tile.root !== undefined && !isEmptySystem(root) ? (['import'] as const) : []),
  ]
  return [...left, ...withheldOn(reach, hex).filter((verb) => !left.includes(verb))]
}

/** The move of a Tile to the free place `at` of the ring it stands in, as Mapping would make it. */
export function moveTo({ root, flat }: Systems, hex: TileHex, at: Direction) {
  const located = tileIn(root, hex.tile.id)
  const parent = hex.parent
  if (located === undefined || located.kind === 'root' || parent === undefined) return undefined
  return allows(flat, hex.tile.id, { parent: parent.id, slot: slotAt(located, at) })
}

/** The swap of a Tile with the one seated at `at` in the ring it stands in, where it trades. */
export function swapAt({ root, flat }: Systems, hex: TileHex, at: Direction) {
  const located = tileIn(root, hex.tile.id)
  const parent = hex.parent
  if (located === undefined || parent === undefined) return undefined
  const seated = ringOf(parent, located)[at]
  return seated === undefined ? undefined : tradeOf(flat, hex.tile, seated)
}

/**
 * The Context slot a Reference stands in, under the Tile at the heart of its ring, at the Version the
 * page shows of that Tile: what removing it sends.
 */
export function referenceAt({ flat }: Systems, hex: TileHex) {
  const parent = hex.parent
  if (parent === undefined || hex.direction === undefined) return undefined
  const version = tileAt(flat, parent.id)?.version
  if (version === undefined) return undefined
  return { parent: parent.id, parentVersion: version, slot: contextSlotOf(hex.direction) }
}
