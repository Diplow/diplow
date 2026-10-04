// Draws a Frame as SVG with Obsidian's DOM helpers. Colors come from styles.css, through
// Obsidian's CSS variables, so the drawing follows the theme, light and dark.
import { patternOf } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import {
  hexCorners,
  layoutView,
  viewHeight,
  viewWidth,
  type CollapsedView,
  type FrameView,
  type Placement,
  type Point,
} from '../../2-claude-mod/hooks/shape/layout.ts'
import type { FrameKind, Frame } from '../../2-claude-mod/hooks/shape/node.ts'

/** Units of the SVG per unit of the layout. */
const scale = 110

/** A hex's radius as drawn, as a share of the layout's, leaving a gap between neighbors. */
const inset = 0.93

/** How each kind of text is set: its class in styles.css, which colors it, and its size. */
interface TextStyle {
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
function textOf(radius: number, isCenter: boolean) {
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
const perLine = (style: TextStyle, band: number) => Math.floor(band / (style.size * characterWidth))

/** What the view does when a hex is clicked: `event` says whether shift or alt was held. */
export type OnHex = (placement: Placement, event: MouseEvent) => void

/**
 * Draws `view` into `container`, replacing what it held, with `notes` under the drawing; a click on
 * a hex that holds a Tile goes to `onHex`.
 */
export function drawView(
  container: HTMLElement,
  view: FrameView | CollapsedView,
  notes: readonly string[],
  onHex: OnHex,
) {
  container.empty()
  const svg = container.createSvg('svg', {
    cls: 'hexframe-canvas',
    attr: {
      viewBox: `0 0 ${round(viewWidth * scale)} ${round(viewHeight * scale)}`,
      role: 'img',
      'aria-label': view.frame.tile.title,
    },
  })
  for (const placement of layoutView(view)) drawHex(svg, placement, onHex)
  drawNotes(container, notes)
}

/** Shows only `notes`, when there is no Frame to draw. */
export function drawNotes(container: HTMLElement, notes: readonly string[]) {
  if (notes.length === 0) return
  const list = container.createEl('ul', { cls: 'hexframe-notes' })
  for (const note of notes) list.createEl('li', { text: note })
}

function drawHex(svg: SVGSVGElement, placement: Placement, onHex: OnHex) {
  const kind = placement.kind === 'member' ? placement.memberKind : placement.kind
  const group = svg.createSvg('g', { cls: ['hexframe-hex', `is-${kind}`] })
  const points = hexCorners(placement.center, placement.radius * inset)
    .map(({ x, y }) => `${round(x * scale)},${round(y * scale)}`)
    .join(' ')
  group.createSvg('polygon', { attr: { points } })
  // An opened hex is the ground of the Frame drawn over it, which holds its Tile and its clicks.
  if (placement.kind !== 'empty' && placement.opened) {
    group.addClass('is-opened')
    return
  }
  const at = { x: placement.center.x * scale, y: placement.center.y * scale }
  const text = textOf(placement.radius, placement.kind === 'center')
  if (placement.generation > 0) group.addClass('is-small')

  if (placement.kind === 'empty') {
    const label = text.direction
    words(group, { ...at, y: at.y + label.size / 2 }, label, [String(placement.direction)])
    return
  }
  const { tile } = placement
  group.addClass('is-clickable')
  group.addEventListener('click', (event) => {
    onHex(placement, event)
  })
  group.createSvg('title').textContent =
    tile.preview === '' ? tile.title : `${tile.title}\n\n${tile.preview}`
  if (placement.kind === 'member' && text.previewLines > 0) {
    const label = { ...at, y: at.y - placement.radius * inset * scale * 0.73 }
    words(group, label, text.direction, [String(placement.direction)])
  }

  const titleLines = wrap(tile.title, perLine(text.title, text.band), 2)
  const previewLines = wrap(tile.preview, perLine(text.preview, text.band), text.previewLines)
  const titleHeight = titleLines.length * text.title.lineHeight
  const gap = previewLines.length > 0 ? 6 : 0
  const top = at.y - (titleHeight + gap + previewLines.length * text.preview.lineHeight) / 2
  words(group, { ...at, y: top + text.title.size }, text.title, titleLines)
  words(
    group,
    { ...at, y: top + titleHeight + gap + text.preview.size },
    text.preview,
    previewLines,
  )
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

/**
 * What the view says about the rings it shows, the center's outer and inner ones and those of the
 * Branches it opens, named: their clashes, or why one shows no hexes.
 */
export function ringNotes(view: FrameView | CollapsedView): string[] {
  const { frame } = view
  const shown = 'frameKind' in view ? [view.frameKind] : []
  if (view.inner !== undefined) shown.push(view.inner)
  const own = shown.flatMap((kind) => notesOf(frame, kind))
  if (!('frameKind' in view)) return own
  const opened = Object.values(view.expanded ?? {}).flatMap((branch) =>
    ringNotes(branch).map((note) => `${branch.frame.tile.title}: ${note}`),
  )
  return [...own, ...opened]
}

/** What the view says about `frame`'s ring of `kind`: its clashes, or why it shows no hexes. */
function notesOf(frame: Frame, kind: FrameKind): string[] {
  const ring = frame.rings[kind]
  if (ring === undefined) return []
  if (ring.overflowing) {
    const names = ring.overflow.map(patternOf).join(', ')
    return [
      `${String(ring.candidates.length)} ${kind} for six directions, so none is drawn: ` +
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
