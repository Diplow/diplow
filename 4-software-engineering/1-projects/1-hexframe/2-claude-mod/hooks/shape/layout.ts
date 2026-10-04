// Where each hex of a view sits: the centered Tile and a ring of six around it, pointy-top, in
// units where the ring's spacing makes neighbors share a side. A hex the view opens holds a Frame
// of its own, its Tile and ring a third of its size, so the view shows as many scales as it opens:
// claude-mod opens none, the Obsidian plugin the center twice and each Branch around it once. A
// renderer scales it; claude-mod's raster sets its own pixel-art hexes on the same lattice.
import {
  directions,
  membersOf,
  type Direction,
  type Frame,
  type FrameKind,
  type MemberKind,
  type Tile,
} from './node.js'

export interface Point {
  x: number
  y: number
}

/**
 * A Frame as a view shows it: the kind of the ring around its Tile, the Tile's own hex opened into
 * a ring of another kind (`inner`, the center's second expansion), and the members of its ring
 * opened as Frames of their own (`expanded`, by direction). A member that isn't there stays closed.
 */
export interface FrameView {
  frame: Frame
  frameKind: FrameKind
  inner?: FrameKind
  expanded?: Partial<Record<Direction, FrameView>>
}

/** A center with no ring around it: its Tile fills the view, opened into `inner` when set. */
export interface CollapsedView {
  frame: Frame
  inner?: FrameKind
}

/** Where a hex sits, how big it is, and its generation: 0 the center, 1 its members, 2 theirs. */
interface Hex {
  center: Point
  radius: number
  generation: number
}

/**
 * A hex holding a Tile. `opened` marks a hex the view opened: a renderer draws its shape only, and
 * the placements right after it, its Tile again among them, draw the Frame it holds over it.
 */
interface CenterHex extends Hex {
  kind: 'center'
  tile: Tile
  opened?: true
}

interface MemberHex extends Hex {
  kind: 'member'
  memberKind: MemberKind
  direction: Direction
  tile: Tile
  opened?: true
}

interface EmptyHex extends Hex {
  kind: 'empty'
  direction: Direction
}

/** A hex of the view: the center's Tile, a member's, or a direction with nothing in it. */
export type Placement = CenterHex | MemberHex | EmptyHex

/** What a hex holding a Tile stands for, before it is placed. */
type Role = Omit<CenterHex, keyof Hex | 'opened'> | Omit<MemberHex, keyof Hex | 'opened'>

const sqrt3 = Math.sqrt(3)

/** Angle, in degrees counterclockwise from east, of the neighbor in each direction. */
const neighborAngle: Record<Direction, number> = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120, 6: 180 }

/** The view's size, for a hex of radius 1 and the ring at its spacing: three hexes across. */
export const viewWidth = 3 * sqrt3
export const viewHeight = 5

/** A Frame drawn inside a hex takes a third of its radius: its ring then touches that hex's sides. */
const generationScale = 1 / 3

/**
 * The margin a Frame opened inside a hex leaves to that hex's sides, as a share of its radius, so
 * the Frame stays inside the hex a renderer draws, a little smaller than the layout's.
 */
const padding = 0.08

/** The hex a view's Frame fills: its Tile and ring, of radius 1, take a third of it. */
const frameRadius = 3

/** The hex a collapsed center fills: the largest that fits the view. */
const collapsedRadius = Math.min(viewHeight / 2, viewWidth / sqrt3)

/**
 * The hexes of a view, centered in a box of `viewWidth` by `viewHeight`, in the order to paint
 * them. A Frame view is its Tile, then its ring by direction, a hex the view opens followed by
 * what it holds; with nothing opened, that is seven hexes. A collapsed view is its Tile alone,
 * filling the box. A ring that overflows places no member: a medium shows it as a list instead.
 */
export function layoutView(view: FrameView | CollapsedView): Placement[] {
  const middle = { x: viewWidth / 2, y: viewHeight / 2 }
  const center: Role = { kind: 'center', tile: view.frame.tile }
  if ('frameKind' in view) return placeFrame(view, center, 0, { at: middle, radius: frameRadius })
  const inner = view.inner && { frame: view.frame, frameKind: view.inner }
  return placeHex(center, 0, inner, { at: middle, radius: collapsedRadius })
}

/** Where a Frame is drawn: the center and the radius of the hex it fills. */
interface Room {
  at: Point
  radius: number
}

/** A hex for `role`, holding `opened` when the view opens it, in `room`. */
function placeHex(
  role: Role,
  generation: number,
  opened: FrameView | undefined,
  room: Room,
): Placement[] {
  const hex = { ...role, center: room.at, radius: room.radius, generation }
  if (opened === undefined) return [hex]
  const inside = { at: room.at, radius: room.radius * (1 - padding) }
  return [{ ...hex, opened: true }, ...placeFrame(opened, role, generation, inside)]
}

/** `view`'s Frame inside `room`: its Tile, standing for `hub`, then its ring by direction. */
function placeFrame(view: FrameView, hub: Role, generation: number, room: Room): Placement[] {
  const radius = room.radius * generationScale
  const inner = view.inner && { frame: view.frame, frameKind: view.inner }
  const members = membersOf(view.frame.rings[view.frameKind])
  return [
    ...placeHex(hub, generation, inner, { at: room.at, radius }),
    ...directions.flatMap((direction): Placement[] => {
      const at = neighbor(room.at, direction, radius)
      const member = members[direction]
      if (!member)
        return [{ kind: 'empty', direction, center: at, radius, generation: generation + 1 }]
      const role: Role = { kind: 'member', memberKind: member.kind, direction, tile: member.tile }
      return placeHex(role, generation + 1, view.expanded?.[direction], { at, radius })
    }),
  ]
}

function neighbor(center: Point, direction: Direction, radius: number): Point {
  const radians = (neighborAngle[direction] * Math.PI) / 180
  const distance = sqrt3 * radius
  return { x: center.x + distance * Math.cos(radians), y: center.y - distance * Math.sin(radians) }
}

/** The six corners, clockwise from the top one. */
export function hexCorners(center: Point, radius: number): Point[] {
  return [-90, -30, 30, 90, 150, 210].map((degrees) => {
    const radians = (degrees * Math.PI) / 180
    return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) }
  })
}
