// Where each hex of a Frame sits: the centered Tile and a ring of six around it, pointy-top, in
// units where the ring's spacing makes neighbors share a side. The SVG scales it; the raster sets
// its own pixel-art hexes on the same lattice.
import { directions, type Direction, type Frame, type Tile } from './node.js'

export interface Point {
  x: number
  y: number
}

export type Ring = 'children' | 'context'

export type Placement =
  | { kind: 'center'; center: Point; tile: Tile }
  | { kind: 'member'; ring: Ring; direction: Direction; center: Point; tile: Tile }
  | { kind: 'empty'; ring: Ring; direction: Direction; center: Point }

const sqrt3 = Math.sqrt(3)

/** Angle, in degrees counterclockwise from east, of the neighbor in each direction. */
const neighborAngle: Record<Direction, number> = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120, 6: 180 }

/** A hex's radius is 1; the gap between neighbors is this share of it. */
export const hexRadius = 0.93

/** The Frame's size, for a hex of radius 1 and the ring at its spacing: three hexes across. */
export const frameWidth = 3 * sqrt3
export const frameHeight = 5

/** The seven hexes of a Frame, centered in a box of `frameWidth` by `frameHeight`. */
export function layoutFrame(frame: Frame, ring: Ring): Placement[] {
  const center: Point = { x: frameWidth / 2, y: frameHeight / 2 }
  const members = ring === 'children' ? frame.children : frame.context
  return [
    { kind: 'center', center, tile: frame.tile },
    ...directions.map((direction): Placement => {
      const at = neighbor(center, direction)
      const tile = members[direction]
      return tile
        ? { kind: 'member', ring, direction, center: at, tile }
        : { kind: 'empty', ring, direction, center: at }
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

/** The width of the band between a hex's side corners, where its text sits. */
export function bandWidth(radius: number): number {
  return sqrt3 * radius
}
