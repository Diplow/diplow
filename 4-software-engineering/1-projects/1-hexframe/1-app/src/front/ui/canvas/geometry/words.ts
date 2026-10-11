// A tile's words, fitted to its size on screen. The title is laid out at 16px and scaled with the
// tile, 0.16 of its radius, and stops growing at 22px, from a radius of about 138: past that, the
// words keep their size and the light grows around them. Under a radius of 72 the title shows alone,
// never below 11px; under a radius of 30, where 11px no longer fits, a tile is a light without words.
// The preview, at two thirds of the title, takes as many lines as the box has left under it. Pure.

const titleShare = 0.16
const titleMax = 22
const titleMin = 11
/** Under this radius on screen, the title shows alone. */
const aloneBelow = 72
/** Under this one, no words at all: the tile is its light. */
const wordlessBelow = 30
/** The box the words sit in, as a share of the radius: centered lines leave the slanted sides alone. */
const box = { width: 1.46, height: 1.15 }
/** A title alone, larger than its share, takes the hex's widest band instead. */
const aloneWidth = 1.62

export interface Fit {
  /** The title's size, in px on screen. */
  title: number
  /** The preview's, two thirds of the title's; none when the title shows alone. */
  preview: number | undefined
  /** The box the words sit in, centered on the hex, in px on screen. */
  width: number
  height: number
  /** Whether the title stopped growing at 22px, so the box stopped with it. */
  capped: boolean
}

/** The words of a tile whose radius, on screen, is `radius` px; none under a radius of 30. */
export function fitWords(radius: number): Fit | undefined {
  if (radius < wordlessBelow) return undefined
  const laid = titleShare * radius
  const alone = radius < aloneBelow
  const title = Math.max(Math.min(laid, titleMax), alone ? titleMin : 0)
  // How much the words were scaled from their share: below 1 once capped, above it once held at 11px.
  const scale = title / laid
  const grown = scale > 1
  return {
    title,
    preview: alone ? undefined : (title * 2) / 3,
    width: radius * (grown ? aloneWidth : box.width * scale),
    height: radius * box.height * (grown ? 1 : scale),
    capped: scale < 1,
  }
}

/**
 * How many of the preview's lines the box holds under what sits above them: as many as fit whole,
 * none when not one does. `slack` forgives a measure rounded down by a pixel.
 */
export function linesThatFit({
  box,
  above,
  lineHeight,
}: {
  box: number
  above: number
  lineHeight: number
}): number {
  const slack = 1
  if (lineHeight <= 0) return 0
  return Math.max(0, Math.floor((box - above + slack) / lineHeight))
}
