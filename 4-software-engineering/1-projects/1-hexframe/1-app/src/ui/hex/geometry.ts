// Pointy-top hexagons in screen coordinates (y grows downwards). A Hex is its center and its
// circumradius: the distance from the center to a corner, which is also the length of a side.

export type Direction = 1 | 2 | 3 | 4 | 5 | 6

/** 1 NW, 2 NE, 3 E, 4 SE, 5 SW, 6 W: clockwise from the top left. */
export const directions: readonly Direction[] = [1, 2, 3, 4, 5, 6]

export interface Point {
  x: number
  y: number
}

export interface Hex {
  center: Point
  radius: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

const sqrt3 = Math.sqrt(3)

/** A Frame's six Children, and its center, each fit in a third of its radius. */
const frameScale = 1 / 3

/** The direction three away: the tension a parent balances. */
export function opposite(direction: Direction): Direction {
  return (((direction + 2) % 6) + 1) as Direction
}

/** Angle, in degrees counterclockwise from east, of the neighbor in each direction. */
const neighborAngle: Record<Direction, number> = { 1: 120, 2: 60, 3: 0, 4: -60, 5: -120, 6: 180 }

export function hexWidth(radius: number): number {
  return sqrt3 * radius
}

export function hexHeight(radius: number): number {
  return 2 * radius
}

/** The six corners, clockwise from the top one. */
export function hexCorners({ center, radius }: Hex): Point[] {
  return [-90, -30, 30, 90, 150, 210].map((degrees) => {
    const radians = (degrees * Math.PI) / 180
    return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) }
  })
}

/** The hex of the same size that shares a side with this one, in a direction. */
export function neighbor({ center, radius }: Hex, direction: Direction): Hex {
  const radians = (neighborAngle[direction] * Math.PI) / 180
  const distance = sqrt3 * radius
  return {
    center: {
      x: center.x + distance * Math.cos(radians),
      y: center.y - distance * Math.sin(radians),
    },
    radius,
  }
}

/** The same hex, each side moved inwards by `distance`. */
export function insetHex({ center, radius }: Hex, distance: number): Hex {
  return { center, radius: Math.max(0, radius - (2 * distance) / sqrt3) }
}

/**
 * The seven slots of a Frame drawn inside `hex`: its center and a ring of six. At a third of the
 * radius the ring touches the outer hex exactly, so a Frame takes the place of the Tile it expands.
 */
export function frameSlots(hex: Hex): { center: Hex; ring: Record<Direction, Hex> } {
  const center: Hex = { center: hex.center, radius: hex.radius * frameScale }
  return {
    center,
    ring: {
      1: neighbor(center, 1),
      2: neighbor(center, 2),
      3: neighbor(center, 3),
      4: neighbor(center, 4),
      5: neighbor(center, 5),
      6: neighbor(center, 6),
    },
  }
}

/** The box a hex's text sits in: taller for a few lines, or wider for a single title. */
export function textBox({ center, radius }: Hex, shape: 'tall' | 'wide' = 'tall'): Box {
  // Tall keeps its corners a margin inside the slanted sides; wide is the band between the side
  // corners, where the hex is full width, less a margin.
  const width = hexWidth(radius) * (shape === 'tall' ? 0.8 : 0.9)
  const height = radius * (shape === 'tall' ? 1.1 : 0.9)
  return { x: center.x - width / 2, y: center.y - height / 2, width, height }
}
