// The hexframe mod: `/hexframe [folder]` opens a pane that shows the folder as a hexframe, its
// Tile in the middle and one Frame kind's ring around it (Children, or Branches and Leaves, then
// Context), and walks the tree from there. Opening a Branch or a Context tile walks into it;
// opening a Leaf shows its file. Tab outlines the hex whose button it lands on, and `p` swaps the
// drawing for that hex's file, rendered, or the Tile's CLAUDE.md when no hex is selected.
import type { EngineInterface, On } from 'claude-code'
import { codeOf, markdownOf } from './markdown.js'
import { layoutView } from './shape/layout.js'
import {
  basename,
  bodyFiles,
  directions,
  frameKinds,
  isMarkdown,
  join,
  kindsOf,
  parent,
  resolvePath,
  sortEntries,
  tileOf,
  type Direction,
  type Frame,
  type FrameKind,
  type Member,
  type Ring,
  type Rings,
  type Slot,
  type Tile,
} from './shape/node.js'
import { paint, scaleFor } from './raster.js'
import { drawSvg } from './svg.js'

const pane = 'hexframe'

/** The generations the pane shows from the center, as STACK.md gives claude-mod. */
const depth = 1

/** Rows the pane keeps under the drawing: the controls and the path. */
const footerRows = 4

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
    const { Box, Text, Button } = $.ui.resolve(e)

    const go = async (target: string) => {
      await show($, target)
      $.ui.invalidate('ui.render')
    }
    const members = ringOf(frame, frameKind).members
    const nextKind = cycle(frame, frameKind)
    const controls = [
      ...directions
        .filter((direction) => members[direction] !== undefined)
        .map((direction) =>
          Button({
            key: `open-${direction}`,
            label: `${direction} ${members[direction]?.tile.title ?? ''}`,
            hotkey: String(direction),
            plain: true,
            onPress: () => openMember($, direction),
          }),
        ),
      Button({
        key: 'up',
        label: 'u up',
        hotkey: 'u',
        plain: true,
        dimColor: true,
        onPress: () => go(parent(folder ?? '/')),
      }),
      Button({
        key: 'ring',
        label: `c ${nextKind}`,
        hotkey: 'c',
        plain: true,
        dimColor: true,
        onPress: () => {
          frameKind = nextKind
          selected = undefined
          preview = undefined
          $.ui.invalidate('ui.render')
        },
      }),
      Button({
        key: 'view',
        label: preview ? 'p hexframe' : 'p preview',
        hotkey: 'p',
        plain: true,
        dimColor: true,
        onPress: async () => {
          if (preview) preview = undefined
          else if (frame) {
            const member = selected === undefined ? undefined : members[selected]
            preview = member
              ? await previewOfMember($, member)
              : previewOfFolder(frame.tile, await readBody($, frame.tile.path))
          }
          $.ui.invalidate('ui.render')
        },
      }),
      Button({
        key: 'reload',
        label: 'r reload',
        hotkey: 'r',
        plain: true,
        dimColor: true,
        onPress: () => go(folder ?? '/'),
      }),
    ]
    const clashes = ringOf(frame, frameKind).clashes
    const footer = [
      ...(problem ? [Text({ color: 'red', children: [problem] })] : []),
      ...(clashes.length > 0 && !preview
        ? [
            Text({
              color: 'yellow',
              dimColor: true,
              children: [
                clashes
                  .map(
                    ({ leaf, direction, branch }) => `${leaf} shares ${direction} with ${branch}/`,
                  )
                  .join('  ·  '),
              ],
            }),
          ]
        : []),
      Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: controls }),
      Text({ dimColor: true, wrap: 'truncate-start', children: [where()] }),
    ]

    if (!frame) return Box({ flexDirection: 'column', children: footer })

    if (preview) {
      // The controls go on top: a long file scrolls, and they stay in sight above it.
      const { Markdown } = $.ui.resolve(e)
      const shown =
        'markdown' in preview
          ? Markdown({ key: 'preview', text: preview.markdown })
          : Text({ dimColor: true, children: [preview.note] })
      return Box({ flexDirection: 'column', rowGap: 1, children: [...footer, shown] })
    }

    const placements = layoutView({ frame, frameKind }, depth)
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const rows = e.props.scroll.bodyRows - footerRows - (clashes.length > 0 ? 1 : 0)
      const scale = scaleFor(e.props.bodyColumns, rows)
      const drawing =
        scale === undefined
          ? Text({ children: [outline(frame, frameKind)] })
          : Raster({ key: 'frame', ...paint(placements, scale, selected) })
      return Box({ flexDirection: 'column', rowGap: 1, children: [drawing, ...footer] })
    }
    const { Svg } = $.ui.resolve(e)
    const drawing = Svg({ source: drawSvg(placements, selected), alt: outline(frame, frameKind) })
    return Box({ flexDirection: 'column', rowGap: 1, children: [drawing, ...footer] })
  })
}

/** Opens the member in `direction`: walks into a Branch or a Context tile, shows a Leaf's file. */
async function openMember($: EngineInterface, direction: Direction) {
  const member = ringOf(frame, frameKind).members[direction]
  if (!member) return
  if (member.kind === 'leaf') {
    selected = direction
    preview = await previewOfMember($, member)
  } else {
    await show($, member.tile.path)
  }
  $.ui.invalidate('ui.render')
}

/** Loads `target` as the shown Frame, or keeps the last one and says what went wrong. */
async function show($: EngineInterface, target: string) {
  try {
    const body = await readBody($, target)
    frame = await loadFrame($, target, body)
    // A Frame kind the new folder doesn't offer gives way to its first one.
    if (!kindsOf(frame.rings).includes(frameKind)) frameKind = kindsOf(frame.rings)[0] ?? 'context'
    // A preview open while walking follows to the new folder's own file.
    if (preview) preview = previewOfFolder(frame.tile, body)
    selected = undefined
    folder = target
    problem = undefined
  } catch (error) {
    problem = `Can't read ${target}: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function loadFrame($: EngineInterface, path: string, body: Body | undefined): Promise<Frame> {
  const sorted = sortEntries(await $.fs.list(path))
  const rings: Rings<Member> = {}
  for (const kind of frameKinds) {
    const ring = sorted[kind]
    if (ring) rings[kind] = await loadRing($, path, ring)
  }
  return { tile: tileOf(path, body?.text), rings }
}

async function loadRing($: EngineInterface, path: string, ring: Ring<Slot>): Promise<Ring<Member>> {
  const members: Ring<Member>['members'] = {}
  for (const direction of directions) {
    const slot = ring.members[direction]
    if (slot) members[direction] = { kind: slot.kind, tile: await loadTile($, path, slot) }
  }
  return { ...ring, members }
}

/** A member's Tile: a folder's from its CLAUDE.md, a Markdown Leaf's from its own frontmatter. */
async function loadTile($: EngineInterface, folderPath: string, slot: Slot): Promise<Tile> {
  const path = join(folderPath, slot.name)
  if (slot.kind !== 'leaf') return tileOf(path, (await readBody($, path))?.text)
  if (!isMarkdown(slot.name)) return tileOf(path, undefined)
  // One unreadable file names itself; it doesn't keep the folder from showing.
  return tileOf(path, await $.fs.read(path).catch(() => undefined))
}

/** The ring of `kind` in the shown Frame, empty when there is none. */
function ringOf(shown: Frame | undefined, kind: FrameKind): Ring<Member> {
  return shown?.rings[kind] ?? { members: {}, overflow: [], clashes: [] }
}

/** The Frame kind `c` goes to after `kind`, among the ones the Frame offers. */
function cycle(shown: Frame | undefined, kind: FrameKind): FrameKind {
  const kinds = shown ? kindsOf(shown.rings) : []
  return kinds[(kinds.indexOf(kind) + 1) % kinds.length] ?? kind
}

/** What the preview shows: a file as Markdown, or a note saying why there is nothing to render. */
type Preview = { tile: Tile; label: string } & ({ markdown: string } | { note: string })

/** A folder's body file, by name. */
interface Body {
  name: string
  text: string
}

function previewOfFolder(tile: Tile, body: Body | undefined): Preview {
  if (body === undefined) {
    return { tile, label: tile.title, note: `${tile.title} has no CLAUDE.md to show.` }
  }
  const label = `${tile.title}'s ${body.name}`
  const markdown = markdownOf(body.text)
  return markdown === ''
    ? { tile, label, note: `${label} holds only its frontmatter.` }
    : { tile, label, markdown }
}

/** A member's file: a folder's body file, or a Leaf itself, rendered when it is Markdown. */
async function previewOfMember($: EngineInterface, member: Member): Promise<Preview> {
  const { tile } = member
  if (member.kind !== 'leaf') return previewOfFolder(tile, await readBody($, tile.path))
  const label = basename(tile.path)
  try {
    const text = await $.fs.read(tile.path)
    const markdown = isMarkdown(label) ? markdownOf(text) : codeOf(text)
    if (markdown !== '') return { tile, label, markdown }
    const note = isMarkdown(label) ? `${label} holds only its frontmatter.` : `${label} is empty.`
    return { tile, label, note }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { tile, label, note: `Can't read ${label}: ${reason}` }
  }
}

/** The folder's body file, `CLAUDE.md` or else `-CLAUDE.md`, or undefined when it has neither. */
async function readBody($: EngineInterface, path: string): Promise<Body | undefined> {
  for (const name of bodyFiles) {
    const file = join(path, name)
    if (await $.fs.exists(file)) return { name, text: await $.fs.read(file) }
  }
  return undefined
}

function where(): string {
  const shown = folder ?? ''
  const overflow = ringOf(frame, frameKind).overflow
  const noSlot = overflow.length > 0 && !preview ? `  ·  no slot: ${overflow.join(', ')}` : ''
  return `${shown}  ·  ${preview ? preview.label : frameKind}${noSlot}`
}

/** The Frame as lines of text, where no drawing fits and for readers that can't see one. */
function outline(shown: Frame, kind: FrameKind): string {
  const members = ringOf(shown, kind).members
  const lines = [shown.tile.title, ...(shown.tile.preview ? [shown.tile.preview] : []), '']
  for (const direction of directions) {
    const mark = direction === selected ? '›' : ' '
    const member = members[direction]
    const file = member?.kind === 'leaf' ? `  (${basename(member.tile.path)})` : ''
    lines.push(`${mark}${direction}  ${member?.tile.title ?? '·'}${file}`)
  }
  return lines.join('\n')
}
