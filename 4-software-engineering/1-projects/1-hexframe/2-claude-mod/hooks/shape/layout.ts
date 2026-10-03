// Where each hex of a view sits: the centered Tile and a ring of six around it, pointy-top, in
// units where the ring's spacing makes neighbors share a side. One generation, claude-mod's depth:
// a deeper one comes with the medium that shows it. A renderer scales it; claude-mod's raster sets
// its own pixel-art hexes on the same lattice.
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

/** A Frame as a view shows it: the kind its ring shows. */
export interface FrameView {
  frame: Frame
  frameKind: FrameKind
}

/** A hex of the view, each of radius 1. */
export type Placement =
  | { kind: 'center'; center: Point; tile: Tile }
  | { kind: 'member'; memberKind: MemberKind; direction: Direction; center: Point; tile: Tile }
  | { kind: 'empty'; direction: Direction; center: Point }

const sqrt3 = Math.sqrt(3)

/** Angle, in degrees counterclockwise from east, of the neighbor in each direction. */
const neighborAngle: Record<Direction, number> = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120, 6: 180 }

/** The view's size, for a hex of radius 1 and the ring at its spacing: three hexes across. */
export const viewWidth = 3 * sqrt3
export const viewHeight = 5

/**
 * The seven hexes of one Frame, centered in a box of `viewWidth` by `viewHeight`, in the order to
 * paint them: its Tile, then its ring by direction. A Frame whose ring overflows has no member to
 * place: a medium shows that ring as a list instead.
 */
export function layoutView({ frame, frameKind }: FrameView): Placement[] {
  const center = { x: viewWidth / 2, y: viewHeight / 2 }
  const members = membersOf(frame.rings[frameKind])
  return [
    { kind: 'center', center, tile: frame.tile },
    ...directions.map((direction): Placement => {
      const at = neighbor(center, direction)
      const member = members[direction]
      return member
        ? { kind: 'member', memberKind: member.kind, direction, center: at, tile: member.tile }
        : { kind: 'empty', direction, center: at }
    }),
  ]
}

function neighbor(center: Point, direction: Direction): Point {
  const radians = (neighborAngle[direction] * Math.PI) / 180
  return { x: center.x + sqrt3 * Math.cos(radians), y: center.y - sqrt3 * Math.sin(radians) }
}

/** The six corners, clockwise from the top one. */
export function hexCorners(center: Point, radius: number): Point[] {
  return [-90, -30, 30, 90, 150, 210].map((degrees) => {
    const radians = (degrees * Math.PI) / 180
    return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) }
  })
}
