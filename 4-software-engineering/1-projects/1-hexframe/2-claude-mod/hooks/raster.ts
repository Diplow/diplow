// Paints a Frame's placements into the cells of a terminal Raster. A cell is about twice as tall
// as it is wide, so it holds two square pixels, drawn with a half block. The hexes are pixel art
// rather than scaled geometry: every hex is the same stamp, set on whole pixels, its slanted sides
// stepping two columns per pixel row, the steadiest line a grid draws near a hex's 30 degrees.
import { frameHeight, frameWidth, type Placement, type Point } from './layout.js'
import type { Direction } from './node.js'

/** The terminal's own color, as a Raster's cells name it. */
const defaultColor = 0x01000000

interface Palette {
  background: number
  title: number
  preview: number
}

const palettes: Record<'center' | 'children' | 'context', Palette> = {
  center: { background: 0x5b3cc4, title: 0xffffff, preview: 0xddd6fe },
  children: { background: 0x2f3446, title: 0xf3f4f6, preview: 0x9ca3af },
  context: { background: 0x134e4a, title: 0xccfbf1, preview: 0x5eead4 },
}

const emptyOutline = 0x4b5563
/** The outline of the hex whose button holds the focus. */
const selectedOutline = 0xfbbf24

/** The size, a quarter of a hex's width in columns, under which a hex is too small to say anything. */
export const minScale = 3
const maxScale = 8

/** Pixels between neighbors: columns across a vertical side, rows above and below a slanted one. */
const gapColumns = 2
const gapRows = 2

export interface Painting {
  columns: number
  rows: number
  /** The cells as a Raster takes them: base64 of `[codePoint, foreground, background]` triplets. */
  cells: string
}

/** A hex's stamp, in pixels: `rise` rows of steps above and below `side` rows at full width. */
interface Stamp {
  width: number
  side: number
  rise: number
  height: number
}

function stampOf(scale: number): Stamp {
  const width = 4 * scale
  // The vertical sides as long as a regular hex's; the flatter steps make it a little shorter.
  const side = Math.round(width / Math.sqrt(3))
  return { width, side, rise: scale, height: side + 2 * scale }
}

/** Rows from one ring row's top to the next one's. */
function pitchOf(stamp: Stamp): number {
  return stamp.side + stamp.rise + gapRows
}

function sizeOf(stamp: Stamp): { columns: number; pixelRows: number } {
  return { columns: 3 * stamp.width + 2 * gapColumns, pixelRows: 2 * pitchOf(stamp) + stamp.height }
}

/** The scale that fits the Frame in `columns` by `rows` cells, or undefined when it can't fit. */
export function scaleFor(columns: number, rows: number): number | undefined {
  for (let scale = maxScale; scale >= minScale; scale--) {
    const size = sizeOf(stampOf(scale))
    if (size.columns <= columns && size.pixelRows <= 2 * rows) return scale
  }
  return undefined
}

/** Paints the placements; the member in direction `selected`, if any, outlined. */
export function paint(
  placements: readonly Placement[],
  scale: number,
  selected?: Direction,
): Painting {
  const stamp = stampOf(scale)
  const size = sizeOf(stamp)
  const columns = Math.min(512, size.columns)
  const rows = Math.min(256, Math.ceil(size.pixelRows / 2))
  const glyphs = new Uint32Array(columns * rows).fill(space)
  const foregrounds = new Uint32Array(columns * rows).fill(defaultColor)
  const backgrounds = new Uint32Array(columns * rows).fill(defaultColor)
  const at = (column: number, row: number) => row * columns + column

  const pixels = pixelsOf(placements, stamp, columns, rows * 2, selected)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const top = pixels[row * 2 * columns + column] ?? defaultColor
      const bottom = pixels[(row * 2 + 1) * columns + column] ?? defaultColor
      const cell = at(column, row)
      if (top === bottom) {
        backgrounds[cell] = top
      } else if (top === defaultColor) {
        // The terminal's own color can't be a foreground, so it is always the background.
        glyphs[cell] = lowerHalf
        foregrounds[cell] = bottom
      } else {
        glyphs[cell] = upperHalf
        foregrounds[cell] = top
        backgrounds[cell] = bottom
      }
    }
  }

  for (const placement of placements) {
    for (const { column, row, text, color } of textOf(placement, stamp, columns, rows)) {
      const background = placement.kind === 'empty' ? defaultColor : paletteOf(placement).background
      let index = 0
      for (const glyph of text) {
        const cell = at(column + index, row)
        glyphs[cell] = glyph.codePointAt(0) ?? space
        foregrounds[cell] = color
        backgrounds[cell] = background
        index++
      }
    }
  }

  const words = new Uint32Array(columns * rows * 3)
  for (let cell = 0; cell < columns * rows; cell++) {
    words[cell * 3] = glyphs[cell] ?? space
    words[cell * 3 + 1] = foregrounds[cell] ?? defaultColor
    words[cell * 3 + 2] = backgrounds[cell] ?? defaultColor
  }
  return { columns, rows, cells: base64(new Uint8Array(words.buffer)) }
}

const space = 0x20
const upperHalf = 0x2580
const lowerHalf = 0x2584

/**
 * The pixel where a placement's stamp starts. The layout's ring sits on a lattice of half a hex
 * across and one ring row down, so its centers map to whole steps of it.
 */
function originOf(center: Point, stamp: Stamp): Point {
  const across = Math.round(((center.x - frameWidth / 2) * 2) / Math.sqrt(3))
  const down = Math.round((center.y - frameHeight / 2) / 1.5)
  return {
    x: stamp.width + gapColumns + (across * (stamp.width + gapColumns)) / 2,
    y: pitchOf(stamp) * (1 + down),
  }
}

/** Whether the stamp covers its pixel `(x, y)`; the steps widen by two columns a side per row. */
function inStamp(x: number, y: number, stamp: Stamp): boolean {
  if (x < 0 || x >= stamp.width || y < 0 || y >= stamp.height) return false
  const step = Math.min(y, stamp.height - 1 - y)
  if (step >= stamp.rise) return true
  return Math.abs(x + 0.5 - stamp.width / 2) < 2 * (step + 1)
}

/**
 * Whether a pixel of the stamp touches the outside, corners included, so the outline it makes
 * runs unbroken along the steps.
 */
function isEdge(x: number, y: number, stamp: Stamp): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!inStamp(x + dx, y + dy, stamp)) return true
    }
  }
  return false
}

/**
 * The color of each pixel: a tile's background, an empty slot's outline, the selected member's
 * outline, or the terminal's.
 */
function pixelsOf(
  placements: readonly Placement[],
  stamp: Stamp,
  columns: number,
  pixelRows: number,
  selected: Direction | undefined,
): Uint32Array {
  const pixels = new Uint32Array(columns * pixelRows).fill(defaultColor)
  for (const placement of placements) {
    const origin = originOf(placement.center, stamp)
    const outlined = placement.kind === 'member' && placement.direction === selected
    for (let y = 0; y < stamp.height; y++) {
      for (let x = 0; x < stamp.width; x++) {
        const column = origin.x + x
        const row = origin.y + y
        if (!inStamp(x, y, stamp) || column >= columns || row >= pixelRows) continue
        const edge = isEdge(x, y, stamp)
        let color: number | undefined
        if (placement.kind === 'empty') color = edge ? emptyOutline : undefined
        else color = edge && outlined ? selectedOutline : paletteOf(placement).background
        if (color !== undefined) pixels[row * columns + column] = color
      }
    }
  }
  return pixels
}

function paletteOf(placement: Exclude<Placement, { kind: 'empty' }>): Palette {
  return palettes[placement.kind === 'center' ? 'center' : placement.ring]
}

interface Line {
  column: number
  row: number
  text: string
  color: number
}

/** A hex's words: its direction on top, then its title and as much of its preview as fits. */
function textOf(placement: Placement, stamp: Stamp, columns: number, rows: number): Line[] {
  const spans = spansOf(originOf(placement.center, stamp), stamp, columns, rows)
  if (spans.length === 0) return []
  const lines: Line[] = []
  const put = (span: Span, text: string, color: number) => {
    const fitted = clip(text, span.width)
    const column = span.start + Math.floor((span.width - fitted.length) / 2)
    lines.push({ column, row: span.row, text: fitted, color })
  }

  if (placement.kind === 'empty') {
    const middle = spans[Math.floor(spans.length / 2)]
    if (middle) put(middle, String(placement.direction), emptyOutline)
    return lines
  }

  const palette = paletteOf(placement)
  // The rows wide enough for a sentence: the hex's band between its side corners, or near it.
  const widest = Math.max(...spans.map((span) => span.width))
  const wide = spans.filter((span) => span.width >= widest * 0.7)
  const width = Math.min(...wide.map((span) => span.width))
  const top = spans[0]
  if (placement.kind === 'member' && top && top.row < (wide[0]?.row ?? 0)) {
    put(top, String(placement.direction), palette.preview)
  }

  const title = wrap(sanitize(placement.tile.title), width, Math.min(2, wide.length))
  const room = wide.length - title.length - 1
  const preview = wrap(sanitize(placement.tile.preview), width, Math.max(0, room))
  const shown = preview.length > 0 ? [...title, '', ...preview] : title
  const first = Math.floor((wide.length - shown.length) / 2)
  shown.forEach((text, index) => {
    const span = wide[first + index]
    if (span) put(span, text, index < title.length ? palette.title : palette.preview)
  })
  return lines
}

interface Span {
  row: number
  start: number
  width: number
}

/**
 * For each cell row a hex covers, its run of cells whose two pixels it both covers, a cell in from
 * either side, so text there sits on its background alone.
 */
function spansOf(origin: Point, stamp: Stamp, columns: number, rows: number): Span[] {
  const spans: Span[] = []
  for (let row = 0; row < rows; row++) {
    let start = -1
    let end = -1
    for (let column = 0; column < columns; column++) {
      const x = column - origin.x
      const y = row * 2 - origin.y
      if (!inStamp(x, y, stamp) || !inStamp(x, y + 1, stamp)) continue
      if (start === -1) start = column
      end = column
    }
    if (start === -1) continue
    const width = end - start + 1 - 4
    if (width > 0) spans.push({ row, start: start + 2, width })
  }
  return spans
}

/** Words in lines of at most `width`, at most `limit` lines, the last cut with an ellipsis. */
export function wrap(text: string, width: number, limit: number): string[] {
  if (limit <= 0 || width <= 0) return []
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`
    if ([...candidate].length <= width) {
      line = candidate
      continue
    }
    if (line !== '') lines.push(line)
    // A word wider than a line is cut, not broken across two.
    line = [...word].length <= width ? word : `${[...word].slice(0, width - 1).join('')}…`
  }
  if (line !== '') lines.push(line)
  if (lines.length <= limit) return lines
  const kept = lines.slice(0, limit)
  kept[limit - 1] = ellipsize(kept[limit - 1] ?? '', width)
  return kept
}

function ellipsize(line: string, width: number): string {
  const glyphs = [...line]
  return glyphs.length < width ? `${line}…` : `${glyphs.slice(0, width - 1).join('')}…`
}

function clip(text: string, width: number): string {
  const glyphs = [...text]
  return glyphs.length <= width ? text : glyphs.slice(0, width).join('')
}

/**
 * Text a Raster cell can hold: one printable, one-column BMP character each. Wide, astral and
 * control characters read `?`; combining and zero-width ones go.
 */
export function sanitize(text: string): string {
  let out = ''
  for (const glyph of text.normalize('NFC')) {
    const code = glyph.codePointAt(0) ?? 0
    if (/\s/.test(glyph)) out += ' '
    else if (isZeroWidth(code)) continue
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0) || code > 0xffff || isWide(code)) {
      out += '?'
    } else out += glyph
  }
  return out
}

function isZeroWidth(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    code === 0xfeff
  )
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2600 && code <= 0x27bf) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xd800 && code <= 0xdfff) ||
    (code >= 0xe000 && code <= 0xf8ff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64, written out since a hooks module has no Buffer. */
export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1] ?? 0
    const c = bytes[index + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c
    out += alphabet[(triple >> 18) & 63]
    out += alphabet[(triple >> 12) & 63]
    out += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '='
    out += index + 2 < bytes.length ? alphabet[triple & 63] : '='
  }
  return out
}
