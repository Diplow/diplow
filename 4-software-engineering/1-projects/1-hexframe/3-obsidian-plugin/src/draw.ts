// Draws a Frame as SVG with Obsidian's DOM helpers. Colors come from styles.css, through
// Obsidian's CSS variables, so the drawing follows the theme, light and dark.
import { patternOf } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import {
  hexCorners,
  layoutView,
  viewHeight,
  viewWidth,
  type FrameView,
  type Placement,
  type Point,
} from '../../2-claude-mod/hooks/shape/layout.ts'

/** Units of the SVG per unit of the layout. */
const scale = 110

/** A hex's radius as drawn, short of the layout's 1, leaving a gap between neighbors. */
const radius = 0.93

/** The width of the band between a hex's side corners, where its words sit, in SVG units. */
const band = Math.sqrt(3) * radius * scale * 0.86

/** How each kind of text is set: its class in styles.css, which colors it, and its size. */
interface TextStyle {
  cls: string
  size: number
  lineHeight: number
}

const title: TextStyle = { cls: 'hexframe-title', size: 15, lineHeight: 18 }
const preview: TextStyle = { cls: 'hexframe-preview', size: 11, lineHeight: 14.3 }
const direction: TextStyle = { cls: 'hexframe-direction', size: 11, lineHeight: 14.3 }

/** About how wide a character of the interface font is, as a share of its size. */
const characterWidth = 0.55

/** How many characters of `style` fit on a line of the band. */
const perLine = (style: TextStyle) => Math.floor(band / (style.size * characterWidth))

/** Draws `view` into `container`, replacing what it held, with `notes` under the drawing. */
export function drawView(container: HTMLElement, view: FrameView, notes: readonly string[]) {
  container.empty()
  const svg = container.createSvg('svg', {
    cls: 'hexframe-canvas',
    attr: {
      viewBox: `0 0 ${round(viewWidth * scale)} ${round(viewHeight * scale)}`,
      role: 'img',
      'aria-label': view.frame.tile.title,
    },
  })
  for (const placement of layoutView(view)) drawHex(svg, placement)
  drawNotes(container, notes)
}

/** Shows only `notes`, when there is no Frame to draw. */
export function drawNotes(container: HTMLElement, notes: readonly string[]) {
  if (notes.length === 0) return
  const list = container.createEl('ul', { cls: 'hexframe-notes' })
  for (const note of notes) list.createEl('li', { text: note })
}

function drawHex(svg: SVGSVGElement, placement: Placement) {
  const kind = placement.kind === 'member' ? placement.memberKind : placement.kind
  const group = svg.createSvg('g', { cls: ['hexframe-hex', `is-${kind}`] })
  const points = hexCorners(placement.center, radius)
    .map(({ x, y }) => `${round(x * scale)},${round(y * scale)}`)
    .join(' ')
  group.createSvg('polygon', { attr: { points } })
  const at = { x: placement.center.x * scale, y: placement.center.y * scale }

  if (placement.kind === 'empty') {
    words(group, { ...at, y: at.y + direction.size / 2 }, direction, [String(placement.direction)])
    return
  }
  const { tile } = placement
  group.createSvg('title').textContent =
    tile.preview === '' ? tile.title : `${tile.title}\n\n${tile.preview}`
  if (placement.kind === 'member') {
    const label = { ...at, y: at.y - radius * scale * 0.68 }
    words(group, label, direction, [String(placement.direction)])
  }

  const titleLines = wrap(tile.title, perLine(title), 2)
  const previewLines = wrap(tile.preview, perLine(preview), placement.kind === 'center' ? 5 : 4)
  const titleHeight = titleLines.length * title.lineHeight
  const gap = previewLines.length > 0 ? 6 : 0
  const top = at.y - (titleHeight + gap + previewLines.length * preview.lineHeight) / 2
  words(group, { ...at, y: top + title.size }, title, titleLines)
  words(group, { ...at, y: top + titleHeight + gap + preview.size }, preview, previewLines)
}

/** One `<text>` of `lines` set in `style`, centered on `at.x`, its first baseline at `at.y`. */
function words(group: SVGGElement, at: Point, style: TextStyle, lines: readonly string[]) {
  if (lines.length === 0) return
  const text = group.createSvg('text', {
    cls: style.cls,
    attr: { x: round(at.x), y: round(at.y), 'font-size': style.size },
  })
  lines.forEach((line, index) => {
    const tspan = text.createSvg('tspan', {
      attr: { x: round(at.x), dy: index === 0 ? 0 : round(style.lineHeight) },
    })
    tspan.textContent = line
  })
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

/** What the view says about the ring it shows: its clashes, or why it shows no hexes. */
export function ringNotes(view: FrameView): string[] {
  const ring = view.frame.rings[view.frameKind]
  if (ring === undefined) return []
  if (ring.overflowing) {
    const names = ring.overflow.map(patternOf).join(', ')
    return [
      `${String(ring.candidates.length)} ${view.frameKind} for six directions, so none is drawn: ` +
        `no direction is left for ${names}. List what this folder leaves out in ` +
        '.hexframe/exclusions.yaml, or renumber, to draw them.',
    ]
  }
  if (!('clashes' in ring)) return []
  return ring.clashes.map(
    ({ direction, leaf, branch }) =>
      `${leaf} and ${branch}/ share direction ${String(direction)}: the Leaf takes another one.`,
  )
}

/** `value` to a tenth, as an attribute writes it. */
function round(value: number): string {
  return String(Math.round(value * 10) / 10)
}
