// A tile's words, fitted to its size on screen. The title is laid out at 16px and scaled with the
// tile, 0.16 of its radius, and stops growing at 22px, from a radius of about 138: past that, the
// words keep their size and the light grows around them. Under a radius of 72 the title shows alone,
// never below 11px; under a radius of 30, where 11px no longer fits, a tile is a light without words.
// The preview, at two thirds of the title, takes as many lines as the box has left under it. A tile
// standing alone at the center, folded, is read rather than glanced at: its words grow on with it,
// up to a title of 44px, and its preview, half the title, takes the box the hex gives it. Pure.

const titleShare = 0.16
const titleMax = 22
const titleMin = 11
/** Under this radius on screen, the title shows alone. */
const aloneBelow = 72
/** Under this one, no words at all: the tile is its light. */
const wordlessBelow = 30
/** The box the words sit in, as a share of the radius: centered lines leave the slanted sides alone. */
const box = { width: 1.46, height: 1.15 }
/**
 * A title alone takes the hex's widest band instead: its two lines at most sit in the middle, where
 * the slanted sides leave room, and the box's corners stay empty.
 */
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
  if (radius < aloneBelow) {
    return {
      title: Math.max(Math.min(laid, titleMax), titleMin),
      preview: undefined,
      width: radius * aloneWidth,
      height: radius * box.height,
      capped: false,
    }
  }
  // Below 1 once the title stopped at 22px: the box stops with it.
  const scale = Math.min(1, titleMax / laid)
  return {
    title: laid * scale,
    preview: (laid * scale * 2) / 3,
    width: radius * box.width * scale,
    height: radius * box.height * scale,
    capped: scale < 1,
  }
}

/** The words of a tile alone at the center, as a share of its radius, and where they stop. */
const lone = {
  title: { share: 0.11, max: 44 },
  preview: { share: 0.5, min: 15, max: 21 },
  /** Narrower than a ring's, so a line of the preview stays a line a reader takes in. */
  box: { width: 1.3, height: 1.1 },
}

/**
 * The words of a tile standing alone at the center, folded, whose radius on screen is `radius` px:
 * as a ring's until its words would grow past 22px, then growing on with it, the preview read whole.
 */
export function fitAlone(radius: number): Fit | undefined {
  const title = Math.min(lone.title.share * radius, lone.title.max)
  const ring = fitWords(radius)
  if (ring === undefined || title <= ring.title) return ring
  const preview = Math.min(Math.max(title * lone.preview.share, lone.preview.min), lone.preview.max)
  return {
    title,
    preview,
    width: radius * lone.box.width,
    height: radius * lone.box.height,
    capped: title === lone.title.max,
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
