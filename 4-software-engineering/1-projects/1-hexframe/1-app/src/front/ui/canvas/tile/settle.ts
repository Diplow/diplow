// A tile's own motion as its hex changes under it, apart from the bloom and the fold its caller asks
// for: the center settling at its heart as its Context shows inside it, or back as it hides, measured
// against the hex it was drawn in, played on the page's own animations.
import { useLayoutEffect, useRef } from 'react'

import type { Hex } from '../geometry/geometry'
import { easingOf, movingFor } from '../../motion'
import type { TilePlace } from './Tile'

/**
 * The center settling as a ring shows or hides inside it, its Context: from the size it was drawn at
 * to the one it is drawn at now, about its heart, for `--duration-bloom`, as its Context blooms around
 * it or folds back, the ring around it staying where it is. Only while it stays the center, open,
 * since the camera carries it as it opens from alone or folds back; none with reduced motion.
 */
export function useSettle(hex: Hex, place: TilePlace) {
  const settling = useRef<SVGGElement>(null)
  const last = useRef({ hex, place })
  useLayoutEffect(() => {
    const was = last.current
    last.current = { hex, place }
    const from = was.hex.radius / hex.radius
    const moved = Math.hypot(was.hex.center.x - hex.center.x, was.hex.center.y - hex.center.y)
    const duration = movingFor('--duration-bloom')
    if (place !== 'center' || was.place !== place || moved > 1e-6 || duration === 0) return
    if (Math.abs(from - 1) < 1e-6) return
    settling.current?.animate([{ transform: `scale(${String(from)})` }, { transform: 'none' }], {
      duration,
      easing: easingOf(settling.current),
    })
  }, [hex, place])
  return settling
}
