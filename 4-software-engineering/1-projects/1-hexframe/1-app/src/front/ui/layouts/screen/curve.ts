// The curve the conversation is cut along on a wide screen, which is also its scrollbar. It leaves the
// top of the screen at the chat's edge, bows toward the canvas by half its `bow` at mid-height, and
// comes back to the edge at the foot: a quadratic curve whose offset from the edge depends only on how
// far down the screen it is, so the cut is a polygon in percentages and needs no measuring. The star
// riding it, the scrollbar's thumb, is placed from the messages' scroll, measured once laid out.

/** How far the curve's control point sits past the chat's edge, in px; the curve bows half as far. */
export const bow = 72

/** The curve's offset from the chat's edge, in px, at `t` of the screen's height (0 at the top). */
export function offsetAt(t: number): number {
  return 2 * t * (1 - t) * bow
}

/** The curve's slope, its offset's change per px down a screen `height` px tall, at `t`. */
function slopeAt(t: number, height: number): number {
  return (2 * bow * (1 - 2 * t)) / height
}

/**
 * The chat's column cut along the curve, as a CSS `clip-path`: its left edge, then the curve from the
 * top down, `steps` segments long, `edge` the CSS length the curve leaves from.
 */
export function cutAlongCurve(edge: string, steps = 48): string {
  const curve = Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps
    return `calc(${edge} + ${String(round(offsetAt(t)))}px) ${String(round(t * 100))}%`
  })
  return `polygon(0 0, ${curve.join(', ')}, 0 100%)`
}

/** Where the messages scroll, as measured: the stretch of curve beside them is the track. */
export interface Track {
  /** The screen's height, in px. */
  height: number
  /** The track's top, from the screen's top, in px. */
  top: number
  /** The track's length, in px. */
  length: number
}

export interface Scroll {
  /** How far the messages are scrolled, in px. */
  top: number
  /** Their full height and the height shown, in px. */
  height: number
  client: number
}

/** The star on the curve: where it sits, how long a stretch it lights, and its rays' angle. */
export interface Thumb {
  /** From the screen's top, in px. */
  y: number
  /** From the chat's edge, in px. */
  x: number
  /** The stretch of curve it lights, centred on it, in px. */
  size: number
  /** Its rays along the curve, in degrees. */
  angle: number
}

/** The thumb's shortest stretch, so a long conversation still shows a star you can catch. */
const shortest = 64

/** The star for this scroll, or none while everything shows and there is nothing to scroll. */
export function thumbOf(track: Track, scroll: Scroll): Thumb | undefined {
  const over = scroll.height - scroll.client
  if (over <= 1 || track.length <= 0 || track.height <= 0) return undefined
  const size = Math.min(
    track.length,
    Math.max(shortest, (track.length * scroll.client) / scroll.height),
  )
  const y = track.top + size / 2 + (track.length - size) * clamp(scroll.top / over, 0, 1)
  const t = y / track.height
  return {
    y,
    x: offsetAt(t),
    size,
    angle: (-Math.atan(slopeAt(t, track.height)) * 180) / Math.PI,
  }
}

/** The scroll that puts the star at `y` px from the screen's top, for a click on the track or a drag. */
export function scrollTopAt(track: Track, scroll: Scroll, y: number): number {
  const thumb = thumbOf(track, scroll)
  if (thumb === undefined) return 0
  const travel = track.length - thumb.size
  if (travel <= 0) return 0
  const over = scroll.height - scroll.client
  return clamp((y - track.top - thumb.size / 2) / travel, 0, 1) * over
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
