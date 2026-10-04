// How words are set in a hex of the drawing: the SVG's scale, the text styles sized to a hex's
// radius, lines wrapped to its band, and how many names a list holds in it. Pure, so the drawing
// and what the focus reaches agree on it without Obsidian.

/** Units of the SVG per unit of the layout. */
export const scale = 110

/** A hex's radius as drawn, as a share of the layout's, leaving a gap between neighbors. */
export const inset = 0.93

/** How each kind of text is set: its class in styles.css, which colors it, and its size. */
export interface TextStyle {
  cls: string
  size: number
  lineHeight: number
}

/** The text styles of a hex of radius 1; a smaller or larger hex sets them smaller or larger. */
const title: TextStyle = { cls: 'hexframe-title', size: 15, lineHeight: 18 }
const preview: TextStyle = { cls: 'hexframe-preview', size: 11, lineHeight: 14.3 }
const direction: TextStyle = { cls: 'hexframe-direction', size: 11, lineHeight: 14.3 }

/** About how wide a character of the interface font is, as a share of its size. */
const characterWidth = 0.55

/**
 * How a hex of `radius` sets its words: the styles scaled to it, within bounds so a small hex
 * stays legible and a large one doesn't shout, and how many preview lines it holds. A hex a third
 * of the first generation's size shows its title only.
 */
export function textOf(radius: number, isCenter: boolean) {
  const factor = Math.min(Math.max(radius, 0.5), 1.6)
  const sized = (style: TextStyle): TextStyle => ({
    ...style,
    size: style.size * factor,
    lineHeight: style.lineHeight * factor,
  })
  const previewLines = radius < 0.75 ? 0 : radius > 2 ? 9 : isCenter ? 5 : 4
  // The width of the band between a hex's side corners, where its words sit, in SVG units.
  const band = Math.sqrt(3) * radius * inset * scale * 0.86
  return {
    title: sized(title),
    preview: sized(preview),
    direction: sized(direction),
    previewLines,
    band,
  }
}

/** How many characters of `style` fit on a line of `band`. */
export const perLine = (style: TextStyle, band: number) =>
  Math.floor(band / (style.size * characterWidth))

/** The gap between a hex's title and what it holds under it, in SVG units. */
export const gap = 6

/**
 * How many names a list holds inside a hex of `radius`, one per line under its title, in the band
 * where its words sit and a height of 1.1 times its radius as drawn, which the band leaves inside
 * the hex's sides.
 */
export function listRows(radius: number): number {
  const text = textOf(radius, false)
  const height = 1.1 * radius * inset * scale
  const rows = (height - text.title.lineHeight - gap) / text.preview.lineHeight
  return Math.max(0, Math.floor(rows))
}

/**
 * `text` on one line, in lines of at most `width` characters, at most `limit` of them, the last
 * cut with an ellipsis when the text runs past it. A word wider than a line is cut, not broken.
 */
export function wrap(text: string, width: number, limit: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`
    if (charactersOf(candidate).length <= width) {
      line = candidate
      continue
    }
    if (line !== '') lines.push(line)
    line = word
    // A word cut to the width ends its line, so the ellipsis stays at the end of one.
    if (charactersOf(word).length > width) {
      lines.push(cut(word, width))
      line = ''
    }
  }
  if (line !== '') lines.push(line)
  if (lines.length <= limit) return lines
  const kept = lines.slice(0, limit)
  kept[limit - 1] = cut(`${kept[limit - 1] ?? ''}…`, width)
  return kept
}

/** `text` in at most `width` characters, ending with an ellipsis when cut. */
function cut(text: string, width: number): string {
  const characters = charactersOf(text)
  if (characters.length <= width) return text
  return `${characters
    .slice(0, width - 1)
    .join('')
    .trimEnd()}…`
}

/** The characters a reader sees in `text`, an emoji or an accented letter counting as one. */
function charactersOf(text: string): string[] {
  return Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment)
}
