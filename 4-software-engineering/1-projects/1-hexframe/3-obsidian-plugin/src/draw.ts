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
import type { FrameKind, Frame, MemberKind } from '../../2-claude-mod/hooks/shape/node.ts'
import {
  fitsIn,
  isListed,
  itemsOf,
  ringNames,
  tooMany,
  type Clickable,
  type FullList,
  type ListedHex,
} from './list.ts'
import { gap, inset, perLine, scale, textOf, wrap, type TextStyle } from './text.ts'
import { vaultPath } from './vault/frame.ts'

/**
 * What the view does on a hex that holds a Tile, or a name of a list: when it is clicked, `event`
 * saying whether shift was held, and when it is right-clicked, for its menu. And `list`: a hex's
 * list too long for it opened to fill the view, or, given nothing, the hexes back; `settings`: the
 * settings of the folder whose ring a list is opened, to choose its six.
 */
export interface OnHex {
  click: (hex: Clickable, event: MouseEvent) => void
  menu: (hex: Clickable, event: MouseEvent) => void
  list: (hex: ListedHex | undefined) => void
  settings: (folder: string) => void
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
  const refocus = holdsFocus(container)
  container.empty()
  const svg = container.createSvg('svg', {
    cls: 'hexframe-canvas',
    attr: {
      viewBox: `0 0 ${round(viewWidth * scale)} ${round(viewHeight * scale)}`,
      ...rootOf(view.frame.tile.title),
    },
  })
  const drawn = layoutView(view).flatMap((placement) => drawHex(svg, placement, onHex))
  drawNotes(container, notes)
  if (refocus) svg.focus({ preventScroll: true })
  return outlineOf(svg, drawn)
}

/**
 * Draws `full`, a list filling the view, into `container`, replacing what it held: its hex as a
 * button, what the list is of, the way back to the hexes when the user opened it, the button that
 * opens the settings of its folder to choose six, then every name, and `notes` under it. A click or a right click on the hex or a
 * name goes to `onHex`. Returns how to outline the focused one.
 */
export function drawFullList(
  container: HTMLElement,
  { holder, source }: FullList,
  notes: readonly string[],
  onHex: OnHex,
): Focus {
  const refocus = holdsFocus(container)
  container.empty()
  const list = container.createDiv({ cls: 'hexframe-list', attr: rootOf(holder.tile.title) })
  const head = list.createDiv({ cls: 'hexframe-list-head' })
  const hex = head.createDiv({ cls: ['hexframe-list-holder', `is-${kindOf(holder)}`] })
  hex.createSpan({ cls: 'hexframe-list-title', text: holder.tile.title })
  hex.createSpan({ cls: 'hexframe-list-count', text: tooMany(holder.list) })
  clickableOn(hex, holder, onHex)
  const drawn: Drawn[] = [{ group: hex, path: holder.tile.path, button: buttonOf(hex, holder) }]
  if (source === 'opened') {
    const button = head.createEl('button', { text: 'Back to the hexes' })
    button.addEventListener('click', () => {
      onHex.list(undefined)
    })
  }
  // The six are chosen by leaving the rest out, in the settings of the folder whose ring this is.
  const choose = head.createEl('button', { text: 'Choose six' })
  choose.addEventListener('click', () => {
    onHex.settings(vaultPath(holder.tile.path))
  })
  const names = list.createEl('ul', { cls: 'hexframe-list-items' })
  for (const item of itemsOf(holder)) {
    const name = names.createEl('li', {
      cls: ['hexframe-list-item', `is-${item.memberKind}`],
      text: item.tile.title,
    })
    clickableOn(name, item, onHex)
    drawn.push({ group: name, path: item.tile.path, button: buttonOf(name, item) })
  }
  drawNotes(container, notes)
  if (refocus) list.focus({ preventScroll: true })
  return outlineOf(list, drawn)
}

/**
 * What makes the drawing's root, named `label`, the one stop of the DOM focus in it, for assistive
 * technology: the view's keys, not the browser's, move the focus among its hexes and names, so the
 * root is an application, whose active descendant `outlineOf` sets to the focused one.
 */
function rootOf(label: string): Record<string, string | number> {
  return { role: 'application', tabindex: 0, 'aria-label': label }
}

/** Whether the DOM focus is within `container`, so the drawing replacing its own takes it back. */
function holdsFocus(container: HTMLElement): boolean {
  return container.contains(container.ownerDocument.activeElement)
}

/**
 * How to outline the focused one among `drawn`, which `root` names to assistive technology as its
 * active descendant.
 */
function outlineOf(root: Element, drawn: readonly Drawn[]): Focus {
  return (path) => {
    for (const one of drawn) one.group.toggleClass('is-focused', one.path === path)
    const active = drawn.find((one) => one.path === path && one.button !== undefined)?.button
    if (active === undefined) root.removeAttribute('aria-activedescendant')
    else root.setAttribute('aria-activedescendant', active.id)
  }
}

/** Counts the buttons drawn, so each one's id is unique in the window. */
let buttons = 0

/**
 * Makes `element` `hex`'s button to assistive technology, named as `labelOf` says, with the id the
 * root names when it is focused; the keyboard reaches it through the view's focus.
 */
function buttonOf(element: Element, hex: Clickable): Element {
  element.id = `hexframe-button-${String(++buttons)}`
  element.setAttribute('role', 'button')
  element.setAttribute('aria-label', labelOf(hex))
  return element
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
function kindOf(hex: Clickable): 'center' | MemberKind {
  return hex.kind === 'center' ? 'center' : hex.memberKind
}

/** How assistive technology names each kind of hex, and of name of a list. */
const kindNames: Record<'center' | MemberKind, string> = {
  center: 'the center',
  branch: 'Branch',
  leaf: 'Leaf',
  context: 'Context folder',
}

/** How assistive technology names `hex`, a hex or a name of a list: its title, then its kind. */
export function labelOf(hex: Clickable): string {
  return `${hex.tile.title}, ${kindNames[kindOf(hex)]}`
}

/** Shows only `notes`, when there is no Frame to draw. */
export function drawNotes(container: HTMLElement, notes: readonly string[]) {
  if (notes.length === 0) return
  const list = container.createEl('ul', { cls: 'hexframe-notes' })
  for (const note of notes) list.createEl('li', { text: note })
}

/**
 * A drawn hex holding a Tile, or a name of a list, the path of that Tile, which the focus names,
 * and its button to assistive technology, which an opened hex, the ground of a Frame, lacks.
 */
interface Drawn {
  group: HTMLElement | SVGElement
  path: string
  button?: Element
}

/** Draws `placement`; what it holds when it holds a Tile, its hex outlined when focused. */
function drawHex(svg: SVGSVGElement, placement: Placement, onHex: OnHex): Drawn[] {
  const kind = placement.kind === 'member' ? placement.memberKind : placement.kind
  const group = svg.createSvg('g', { cls: ['hexframe-hex', `is-${kind}`] })
  const points = hexCorners(placement.center, placement.radius * inset)
    .map(({ x, y }) => `${round(x * scale)},${round(y * scale)}`)
    .join(' ')
  const shape = group.createSvg('polygon', { attr: { points } })
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
  if (placement.kind === 'member' && text.previewLines > 0) {
    const label = { ...at, y: at.y - placement.radius * inset * scale * 0.73 }
    words(group, label, text.direction, [String(placement.direction)])
  }
  if (isListed(placement)) {
    // Its names are buttons, which a button can't hold: its shape is the hex's button.
    const button = buttonOf(shape, placement)
    return [{ group, path: tile.path, button }, ...drawList(group, placement, onHex)]
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
  return [{ group, path: tile.path, button: buttonOf(group, placement) }]
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
  const line = (cls: string[], row: number, lines: string[], tip: string) => {
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
    const label = line(['hexframe-more'], 0, more, 'Show the list')
    label.addEventListener('click', (event) => {
      event.stopPropagation()
      onHex.list(hex)
    })
    return []
  }
  return items.map((item, row) => {
    const name = wrap(item.tile.title, perLine(text.preview, text.band), 1)
    const one = line(['hexframe-item', `is-${item.memberKind}`], row, name, item.tile.title)
    clickableOn(one, item, onHex)
    return { group: one, path: item.tile.path, button: buttonOf(one, item) }
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
 * What the view says about the rings it shows, the center's outer and inner ones and those of the
 * Branches it opens, named: their clashes, or why one shows as a list; only the latter for the
 * center's outer ring when it overflows, since the view is then that list alone.
 */
export function ringNotes(view: FrameView | CollapsedView): string[] {
  const { frame } = view
  // A view whose own ring overflows is that list alone: its other rings aren't on screen.
  if ('frameKind' in view && frame.rings[view.frameKind]?.overflowing === true) {
    return notesOf(frame, view.frameKind)
  }
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
      `${String(candidates.length)} ${ringNames[kind]} for six directions, so they show as a ` +
        `list: no direction is left for ${named}${more}. List what this folder leaves out in ` +
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
