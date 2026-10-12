// Where a tile dragged across the canvas lands: among the places drawn that take it, a free slot or a
// tile it trades places with, the one whose heart is nearest the pointer let go, within its reach.
// Pure: the canvas says which places take the tile, as its caller does.
import type { Point } from '../../geometry/geometry'

/** A place a tile can be let go over: its heart, and how near it the pointer must be. */
export interface Reachable {
  center: Point
  reach: number
}

/** The place whose heart is nearest `point`, within its reach; none, and the tile goes back. */
export function nearestOf<P extends Reachable>(point: Point, places: readonly P[]): P | undefined {
  let nearest: { place: P; distance: number } | undefined
  for (const place of places) {
    const distance = Math.hypot(point.x - place.center.x, point.y - place.center.y)
    if (distance < place.reach && (nearest === undefined || distance < nearest.distance)) {
      nearest = { place, distance }
    }
  }
  return nearest?.place
}
