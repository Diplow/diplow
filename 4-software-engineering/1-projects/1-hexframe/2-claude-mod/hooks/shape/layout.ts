// Where each hex of a view sits: the centered Tile and a ring of six around it, pointy-top, in
// units where the ring's spacing makes neighbors share a side. Deeper generations sit inside the
// hex of the member they expand. A renderer scales it; claude-mod's raster sets its own pixel-art
// hexes on the same lattice.
import { directions, type Direction, type Frame, type Tile } from './node.js'

export interface Point {
  x: number
  y: number
}

export type Ring = 'children' | 'context'

/** A Frame as a view shows it: the ring around its Tile, and the members it opens as Frames. */
export interface FrameView {
  frame: Frame
  ring: Ring
  expanded?: Partial<Record<Direction, FrameView>>
}

/** A hex of the view; `radius` is 1 at the first generation and a third of it at each next one. */
export type Placement =
  | { kind: 'center'; center: Point; radius: number; tile: Tile }
  | { kind: 'member'; ring: Ring; direction: Direction; center: Point; radius: number; tile: Tile }
  | { kind: 'empty'; ring: Ring; direction: Direction; center: Point; radius: number }

const sqrt3 = Math.sqrt(3)

/** Angle, in degrees counterclockwise from east, of the neighbor in each direction. */
const neighborAngle: Record<Direction, number> = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120, 6: 180 }

/** The view's size, for a hex of radius 1 and the ring at its spacing: three hexes across. */
export const viewWidth = 3 * sqrt3
export const viewHeight = 5

/** A Frame opened inside a hex takes a third of its radius: its ring then touches that hex's sides. */
const generationScale = 1 / 3

/**
 * The hexes of a view `depth` generations deep, centered in a box of `viewWidth` by `viewHeight`,
 * in the order to paint them. At depth 1, the seven hexes of one Frame. Deeper, a member found in
 * `expanded` shows as its own Frame, in place of its hex; past the depth it stays one hex.
 */
export function layoutView(view: FrameView, depth: number): Placement[] {
  return layoutAt(view, { x: viewWidth / 2, y: viewHeight / 2 }, 1, depth)
}

function layoutAt(view: FrameView, center: Point, radius: number, depth: number): Placement[] {
  const { frame, ring } = view
  const members = ring === 'children' ? frame.children : frame.context
  return [
    { kind: 'center', center, radius, tile: frame.tile },
    ...directions.flatMap((direction): Placement[] => {
      const at = neighbor(center, direction, radius)
      const tile = members[direction]
      const opened = view.expanded?.[direction]
      if (tile && opened && depth > 1) {
        return layoutAt(opened, at, radius * generationScale, depth - 1)
      }
      return [
        tile
          ? { kind: 'member', ring, direction, center: at, radius, tile }
          : { kind: 'empty', ring, direction, center: at, radius },
      ]
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
