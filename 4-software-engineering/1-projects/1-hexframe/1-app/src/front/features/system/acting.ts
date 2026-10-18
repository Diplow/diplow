// Acting on the System from the canvas, a Tile's menu as Mapping reads it: what the menu says of a
// Tile (`Subject`: its kind, where it stands, what is below it, whether it takes a new Tile or turns
// into the other kind), the frames its Add and Move submenus draw, each place offering what Mapping
// would make of it, and the lines home leaves out, on someone else's System those the user's rights
// there hold back (`Reach`, HEX-127, HEX-132). What a line sends: a Tile moved to a place of its ring
// or turned into the other kind, a swap, a Reference removed. Pure: Mapping's `decide` rules on the
// flat System the page shows, and its `shownAllowed` on the rights it was shown, so the client knows
// no rule of its own.
import { Result } from 'effect'

import type { Standing } from '#/domains/iam/entities'
import {
  contextSlotOf,
  type Direction,
  directions,
  isEmptySystem,
  type Seen,
  type Slot,
  type System,
  type SystemTile,
  tileAt,
} from '#/domains/mapping/entities'
import { decide, type Operation, runsAgent, shownAllowed } from '#/domains/mapping/operations'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { PickerFrame } from '#/front/ui/canvas/tile/menu/Picker'
import { groupsOf, type Subject, type Verb } from '#/front/ui/canvas/tile/menu/verbs'
import { lookOf } from '#/front/ui/canvas/view/looks'
import { pathTo, type TileNode } from '#/front/ui/canvas/view/tiles'

import { moveOf, swapOf, swapsWith, tileIn, type Located } from './tree'
import { tilesBelow } from './widget/place'

/**
 * How far the user acts on the System the canvas draws: on their own, every line `decide` lets
 * through; on one they visit, someone else's, those the rights Mapping showed them there let through
 * too (`Seen`'s, asked of Mapping's `shownAllowed`, a preview the server decides again), the agent
 * where they hold *@* (HEX-134), and never who sees a Tile, its export nor an import, which are the
 * owner's or land at home; unless they stand for its owner there (`asOwner`, as `Seen` says it), an
 * Organization's admin, who shares its Tiles as its owner does (HEX-136). Its star's menu opens the
 * Organization's Members and Groups widgets for each of its members, and Ask to join for anyone
 * outside it who has not asked yet (`standing`, HEX-138). What a visitor sees at all is
 * Mapping's to say; `hexframe-app-sharing-organizations/decisions.md#DEC-4`, `#DEC-9`, `#DEC-11`,
 * `#DEC-13`.
 */
export type Reach =
  | 'owned'
  | {
      readonly visiting: Seen['rights']
      /** Whether the user stands for the owner of the System visited: an Organization's admin. */
      readonly asOwner?: boolean
      /**
       * Where the user stands in the Organization whose star is visited, IAM's `Standing`: a member
       * or an admin, outside it, or having asked; none for a star of no Organization.
       */
      readonly standing?: Standing | null | undefined
    }

/**
 * The lines a menu never offers on a System visited, a Tile's or a free slot's: who sees a Tile and
 * its export, which are its owner's, and an import, which lands in the Account's own System. The
 * server refuses each anyway; the page offers none. An admin of an Organization visited shares its
 * Tiles: its export and an import still land at home, so neither is offered there.
 */
const visitorsWithout = ['share', 'export', 'import'] as const satisfies ReadonlyArray<Verb>

const ownersAlone: ReadonlySet<Verb> = new Set(visitorsWithout)

const homeAlone: ReadonlySet<Verb> = new Set(['export', 'import'])

/** The lines the user may not take on a System visited for not being its owner, or for being away. */
const notTheirs = (reach: Exclude<Reach, 'owned'>) =>
  reach.asOwner === true ? homeAlone : ownersAlone

/**
 * Whether a Tile's menu opens an Organization's Members and Groups widgets for the user: on its star,
 * of an Organization they belong to.
 */
const membersAt = ({ reach, root }: Pick<Systems, 'reach' | 'root'>, hex: TileHex) =>
  reach !== 'owned' &&
  (reach.standing === 'admin' || reach.standing === 'member') &&
  hex.tile.id === root.id

/** Whether a Tile's menu offers Ask to join: on the star of an Organization the user is outside of. */
const joinsAt = ({ reach, root }: Pick<Systems, 'reach' | 'root'>, hex: TileHex) =>
  reach !== 'owned' && reach.standing === 'outside' && hex.tile.id === root.id

/**
 * Whether the user may ask the agent at a Tile of the System drawn, as far as the page can tell: on
 * their own, anywhere; on one they visit, where Mapping showed them *@* (`Seen`'s rights), the Turn
 * then starting there, in their own Conversation (HEX-134). The server asks again as the Turn starts.
 */
const asksAt = ({ reach }: Pick<Systems, 'reach'>, tile: string) =>
  reach === 'owned' || runsAgent(reach.visiting[tile] ?? [])

/**
 * The lines a free slot's menu leaves out under a Tile of the System drawn: none on the user's own;
 * on one they visit, the owner's, and the agent's where they hold no *@* on that Tile.
 */
export const slotWithout = (systems: Pick<Systems, 'reach'>, parent: string): Verb[] =>
  systems.reach === 'owned'
    ? []
    : [...visitorsWithout, ...(asksAt(systems, parent) ? [] : (['ask-agent'] as const))]

/** The System three ways: its tree, Mapping's; flat, which `decide` rules on; as the canvas draws it. */
export interface Systems {
  root: SystemTile
  flat: System
  tree: TileNode
  /** What the user may do on it. */
  reach: Reach
}

/**
 * Whether the user may make this Operation on the System drawn, as far as the page can tell: on
 * their own, anything; on one they visit, what their rights there let through (`shownAllowed`).
 * Whether `decide` makes something of it is its caller's to ask.
 */
const mayMake = ({ reach, flat }: Pick<Systems, 'reach' | 'flat'>, operation: Operation) =>
  reach === 'owned' || shownAllowed(reach.visiting, flat, operation)

/** The swap of a moving Tile with another, where Mapping makes something of it; none otherwise. */
export function tradeOf(
  systems: Pick<Systems, 'reach' | 'flat'>,
  moving: TileNode,
  held: TileNode,
) {
  const { flat } = systems
  const swap = swapsWith(flat, moving, held) ? swapOf(flat, moving.id, held.id) : undefined
  return swap !== undefined && mayMake(systems, { _tag: 'SwapTiles', ...swap }) ? swap : undefined
}

/**
 * The move of a Tile to a place, where Mapping would make it on the System as the page shows it, and
 * the user's rights let it: the menu's Move frame and the canvas's landing slots alike.
 */
export function allows(
  systems: Pick<Systems, 'reach' | 'flat'>,
  id: string,
  place: { parent: string; slot: Slot },
) {
  const { flat } = systems
  const moved = moveOf(flat, id, place)
  if (moved === undefined) return undefined
  const operation = { _tag: 'MoveTile', ...moved } as const
  const decided = decide(flat, operation)
  const made = Result.isSuccess(decided) && decided.success.length > 0
  return made && mayMake(systems, operation) ? moved : undefined
}

/**
 * Whether the user may move a Tile at all, as far as the page can tell: its own place, the least a
 * move needs, *write* on it, all it carries and the Tile it stands under.
 */
function movable(systems: Pick<Systems, 'reach' | 'flat'>, id: string) {
  const tile = tileAt(systems.flat, id)
  if (tile === undefined || !('parent' in tile)) return false
  const { parent, slot, version } = tile
  return mayMake(systems, { _tag: 'MoveTile', id, version, parent, slot })
}

/**
 * Whether the user may add a Tile in this slot, as far as their rights there say: anywhere on their
 * own System, under a Tile they write on one they visit. The slot plays no part in the rights, so
 * any slot of a Tile asks whether anything may go under it.
 */
export const addsAt = (
  systems: Pick<Systems, 'reach' | 'flat'>,
  { parent, slot }: { parent: string; slot: Slot },
) => mayMake(systems, { _tag: 'CreateTile', parent, slot, title: '', preview: '', body: '' })

/**
 * The move that turns a Tile into the other kind, in its own Direction, as Mapping has no operation
 * for it: a Leaf to the Branch's slot, a Branch to the Leaf's; none where Mapping refuses it, a
 * Branch holding anything, a Direction taken, nor for any other Tile.
 */
export function turnOf(systems: Pick<Systems, 'reach' | 'flat'>, located: Located | undefined) {
  switch (located?.kind) {
    case 'leaf':
      return allows(systems, located.tile.id, {
        parent: located.parent.id,
        slot: located.direction,
      })
    case 'branch':
      return allows(systems, located.tile.id, {
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
 * Tile under it; and only where the user's rights let them add one there.
 */
function takesOne(systems: Pick<Systems, 'reach' | 'flat'>, located: Located | undefined) {
  if (located === undefined || !addsAt(systems, { parent: located.tile.id, slot: 1 })) return false
  if (located.kind === 'leaf') return turnOf(systems, located) !== undefined
  return holds(located.tile)
}

/**
 * What a Tile's menu says of it: its kind as the canvas draws it, where it stands, the center or a
 * Direction of the ring it is in, the Tile above it, how many are below it, and whether it takes a
 * new Tile, a Leaf growing into a Branch for it, or turns into the other kind; none for a ring too
 * full, which is no Tile.
 */
export function subjectOf(systems: Systems, hex: TileHex): Subject | undefined {
  const { root, flat, tree } = systems
  const { kind } = lookOf(hex)
  if (kind === 'list') return undefined
  const { id, title } = hex.tile
  const located = hex.tile.reference === undefined ? tileIn(root, id) : undefined
  const own = {
    title,
    holds: takesOne(systems, located),
    ...(located && { below: tilesBelow(flat, id) }),
    turns: turnOf(systems, located) !== undefined,
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
  const parent = hex.parent
  if (parent === undefined || located.kind === 'root') return undefined
  const ring = ringOf(parent, located)
  const seats: PickerFrame['seats'] = {}
  for (const direction of directions) {
    const seated = ring[direction]
    if (seated !== undefined) {
      seats[direction] = {
        title: seated.title,
        swaps: tradeOf(systems, hex.tile, seated) !== undefined,
      }
    }
  }
  return {
    hub: parent.title,
    seats,
    lands: (direction) =>
      allows(systems, hex.tile.id, { parent: parent.id, slot: slotAt(located, direction) }) !==
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
  if (takesOne(systems, located)) {
    frames.holds = { hub: hex.tile.title, seats: childrenOf(hex.tile) }
  }
  const ring = standsIn(systems, hex, located)
  if (ring !== undefined) frames.standsIn = ring
  return frames
}

/**
 * The lines home leaves out of a Tile's menu: a Leaf's Context, which a Leaf has none of; an import
 * as the Root, but into an empty System's; the agent's on a broken Reference, which names no Tile;
 * the Members and Groups widgets', but on the star of an Organization the user belongs to; Ask to
 * join, but on the star of one they are outside of; and, on a System
 * visited, the owner's lines, but for its admin, the agent's where the user holds no *@*, and each
 * line that writes where the user's rights hold it back (`heldBack`).
 */
export function withoutOf(systems: Systems, hex: TileHex): Verb[] {
  const left: Verb[] = [
    ...(hex.tile.broken === true ? (['ask-agent'] as const) : []),
    ...(hex.tile.leaf === true ? (['show-context'] as const) : []),
    ...(hex.tile.root !== undefined && !isEmptySystem(systems.root) ? (['import'] as const) : []),
    ...(hex.role === 'center' && !membersAt(systems, hex) ? (['members', 'groups'] as const) : []),
    ...(hex.role === 'center' && !joinsAt(systems, hex) ? (['join'] as const) : []),
  ]
  const { reach } = systems
  if (reach === 'owned') return left
  const subject = subjectOf(systems, hex)
  const lines = subject === undefined ? [] : groupsOf(subject).flat()
  const held = lines.filter(
    (verb) => !left.includes(verb) && (notTheirs(reach).has(verb) || heldBack(systems, hex, verb)),
  )
  return [...left, ...held]
}

/**
 * Whether the user's rights on the System visited hold a line back, as far as the page can tell: one
 * that writes, an edit, a move, a delete, a Reference's removal, and the agent's, without *@*. Adding
 * a Tile and turning one into the other kind are left out of the menu already (`subjectOf`), as they
 * are where `decide` refuses them.
 */
function heldBack(systems: Systems, hex: TileHex, verb: Verb) {
  const { id } = hex.tile
  const version = tileAt(systems.flat, id)?.version ?? 0
  switch (verb) {
    case 'edit':
      return !mayMake(systems, { _tag: 'EditTile', id, version })
    case 'move':
      return !movable(systems, id)
    case 'delete':
      return !mayMake(systems, { _tag: 'DeleteTile', id, version })
    case 'remove-reference': {
      const slot = referenceAt(systems, hex)
      return slot === undefined || !mayMake(systems, { _tag: 'DeleteReference', ...slot })
    }
    case 'ask-agent':
      return !asksAt(systems, id)
    default:
      return false
  }
}

/** The move of a Tile to the free place `at` of the ring it stands in, as Mapping would make it. */
export function moveTo(systems: Systems, hex: TileHex, at: Direction) {
  const located = tileIn(systems.root, hex.tile.id)
  const parent = hex.parent
  if (located === undefined || located.kind === 'root' || parent === undefined) return undefined
  return allows(systems, hex.tile.id, { parent: parent.id, slot: slotAt(located, at) })
}

/** The swap of a Tile with the one seated at `at` in the ring it stands in, where it trades. */
export function swapAt(systems: Systems, hex: TileHex, at: Direction) {
  const located = tileIn(systems.root, hex.tile.id)
  const parent = hex.parent
  if (located === undefined || parent === undefined) return undefined
  const seated = ringOf(parent, located)[at]
  return seated === undefined ? undefined : tradeOf(systems, hex.tile, seated)
}

/**
 * Whether the user may move this Tile on the System drawn, a move under way taking it: on their own,
 * any; on one they visit, one their rights let them move (`movable`).
 */
export const movesHere = (systems: Pick<Systems, 'reach' | 'flat'>, id: string) =>
  systems.reach === 'owned' || movable(systems, id)

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
