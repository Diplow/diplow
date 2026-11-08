// How a tile's page grows out of its hex and goes back into it: drawn small where the hex stands, cut
// to the hex's shape, then whole over the canvas, its words never stretched, since it only scales
// evenly. Pure.
import { hexCorners, type Hex, type Point } from '../../geometry/geometry'

/** How large the page is drawn, in px. */
export interface Size {
  width: number
  height: number
}

const polygonOf = (points: readonly Point[]) =>
  `polygon(${points.map(({ x, y }) => `${String(x)}px ${String(y)}px`).join(', ')})`

/**
 * The page as it grows out of `hex`, where the hex stands on the page, its center from the page's top
 * left, and as it stands whole: at first scaled down evenly onto the hex and cut to its shape, the
 * largest hex the page holds, then at its own size, uncut, the hex's corners gone out to the page's.
 * Played backwards, it goes back into the hex.
 */
export function pageZoomOf(hex: Hex, size: Size): [Keyframe, Keyframe] {
  const { width, height } = size
  const middle = { x: width / 2, y: height / 2 }
  const radius = Math.min(height / 2, width / Math.sqrt(3))
  const scale = hex.radius / radius
  const x = hex.center.x - scale * middle.x
  const y = hex.center.y - scale * middle.y
  const cut = hexCorners({ center: middle, radius })
  // Each corner goes out to its own place on the page's edge: the top and bottom ones straight up
  // and down, the others to the page's corners.
  const whole = [
    { x: middle.x, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: middle.x, y: height },
    { x: 0, y: height },
    { x: 0, y: 0 },
  ]
  return [
    {
      transform: `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`,
      clipPath: polygonOf(cut),
      opacity: 0,
    },
    { transform: 'translate(0px, 0px) scale(1)', clipPath: polygonOf(whole), opacity: 1 },
  ]
}
