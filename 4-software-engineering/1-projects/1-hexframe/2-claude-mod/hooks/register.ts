// The hexframe mod: `/hexframe [folder]` opens a pane that shows the folder as a hexframe, its
// Tile in the middle and one Frame kind's ring around it (Children, or Branches and Leaves, then
// Context), and walks the tree from there. Opening a Branch or a Context tile walks into it;
// opening a Leaf shows its file. Tab outlines the hex whose button it lands on, and `p` swaps the
// drawing for that hex's file, rendered, or the Tile's CLAUDE.md when no hex is selected. A ring
// that overflows shows as a list of its names instead, each opening as its hex would.
import type { Elements, EngineInterface, On } from 'claude-code'
import { outline } from './draw/outline.js'
import { paint, scaleFor } from './draw/raster.js'
import { drawSvg } from './draw/svg.js'
import { controlGap, footerRows, rowGap, type Control } from './footer.js'
import { leafPreview, markdownPreview, oneLine, type Shown } from './markdown.js'
import { exclusionsFile, exclusionsFrom, patternOf } from './shape/exclusions.js'
import { layoutView } from './shape/layout.js'
import {
  basename,
  bodySources,
  directions,
  type Clash,
  join,
  kindsOf,
  membersOf,
  parent,
  resolvePath,
  sortEntries,
  tileOf,
  type Direction,
  type Frame,
  type FrameKind,
  type Member,
  type OverflowingRing,
  type Ring,
  type Rings,
  type SeatedRing,
  type Slot,
  type FileRead,
  type Tile,
  unreadable,
} from './shape/node.js'

const pane = 'hexframe'

let folder: string | undefined
let frame: Frame | undefined
let frameKind: FrameKind = 'children'
/** The member whose button last took the focus: outlined, and what `p` previews. */
let selected: Direction | undefined
/** What the preview shows while it replaces the drawing: a file's Markdown, or a note without one. */
let preview: Preview | undefined
let problem: string | undefined

export function register(on: On) {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hexframe',
      description: 'Show a folder as a hexframe: its tile, its children and its context',
      argumentHint: '[folder]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'hexframe' }, async ($, e) => {
    const asked = e.args.trim()
    await show($, resolvePath(await $.session.cwd(), asked === '' ? '.' : asked))
    await $.ui.open({ id: pane, title: 'Hexframe', focus: true, closeOnEscape: true, rows: 32 })
    return {}
  })

  on('ui.focus', async ($, e, next) => {
    const result = await next(e)
    if (e.requestId !== pane || result.deny !== undefined) return result
    // Only a hex's button selects; the controls keep the selection, so Tab onto `p` previews it.
    const member = /^open-([1-6])$/.exec(e.element ?? '')
    if (member) {
      selected = Number(member[1]) as Direction
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== pane) return next(e)
    const ui = $.ui.resolve(e)
    const ring = ringOf(frame, frameKind)
    const clashes = preview ? [] : clashesOf(frame, frameKind)
    const controls = controlsOf($, membersOf(ring))
    const footer = footerOf(ui, controls, clashes)
    const column = (children: ReturnType<Ui['Box']>[]) =>
      ui.Box({ flexDirection: 'column', rowGap, children })

    if (!frame) return ui.Box({ flexDirection: 'column', children: footer })
    // The controls go on top of a preview or a list: a long one scrolls, and they stay in sight.
    if (preview) return column([...footer, previewElement(ui, preview)])
    if (ring.overflowing) return column([...footer, ...listOf($, ui, ring)])

    const view = { frame, frameKind }
    const placements = layoutView(view)
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const { bodyColumns, scroll } = e.props
      const under = footerRows(bodyColumns, { problem, hasClashes: clashes.length > 0, controls })
      const scale = scaleFor(bodyColumns, scroll.bodyRows - under)
      const drawing =
        scale === undefined
          ? ui.Text({ children: [outline(view, selected)] })
          : Raster({ key: 'frame', ...paint(placements, scale, selected) })
      return column([drawing, ...footer])
    }
    const { Svg } = $.ui.resolve(e)
    return column([
      Svg({ source: drawSvg(placements, selected), alt: outline(view, selected) }),
      ...footer,
    ])
  })
}

/** The elements every surface draws the pane with. */
type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown'>

/** The lines that go with the drawing: the red one, the clashes, the controls and where the pane is. */
function footerOf(
  { Box, Text, Button }: Ui,
  controls: readonly PaneControl[],
  clashes: readonly Clash[],
) {
  return [
    ...(problem ? [Text({ color: 'red', children: [oneLine(problem)] })] : []),
    ...(clashes.length > 0 ? [clashLine(Text, clashes)] : []),
    Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: controlGap,
      children: controls.map((control) => Button({ ...control, plain: true })),
    }),
    Text({ dimColor: true, wrap: 'truncate-start', children: [oneLine(where())] }),
  ]
}

/** A control of the pane: what its Button draws, and what pressing it does. */
type PaneControl = Control & {
  key: string
  hotkey: string
  dimColor?: true
  onPress: () => unknown
}

/** A button per member, then the pane's keys. */
function controlsOf(
  $: EngineInterface,
  members: Partial<Record<Direction, Member>>,
): PaneControl[] {
  const nextKind = cycle(frame, frameKind)
  // Each key's label opens with its hotkey, as the pane shows it.
  const key = (name: string, label: string, onPress: () => unknown): PaneControl => ({
    key: name,
    label,
    hotkey: label.charAt(0),
    dimColor: true,
    onPress,
  })
  return [
    ...directions.flatMap((direction) => {
      const member = members[direction]
      if (!member) return []
      return {
        key: `open-${direction}`,
        label: oneLine(`${direction} ${member.tile.title}`),
        hotkey: String(direction),
        onPress: () => openMember($, direction),
      }
    }),
    key('up', 'u up', () => go($, parent(folder ?? '/'))),
    key('ring', `c ${nextKind}`, () => {
      frameKind = nextKind
      selected = undefined
      preview = undefined
      $.ui.invalidate('ui.render')
    }),
    key('view', preview ? 'p hexframe' : 'p preview', () => togglePreview($, members)),
    key('reload', 'r reload', () => go($, folder ?? '/')),
  ]
}

/** What the preview shows in place of the drawing: the file's Markdown, or the note without one. */
function previewElement({ Markdown, Text }: Ui, shown: Preview) {
  return 'markdown' in shown
    ? Markdown({ key: 'preview', text: shown.markdown })
    : Text({ dimColor: true, children: [oneLine(shown.note)] })
}

/** Swaps the drawing for the selected member's file, or the shown folder's own, and back. */
async function togglePreview($: EngineInterface, members: Partial<Record<Direction, Member>>) {
  if (preview) preview = undefined
  else if (frame) {
    const member = selected === undefined ? undefined : members[selected]
    preview = member
      ? await previewOfMember($, member)
      : previewOfFolder(frame.tile, await readBody($, frame.tile.path))
  }
  $.ui.invalidate('ui.render')
}

/** Shows `target`, and draws the pane again. */
async function go($: EngineInterface, target: string) {
  await show($, target)
  $.ui.invalidate('ui.render')
}

/** The dim line under the drawing that names each Leaf numbered like the Branch it sits beside. */
function clashLine(Text: Elements['terminal']['Text'], clashes: readonly Clash[]) {
  const named = clashes.map(
    ({ leaf, direction, branch }) => `${leaf} shares ${direction} with ${branch}/`,
  )
  return Text({
    color: 'yellow',
    dimColor: true,
    wrap: 'truncate-end',
    children: [oneLine(named.join('  ·  '))],
  })
}

/** An overflowing ring as the pane shows it: the hint, then every candidate's name as a button. */
function listOf($: EngineInterface, { Box, Text, Button }: Ui, ring: OverflowingRing) {
  const items = ring.candidates.map((slot, index) =>
    Button({
      key: `item-${index + 1}`,
      label: oneLine(patternOf(slot)),
      plain: true,
      onPress: () => openSlot($, slot),
    }),
  )
  return [
    Text({ dimColor: true, wrap: 'wrap', children: [oneLine(overflowHint(ring, frameKind))] }),
    Box({ key: 'list', flexDirection: 'column', children: items }),
  ]
}

/** Opens the member in `direction`: walks into a Branch or a Context tile, shows a Leaf's file. */
async function openMember($: EngineInterface, direction: Direction) {
  const member = membersOf(ringOf(frame, frameKind))[direction]
  if (!member) return
  if (member.kind === 'leaf') {
    selected = direction
    preview = await previewOfLeaf($, member.tile.path)
  } else {
    await show($, member.tile.path)
  }
  $.ui.invalidate('ui.render')
}

/** Opens a name of an overflowing ring's list, as its hex would open. */
async function openSlot($: EngineInterface, slot: Slot) {
  if (folder === undefined) return
  const path = join(folder, slot.name)
  if (slot.kind === 'leaf') preview = await previewOfLeaf($, path)
  else await show($, path)
  $.ui.invalidate('ui.render')
}

/** Loads `target` as the shown Frame, or keeps the last one and says what went wrong. */
async function show($: EngineInterface, target: string) {
  try {
    const body = await readBody($, target)
    const { exclusions, warning } = exclusionsFrom(await readInFolder($, target, exclusionsFile))
    frame = await loadFrame($, target, body, exclusions)
    // A Frame kind the new folder doesn't offer gives way to its first one.
    if (!kindsOf(frame.rings).includes(frameKind)) frameKind = kindsOf(frame.rings)[0] ?? 'context'
    // A preview open while walking follows to the new folder's own file.
    if (preview) preview = previewOfFolder(frame.tile, body)
    selected = undefined
    folder = target
    problem = warning
  } catch (error) {
    problem = `Can't read ${target}: ${messageOf(error)}`
  }
}

async function loadFrame(
  $: EngineInterface,
  path: string,
  body: Body | undefined,
  exclusions: readonly string[],
): Promise<Frame> {
  const sorted = sortEntries(await $.fs.list(path), exclusions)
  const rings: Rings<Member> = {}
  if (sorted.children) rings.children = await loadRing($, path, sorted.children)
  for (const kind of ['branches', 'leaves', 'context'] as const) {
    const ring = sorted[kind]
    if (ring) rings[kind] = await loadRing($, path, ring)
  }
  return { tile: tileOf(path, textOf(body)), rings }
}

/** A seated ring of Slots, `R`, with each one's Tile read. */
type Loaded<R extends SeatedRing<Slot>> = Omit<R, 'members'> & SeatedRing<Member>

/**
 * Reads the Tile of each seated member, keeping what else the ring carries, a Children ring its
 * clashes; an overflowing ring stays names, and reads no file.
 */
async function loadRing<R extends SeatedRing<Slot>>(
  $: EngineInterface,
  path: string,
  ring: R | OverflowingRing,
): Promise<Loaded<R> | OverflowingRing> {
  if (ring.overflowing) return ring
  const members: SeatedRing<Member>['members'] = {}
  for (const direction of directions) {
    const slot = ring.members[direction]
    if (slot) members[direction] = { kind: slot.kind, tile: await loadTile($, path, slot) }
  }
  return { ...ring, members }
}

/**
 * A member's Tile, from the body the shape says it is read from. One that can't be read names
 * itself, whatever its kind: it doesn't keep the folder from showing.
 */
async function loadTile($: EngineInterface, folderPath: string, slot: Slot): Promise<Tile> {
  const path = join(folderPath, slot.name)
  const body = await readFirst($, bodySources(path, slot.kind))
  return tileOf(path, textOf(body), slot.kind)
}

/** The ring of `kind` in the shown Frame, empty when there is none. */
function ringOf(shown: Frame | undefined, kind: FrameKind): Ring<Member> {
  return shown?.rings[kind] ?? empty
}

const empty: SeatedRing<Member> = { overflowing: false, members: {} }

/** The clashes the shown Frame's ring names: a seated Children ring's, and no other's. */
function clashesOf(shown: Frame | undefined, kind: FrameKind): readonly Clash[] {
  const children = kind === 'children' ? shown?.rings.children : undefined
  return children?.overflowing === false ? children.clashes : []
}

const ringNames: Record<FrameKind, string> = {
  children: 'Children',
  branches: 'Branches',
  leaves: 'Leaves',
  context: 'Context folders',
}

/** Why the ring shows as a list, and what turns it back into hexes. */
function overflowHint({ candidates, overflow }: OverflowingRing, kind: FrameKind): string {
  const named = overflow.slice(0, 3).map(patternOf).join(', ')
  const more = overflow.length > 3 ? ` and ${overflow.length - 3} more` : ''
  return (
    `${candidates.length} ${ringNames[kind]}, and no direction left for ${named}${more}. ` +
    `List what this folder leaves out in ${exclusionsFile}, or renumber, to draw them as hexes.`
  )
}

/** The Frame kind `c` goes to after `kind`, among the ones the Frame offers. */
function cycle(shown: Frame | undefined, kind: FrameKind): FrameKind {
  const kinds = shown ? kindsOf(shown.rings) : []
  return kinds[(kinds.indexOf(kind) + 1) % kinds.length] ?? kind
}

/** What the preview shows: a file as Markdown, or a note saying why there is nothing to render. */
type Preview = { label: string } & Shown

/** A Tile's body file, by name. */
type Body = { name: string } & FileRead

function textOf(read: FileRead | undefined): string | undefined {
  return read && 'text' in read ? read.text : undefined
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function previewOfFolder(tile: Tile, body: Body | undefined): Preview {
  if (body === undefined) {
    return { label: tile.title, note: `${tile.title} has no CLAUDE.md to show.` }
  }
  const label = `${tile.title}'s ${body.name}`
  if ('unread' in body) return { label, note: `Can't show ${label}: ${body.unread}` }
  return { label, ...markdownPreview(label, body.text) }
}

/** A member's file: a folder's body file, or a Leaf itself. */
async function previewOfMember($: EngineInterface, member: Member): Promise<Preview> {
  const { tile } = member
  if (member.kind === 'leaf') return previewOfLeaf($, tile.path)
  return previewOfFolder(tile, await readBody($, tile.path))
}

/** A Leaf's file, rendered when it is Markdown and shown as it is otherwise. */
async function previewOfLeaf($: EngineInterface, path: string): Promise<Preview> {
  const label = basename(path)
  const read = await readInFolder($, parent(path), label)
  if (read === undefined) return { label, note: `${label} is gone: r reads the folder again.` }
  if ('unread' in read) return { label, note: `Can't show ${label}: ${read.unread}` }
  return { label, ...leafPreview(label, read.text) }
}

/** The folder's body file, `CLAUDE.md` or else `-CLAUDE.md`, or undefined when it has neither. */
function readBody($: EngineInterface, path: string): Promise<Body | undefined> {
  return readFirst($, bodySources(path, 'branch'))
}

/** The first of `files` that exists, read, or undefined when none does. */
async function readFirst($: EngineInterface, files: readonly string[]): Promise<Body | undefined> {
  for (const file of files) {
    const name = basename(file)
    const read = await readInFolder($, parent(file), name)
    if (read) return { name, ...read }
  }
  return undefined
}

/**
 * `relative`, a file of `folder`, read when the shape's `unreadable` lets a medium read it, or
 * undefined when there is none. Every file the pane reads goes through here. It never throws: a
 * read that fails gives its reason, as a file left unread does.
 */
async function readInFolder(
  $: EngineInterface,
  folder: string,
  relative: string,
): Promise<FileRead | undefined> {
  const path = join(folder, relative)
  try {
    if (!(await $.fs.exists(path))) return undefined
    const [file, home] = await Promise.all([
      $.fs.stat(path, { resolve: true }),
      $.fs.stat(folder, { resolve: true }),
    ])
    const unread = unreadable(file, home.realPath, relative)
    return unread === undefined ? { text: await $.fs.read(path) } : { unread }
  } catch (error) {
    return { unread: messageOf(error) }
  }
}

function where(): string {
  return `${folder ?? ''}  ·  ${preview ? preview.label : frameKind}`
}
