// Draws a Frame as SVG with Obsidian's DOM helpers, an overflowing ring as a list inside the hex
// opened into it, and a list filling the view as HTML. Colors come from styles.css, through
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
import {
  isListed,
  itemsOf,
  tooMany,
  type Clickable,
  type FullList,
  type ListedHex,
} from './list.ts'

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

/**
 * What the view does on a hex that holds a Tile, or a name of a list: when it is clicked, `event`
 * saying whether shift was held, and when it is right-clicked, for its menu. And `list`: a hex's
 * list too long for it opened to fill the view, or, given nothing, the hexes back.
 */
export interface OnHex {
  click: (hex: Clickable, event: MouseEvent) => void
  menu: (hex: Clickable, event: MouseEvent) => void
  list: (hex: ListedHex | undefined) => void
}

/** Outlines the hexes, or the name, holding the Tile at `path`, the focused one, and no other. */
export type Focus = (path: string | undefined) => void

/**
 * Draws `view` into `container`, replacing what it held, with `notes` under the drawing; a click or
 * a right click on a hex that holds a Tile, or on a name of a list, goes to `onHex`. Returns how to
 * outline the focused hex.
 */
export function drawView(
  container: HTMLElement,
  view: FrameView | CollapsedView,
  notes: readonly string[],
  onHex: OnHex,
): Focus {
  container.empty()
  const svg = container.createSvg('svg', {
    cls: 'hexframe-canvas',
    attr: {
      viewBox: `0 0 ${round(viewWidth * scale)} ${round(viewHeight * scale)}`,
      role: 'img',
      'aria-label': view.frame.tile.title,
    },
  })
  const drawn = layoutView(view).flatMap((placement) => drawHex(svg, placement, onHex))
  drawNotes(container, notes)
  return outlineOf(drawn)
}

/**
 * Draws `full`, a list filling the view, into `container`, replacing what it held: its hex as a
 * button, what the list is of, the way back to the hexes when the user opened it, a placeholder for
 * choosing six, then every name, and `notes` under it. A click or a right click on the hex or a
 * name goes to `onHex`. Returns how to outline the focused one.
 */
export function drawFullList(
  container: HTMLElement,
  { holder, back }: FullList,
  notes: readonly string[],
  onHex: OnHex,
): Focus {
  container.empty()
  const list = container.createDiv({ cls: 'hexframe-list' })
  const head = list.createDiv({ cls: 'hexframe-list-head' })
  const hex = head.createDiv({ cls: ['hexframe-list-holder', `is-${kindOf(holder)}`] })
  hex.createSpan({ cls: 'hexframe-list-title', text: holder.tile.title })
  hex.createSpan({ cls: 'hexframe-list-count', text: tooMany(holder.list) })
  clickableOn(hex, holder, onHex)
  const drawn: Drawn[] = [{ group: hex, path: holder.tile.path }]
  if (back) {
    const button = head.createEl('button', { text: 'Back to the hexes' })
    button.addEventListener('click', () => {
      onHex.list(undefined)
    })
  }
  // Choosing which six to draw comes with the hexframe settings, which write the exclusions.
  head.createEl('button', {
    text: 'Choose six',
    attr: { disabled: 'true', title: 'Comes with the hexframe settings' },
  })
  const names = list.createEl('ul', { cls: 'hexframe-list-items' })
  for (const item of itemsOf(holder)) {
    const name = names.createEl('li', {
      cls: ['hexframe-list-item', `is-${item.memberKind}`],
      text: item.tile.title,
    })
    clickableOn(name, item, onHex)
    drawn.push({ group: name, path: item.tile.path })
  }
  drawNotes(container, notes)
  return outlineOf(drawn)
}

/** How to outline the focused one among `drawn`. */
function outlineOf(drawn: readonly Drawn[]): Focus {
  return (path) => {
    for (const one of drawn) one.group.toggleClass('is-focused', one.path === path)
  }
}

/** Hands a click and a right click on `element` to `onHex`, as on `hex`. */
function clickableOn(element: GlobalEventHandlers & Element, hex: Clickable, onHex: OnHex) {
  element.addClass('is-clickable')
  element.addEventListener('click', (event) => {
    // A name of a list sits inside its hex: the click is the name's, not the hex's too.
    event.stopPropagation()
    onHex.click(hex, event)
  })
  element.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onHex.menu(hex, event)
  })
}

/** The kind of hex `hex` is, as styles.css names it. */
function kindOf(hex: Clickable): string {
  return hex.kind === 'center' ? 'center' : hex.memberKind
}

/** Shows only `notes`, when there is no Frame to draw. */
export function drawNotes(container: HTMLElement, notes: readonly string[]) {
  if (notes.length === 0) return
  const list = container.createEl('ul', { cls: 'hexframe-notes' })
  for (const note of notes) list.createEl('li', { text: note })
}

/** A drawn hex holding a Tile, or a name of a list, and the path of that Tile, which the focus names. */
interface Drawn {
  group: HTMLElement | SVGElement
  path: string
}

/** Draws `placement`; what it holds when it holds a Tile, its hex outlined when focused. */
function drawHex(svg: SVGSVGElement, placement: Placement, onHex: OnHex): Drawn[] {
  const kind = placement.kind === 'member' ? placement.memberKind : placement.kind
  const group = svg.createSvg('g', { cls: ['hexframe-hex', `is-${kind}`] })
  const points = hexCorners(placement.center, placement.radius * inset)
    .map(({ x, y }) => `${round(x * scale)},${round(y * scale)}`)
    .join(' ')
  group.createSvg('polygon', { attr: { points } })
  // An opened hex is the ground of the Frame drawn over it, which holds its Tile and its clicks.
  if (placement.kind !== 'empty' && placement.opened) {
    group.addClass('is-opened')
    return [{ group, path: placement.tile.path }]
  }
  const at = { x: placement.center.x * scale, y: placement.center.y * scale }
  const text = textOf(placement.radius, placement.kind === 'center')
  if (placement.radius < 1) group.addClass('is-small')

  if (placement.kind === 'empty') {
    const label = text.direction
    words(group, { ...at, y: at.y + label.size / 2 }, label, [String(placement.direction)])
    return []
  }
  const { tile } = placement
  clickableOn(group, placement, onHex)
  group.createSvg('title').textContent =
    tile.preview === '' ? tile.title : `${tile.title}\n\n${tile.preview}`
  if (isListed(placement)) return [{ group, path: tile.path }, ...drawList(group, placement, onHex)]
  if (placement.kind === 'member' && text.previewLines > 0) {
    const label = { ...at, y: at.y - placement.radius * inset * scale * 0.73 }
    words(group, label, text.direction, [String(placement.direction)])
  }

  const titleLines = wrap(tile.title, perLine(text.title, text.band), 2)
  const previewLines = wrap(tile.preview, perLine(text.preview, text.band), text.previewLines)
  const titleHeight = titleLines.length * text.title.lineHeight
  const space = previewLines.length > 0 ? gap : 0
  const top = at.y - (titleHeight + space + previewLines.length * text.preview.lineHeight) / 2
  words(group, { ...at, y: top + text.title.size }, text.title, titleLines)
  words(
    group,
    { ...at, y: top + titleHeight + space + text.preview.size },
    text.preview,
    previewLines,
  )
  return [{ group, path: tile.path }]
}

/** The gap between a hex's title and what it holds under it, in SVG units. */
const gap = 6

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

/** Whether `hex`'s list fits inside it; when not, the hex says so and opens the list on a click. */
export function fitsIn(hex: ListedHex): boolean {
  return hex.list.ring.candidates.length <= listRows(hex.radius)
}

/**
 * Draws `hex`'s list inside its group, under its title: every name, each one clickable as its hex
 * would be, when they fit; else a line saying how many there are, which opens the list to fill the
 * view. Returns the names drawn.
 */
function drawList(group: SVGGElement, hex: ListedHex, onHex: OnHex): Drawn[] {
  group.addClass('is-listed')
  const text = textOf(hex.radius, hex.kind === 'center')
  const at = { x: hex.center.x * scale, y: hex.center.y * scale }
  const items = fitsIn(hex) ? itemsOf(hex) : []
  const more =
    items.length === 0 ? wrap(tooMany(hex.list), perLine(text.preview, text.band), 2) : []
  const rows = items.length + more.length
  const top = at.y - (text.title.lineHeight + gap + rows * text.preview.lineHeight) / 2
  const titleLine = wrap(hex.tile.title, perLine(text.title, text.band), 1)
  words(group, { ...at, y: top + text.title.size }, text.title, titleLine)
  const rowAt = (row: number) => top + text.title.lineHeight + gap + row * text.preview.lineHeight
  const line = (cls: string, row: number, lines: string[], tip: string) => {
    const one = group.createSvg('g', { cls })
    one.createSvg('rect', {
      attr: {
        x: round(at.x - text.band / 2),
        y: round(rowAt(row)),
        width: round(text.band),
        height: round(text.preview.lineHeight * lines.length),
      },
    })
    words(one, { ...at, y: rowAt(row) + text.preview.size }, text.preview, lines)
    one.createSvg('title').textContent = tip
    return one
  }
  if (items.length === 0) {
    const label = line('hexframe-more', 0, more, 'Show the list')
    label.addEventListener('click', (event) => {
      event.stopPropagation()
      onHex.list(hex)
    })
    return []
  }
  return items.map((item, row) => {
    const name = wrap(item.tile.title, perLine(text.preview, text.band), 1)
    const one = line(`hexframe-item is-${item.memberKind}`, row, name, item.tile.title)
    clickableOn(one, item, onHex)
    return { group: one, path: item.tile.path }
  })
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
    const { candidates, overflow } = ring
    const named = overflow.slice(0, 3).map(patternOf).join(', ')
    const more = overflow.length > 3 ? ` and ${String(overflow.length - 3)} more` : ''
    return [
      `${String(candidates.length)} ${kind} for six directions, so they show as a list: no ` +
        `direction is left for ${named}${more}. List what this folder leaves out in ` +
        '.hexframe/exclusions.yaml, or renumber, to draw them as hexes.',
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
