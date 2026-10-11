// A tile on the move in its frame (HEX-105's proposal, from components.html's #moving): what each
// place around the center offers while it moves, where a drag let go lands, and the frame once it
// has. Pure: the frame's pieces draw it, its caller sends the write.
import { directions, type Direction, type Point } from '../../geometry/geometry'

/** A tile seated in a Direction of the frame: whether it can trade places with the one moving. */
export interface Seat {
  /** A Branch offers to trade places; a Leaf, a Reference and the rest take no part. */
  swaps: boolean
}

/** What a frame's six Directions hold; a Direction holding nothing is free. */
export type Seats = Partial<Record<Direction, Seat>>

/**
 * What a place does while a tile moves: the tile itself, lifted; a free slot, offering itself; a
 * tile that trades places, its swap at its foot; the rest, stepped back.
 */
export type Part = 'lifted' | 'landing' | 'swap' | 'aside'

/** What each Direction offers the tile moving out of `from`. */
export function partOf(seats: Seats, from: Direction, direction: Direction): Part {
  if (direction === from) return 'lifted'
  const seat = seats[direction]
  if (seat === undefined) return 'landing'
  return seat.swaps ? 'swap' : 'aside'
}

/** Whether the tile moving out of `from` can land in `to`: a free slot, or a tile that trades. */
export function takes(seats: Seats, from: Direction, to: Direction): boolean {
  const part = partOf(seats, from, to)
  return part === 'landing' || part === 'swap'
}

/**
 * The frame once the tile in `from` has landed in `to`: moved into a free slot, or swapped. Whatever
 * a frame seats, a `Seat` or what draws it.
 */
export function landed<T>(
  seats: Partial<Record<Direction, T>>,
  from: Direction,
  to: Direction,
): Partial<Record<Direction, T>> {
  const moving = seats[from]
  if (moving === undefined || from === to) return seats
  const next: Partial<Record<Direction, T>> = {}
  for (const direction of directions) {
    const seat = direction === to ? moving : direction === from ? seats[to] : seats[direction]
    if (seat !== undefined) next[direction] = seat
  }
  return next
}

/**
 * Where a tile dragged out of `from` and let go at `point` lands: the place whose heart is nearest,
 * within `reach` of it, if it takes the tile; none, and it glides back.
 */
export function dropAt(
  point: Point,
  hearts: Readonly<Record<Direction, Point>>,
  { seats, from, reach }: { seats: Seats; from: Direction; reach: number },
): Direction | undefined {
  let nearest: { direction: Direction; distance: number } | undefined
  for (const [key, heart] of Object.entries(hearts)) {
    const direction = Number(key) as Direction
    const distance = Math.hypot(point.x - heart.x, point.y - heart.y)
    if (distance < reach && (nearest === undefined || distance < nearest.distance)) {
      nearest = { direction, distance }
    }
  }
  return nearest !== undefined && takes(seats, from, nearest.direction)
    ? nearest.direction
    : undefined
}
