// The hexframe mod: `/hexframe [folder]` opens a pane that shows the folder as a hexframe, its
// Tile in the middle and its Children or its Context around it, and walks the tree from there.
// Tab outlines the hex whose button it lands on, and `p` swaps the drawing for that hex's
// CLAUDE.md, rendered, or the Tile's when no hex is selected.
import type { EngineInterface, On } from 'claude-code'
import { markdownOf } from './markdown.js'
import { layoutFrame, type Ring } from './shape/layout.js'
import {
  bodyFiles,
  directions,
  join,
  parent,
  resolvePath,
  sortFolders,
  tileOf,
  type Direction,
  type Frame,
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
let ring: Ring = 'children'
/** The member whose button last took the focus: outlined, and what `p` previews. */
let selected: Direction | undefined
/** What the preview shows, while it replaces the drawing; its markdown undefined without a file. */
let preview: { tile: Tile; markdown: string | undefined } | undefined
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
    const members = frame ? (ring === 'children' ? frame.children : frame.context) : {}
    const controls = [
      ...directions
        .filter((direction) => members[direction] !== undefined)
        .map((direction) =>
          Button({
            key: `open-${direction}`,
            label: `${direction} ${members[direction]?.title ?? ''}`,
            hotkey: String(direction),
            plain: true,
            onPress: () => go(members[direction]?.path ?? ''),
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
        label: ring === 'children' ? 'c context' : 'c children',
        hotkey: 'c',
        plain: true,
        dimColor: true,
        onPress: () => {
          ring = ring === 'children' ? 'context' : 'children'
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
            const tile = (selected === undefined ? undefined : members[selected]) ?? frame.tile
            preview = previewOf(tile, await readBody($, tile.path))
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
    const footer = [
      ...(problem ? [Text({ color: 'red', children: [problem] })] : []),
      Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: controls }),
      Text({ dimColor: true, wrap: 'truncate-start', children: [where()] }),
    ]

    if (!frame) return Box({ flexDirection: 'column', children: footer })

    if (preview) {
      // The controls go on top: a long file scrolls, and they stay in sight above it.
      const { Markdown } = $.ui.resolve(e)
      const { markdown, tile } = preview
      const shown = markdown
        ? Markdown({ key: 'preview', text: markdown })
        : Text({
            dimColor: true,
            children: [
              markdown === undefined
                ? `${tile.title} has no CLAUDE.md to show.`
                : `${tile.title}'s CLAUDE.md holds only its frontmatter.`,
            ],
          })
      return Box({ flexDirection: 'column', rowGap: 1, children: [...footer, shown] })
    }

    const placements = layoutFrame({ frame, ring }, depth)
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const scale = scaleFor(e.props.bodyColumns, e.props.scroll.bodyRows - footerRows)
      const drawing =
        scale === undefined
          ? Text({ children: [outline(frame, ring)] })
          : Raster({ key: 'frame', ...paint(placements, scale, selected) })
      return Box({ flexDirection: 'column', rowGap: 1, children: [drawing, ...footer] })
    }
    const { Svg } = $.ui.resolve(e)
    const drawing = Svg({ source: drawSvg(placements, selected), alt: outline(frame, ring) })
    return Box({ flexDirection: 'column', rowGap: 1, children: [drawing, ...footer] })
  })
}

/** Loads `target` as the shown Frame, or keeps the last one and says what went wrong. */
async function show($: EngineInterface, target: string) {
  try {
    const source = await readBody($, target)
    frame = await loadFrame($, target, source)
    // A preview open while walking follows to the new folder's own file.
    if (preview) preview = previewOf(frame.tile, source)
    selected = undefined
    folder = target
    problem = undefined
  } catch (error) {
    problem = `Can't read ${target}: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function loadFrame(
  $: EngineInterface,
  path: string,
  source: string | undefined,
): Promise<Frame> {
  const sorted = sortFolders(await $.fs.list(path))
  const children: Partial<Record<Direction, Tile>> = {}
  const context: Partial<Record<Direction, Tile>> = {}
  for (const direction of directions) {
    const child = sorted.children[direction]
    if (child !== undefined) children[direction] = await loadTile($, join(path, child))
    const meta = sorted.context[direction]
    if (meta !== undefined) context[direction] = await loadTile($, join(path, meta))
  }
  return { tile: tileOf(path, source), children, context, overflow: sorted.overflow }
}

function previewOf(tile: Tile, source: string | undefined): NonNullable<typeof preview> {
  return { tile, markdown: source === undefined ? undefined : markdownOf(source) }
}

async function loadTile($: EngineInterface, path: string): Promise<Tile> {
  return tileOf(path, await readBody($, path))
}

/** The folder's body file, `CLAUDE.md` or else `-CLAUDE.md`, or undefined when it has neither. */
async function readBody($: EngineInterface, path: string): Promise<string | undefined> {
  for (const name of bodyFiles) {
    const file = join(path, name)
    if (await $.fs.exists(file)) return $.fs.read(file)
  }
  return undefined
}

function where(): string {
  const shown = folder ?? ''
  const overflow =
    frame && frame.overflow.length > 0 ? `  ·  no slot: ${frame.overflow.join(', ')}` : ''
  const what = preview ? `${preview.tile.title}'s CLAUDE.md` : ring
  return `${shown}  ·  ${what}${overflow}`
}

/** The Frame as lines of text, where no drawing fits and for readers that can't see one. */
function outline(shown: Frame, shownRing: Ring): string {
  const members = shownRing === 'children' ? shown.children : shown.context
  const lines = [shown.tile.title, ...(shown.tile.preview ? [shown.tile.preview] : []), '']
  for (const direction of directions) {
    const mark = direction === selected ? '›' : ' '
    lines.push(`${mark}${direction}  ${members[direction]?.title ?? '·'}`)
  }
  return lines.join('\n')
}
