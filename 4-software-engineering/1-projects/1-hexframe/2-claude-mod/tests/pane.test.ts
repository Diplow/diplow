import type { FsEntry, On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'hexframe',
  component: 'Pane',
  requestId: 'hexframe',
  viewport: { columns: 100, rows: 40 },
  props: {
    title: 'Hexframe',
    isFocused: true,
    bodyColumns: 96,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 34 },
    view: {},
  },
} as const

/** `/hexframe <args>`, typed at the prompt of a fullscreen terminal. */
const hexframe = (args: string) => ({
  command: 'hexframe',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 100 },
})

const entry =
  (kind: 'dir' | 'file') =>
  (name: string): FsEntry => ({
    name,
    kind,
    size: 0,
    mtimeMs: 0,
    isLink: false,
  })
const dir = entry('dir')
const file = entry('file')

/** A vault: the root with two Children and a meta folder, and one grandchild. */
const folders: Record<string, FsEntry[]> = {
  '/work': [file('CLAUDE.md'), dir('1-leadership'), dir('4-software-engineering'), dir('.claude')],
  '/work/1-leadership': [],
  '/work/4-software-engineering': [file('-CLAUDE.md'), dir('1-projects')],
  '/work/4-software-engineering/1-projects': [],
  '/work/.claude': [],
}
const files: Record<string, string> = {
  '/work/CLAUDE.md': '---\ntitle: diplow\npreview: Who I am\n---\n# diplow\n\nThe vault.\n',
  '/work/4-software-engineering/-CLAUDE.md': '---\ntitle: Software Engineering\n---\n',
}

test('/hexframe opens a pane that draws the folder and walks into a child', async ($, on) => {
  on('session.cwd', () => ({ value: '/work' }))
  on('fs.list', ($, e) => {
    const entries = folders[e.path]
    if (!entries) return { deny: 'no such folder' }
    return { value: entries }
  })
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('fs.read', ($, e) => ({ value: files[e.path] ?? '' }))
  const opened: unknown[] = []
  on('ui.open', ($, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })

  expect(await $.command.run(hexframe(''))).toEqual({})
  expect(opened).toMatchObject([{ id: 'hexframe', focus: true, closeOnEscape: true }])

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await terminal.find({ key: 'frame' })).toBeDefined()
  expect(await terminal.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 Leadership' } })
  expect(await terminal.find({ key: 'open-4' })).toMatchObject({
    props: { label: '4 Software Engineering' },
  })

  await terminal.press({ key: 'ring' })
  expect(await terminal.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 .claude' } })
  await terminal.press({ key: 'ring' })

  // `p` shows the folder's CLAUDE.md in place of the drawing, its frontmatter left to the Tile
  await terminal.press({ key: 'view' })
  expect(await terminal.find({ key: 'frame' })).toBeUndefined()
  expect(await terminal.find({ key: 'preview' })).toMatchObject({
    props: { text: '# diplow\n\nThe vault.' },
  })
  await terminal.press({ key: 'open-4' })
  expect(await terminal.find({ type: 'Text', text: /holds only its frontmatter/ })).toBeDefined()
  await terminal.press({ key: 'up' })
  await terminal.press({ key: 'view' })
  expect(await terminal.find({ key: 'frame' })).toBeDefined()

  await terminal.press({ key: 'open-4' })
  expect(
    await terminal.find({ type: 'Text', text: /^\/work\/4-software-engineering  ·/ }),
  ).toBeDefined()
  expect(await terminal.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 Projects' } })
  await terminal.press({ key: 'up' })
  expect(await terminal.find({ type: 'Text', text: /^\/work  ·/ })).toBeDefined()

  // Above the vault nothing can be read: the pane says so and keeps the folder it shows
  await terminal.press({ key: 'up' })
  expect(await terminal.find({ type: 'Text', text: /^Can't read \/:/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /^\/work  ·/ })).toBeDefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  await desktop.unmount()
})

test('a folder that cannot be read says so', async ($, on) => {
  on('session.cwd', () => ({ value: '/work' }))
  on('fs.list', () => ({ deny: 'no such folder' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  await $.command.run(hexframe('missing'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^Can't read \/work\/missing/ })).toBeDefined()
})

/** Stubs the file system with `listings` and `texts`, the session in `cwd`. */
function vault(
  on: On,
  cwd: string,
  listings: Record<string, FsEntry[]>,
  texts: Record<string, string>,
) {
  on('session.cwd', () => ({ value: cwd }))
  on('fs.list', ($, e) => {
    const entries = listings[e.path]
    return entries ? { value: entries } : { deny: 'no such folder' }
  })
  on('fs.exists', ($, e) => ({ value: e.path in texts }))
  on('fs.read', ($, e) => (e.path in texts ? { value: texts[e.path] ?? '' } : { deny: 'no file' }))
  on('fs.stat', ($, e) => ({
    value: { kind: 'file', size: (texts[e.path] ?? '').length, mtimeMs: 0, isLink: false },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

test('Leaves join the Branches in the Children, and opening one shows its file', async ($, on) => {
  vault(
    on,
    '/v',
    {
      '/v': [
        file('CLAUDE.md'),
        dir('3-games'),
        file('3-games.md'),
        file('package.json'),
        file('.gitignore'),
        dir('.claude'),
      ],
      '/v/3-games': [],
      '/v/.claude': [],
    },
    {
      '/v/CLAUDE.md': '---\ntitle: v\n---\n',
      '/v/3-games.md': '---\ntitle: Game notes\n---\n# Notes\n',
      '/v/package.json': '{ "name": "v" }\n',
      '/v/.gitignore': 'node_modules\n',
    },
  )
  await $.command.run(hexframe(''))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // `3-games.md` finds its number held by `3-games/`, so it takes the first free direction
  expect(await ui.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 Game notes' } })
  expect(await ui.find({ key: 'open-2' })).toMatchObject({ props: { label: '2 package.json' } })
  expect(await ui.find({ key: 'open-3' })).toMatchObject({ props: { label: '3 Games' } })
  expect(
    await ui.find({ type: 'Text', text: /^3-games\.md shares 3 with 3-games\/$/ }),
  ).toBeDefined()
  expect(await ui.find({ key: 'ring' })).toMatchObject({ props: { label: 'c context' } })

  // Opening a Leaf shows its file in place of the drawing: Markdown rendered, the rest as it is
  await ui.press({ key: 'open-1' })
  expect(await ui.find({ key: 'preview' })).toMatchObject({ props: { text: '# Notes' } })
  expect(await ui.find({ type: 'Text', text: /^\/v  ·  3-games\.md$/ })).toBeDefined()
  await ui.press({ key: 'open-2' })
  expect(await ui.find({ key: 'preview' })).toMatchObject({
    props: { text: '```\n{ "name": "v" }\n```' },
  })
  await ui.press({ key: 'view' })
  expect(await ui.find({ key: 'frame' })).toBeDefined()
  expect(await ui.find({ key: 'preview' })).toBeUndefined()

  // The Leaf last opened stays selected, so `p` renders it again
  await ui.press({ key: 'view' })
  expect(await ui.find({ key: 'preview' })).toMatchObject({
    props: { text: '```\n{ "name": "v" }\n```' },
  })
  await ui.press({ key: 'view' })

  // Opening a Branch still walks into it
  await ui.press({ key: 'open-3' })
  expect(await ui.find({ type: 'Text', text: /^\/v\/3-games  ·  children$/ })).toBeDefined()
  await ui.unmount()

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await desktop.press({ key: 'up' })
  expect(await desktop.find({ type: 'Svg' })).toMatchObject({
    props: { alt: expect.stringContaining('1  Game notes  (3-games.md)') },
  })
  await desktop.unmount()
})

test('past six Branches and Leaves, `c` cycles the Branches, the Leaves and the Context', async ($, on) => {
  vault(
    on,
    '/big',
    {
      '/big': [
        ...['1-a', '2-b', '3-c', '4-d'].map(dir),
        ...['1-a.md', 'x.md', 'y.md', 'z.png'].map(file),
        dir('.claude'),
      ],
      '/big/1-a': [file('1-a.md')],
    },
    {
      '/big/y.md': '---\ntitle: Huge\n---\n' + 'y'.repeat(1_000_001),
      '/big/z.png': 'PNG\u0000\u0001',
    },
  )
  await $.command.run(hexframe(''))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const kind = async () => (await ui.find({ type: 'Text', text: /^\/big  ·/ }))?.text

  expect(await kind()).toBe('/big  ·  branches')
  expect(await ui.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 A' } })
  await ui.press({ key: 'ring' })
  expect(await kind()).toBe('/big  ·  leaves')
  // A Leaf past the limit is not read, even for its title: its Tile comes from its name
  expect(await ui.find({ key: 'open-3' })).toMatchObject({ props: { label: '3 Y' } })
  // A Leaf too large or not text says so instead of showing
  await ui.press({ key: 'open-3' })
  expect(await ui.find({ type: 'Text', text: 'y.md is too large to show here.' })).toBeDefined()
  await ui.press({ key: 'open-4' })
  expect(await ui.find({ type: 'Text', text: 'z.png is not a text file.' })).toBeDefined()
  await ui.press({ key: 'view' })
  await ui.press({ key: 'ring' })
  expect(await kind()).toBe('/big  ·  context')
  expect(await ui.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 .claude' } })
  await ui.press({ key: 'ring' })
  expect(await kind()).toBe('/big  ·  branches')

  // A folder that has no Branches nor Leaves frames of its own shows its Children instead
  await ui.press({ key: 'open-1' })
  expect(await ui.find({ type: 'Text', text: /^\/big\/1-a  ·  children$/ })).toBeDefined()
  await ui.unmount()
})

test('a folder leaves out what its exclusions.yaml lists, and a broken one says so', async ($, on) => {
  const listings: Record<string, FsEntry[]> = {
    '/x': [
      ...['1-a', 'dist', '.hexframe', 'node_modules'].map(dir),
      ...['b.md', 'c.lock'].map(file),
    ],
  }
  const texts: Record<string, string> = {
    '/x/.hexframe/exclusions.yaml': 'exclude:\n  - dist/\n  - "*.lock"\n',
  }
  vault(on, '/x', listings, texts)
  await $.command.run(hexframe(''))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'open-1' })).toMatchObject({ props: { label: '1 A' } })
  expect(await ui.find({ key: 'open-2' })).toMatchObject({ props: { label: '2 B' } })
  expect(await ui.find({ key: 'open-3' })).toBeUndefined()
  // `.hexframe/` is the folder's settings, never one of its Context tiles
  await ui.press({ key: 'ring' })
  expect(await ui.find({ key: 'open-1' })).toBeUndefined()
  await ui.press({ key: 'ring' })

  // A broken file leaves nothing out, and the pane says why
  texts['/x/.hexframe/exclusions.yaml'] = 'exclude: dist\n'
  await ui.press({ key: 'reload' })
  expect(
    await ui.find({
      type: 'Text',
      text: "Can't read .hexframe/exclusions.yaml, so nothing is left out: line 1: `exclude:` takes a list, as `[a, b]` or one `- a` per line",
    }),
  ).toBeDefined()
  expect(await ui.find({ key: 'open-2' })).toMatchObject({ props: { label: '2 Dist' } })
  expect(await ui.find({ key: 'open-4' })).toMatchObject({ props: { label: '4 c.lock' } })
  await ui.unmount()
})

test('an overflowing ring shows as a list of its names, each opening as its hex would', async ($, on) => {
  const leaves = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md']
  vault(
    on,
    '/o',
    { '/o': [dir('1-a'), dir('1-b'), ...leaves.map(file)], '/o/1-b': [] },
    { '/o/g.md': '---\ntitle: G\n---\n# Gee\n' },
  )
  await $.command.run(hexframe(''))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // `1-b/` finds its number taken: the Branches are a list, not hexes
  expect(await ui.find({ type: 'Text', text: '/o  ·  branches' })).toBeDefined()
  expect(await ui.find({ key: 'frame' })).toBeUndefined()
  expect(await ui.find({ key: 'open-1' })).toBeUndefined()
  expect(await ui.find({ key: 'item-1' })).toMatchObject({ props: { label: '1-a/' } })
  expect(await ui.find({ key: 'item-2' })).toMatchObject({ props: { label: '1-b/' } })
  expect(
    await ui.find({
      type: 'Text',
      text: '2 Branches, and no direction left for 1-b. List what this folder leaves out in .hexframe/exclusions.yaml, or renumber, to draw them as hexes.',
    }),
  ).toBeDefined()

  // Seven Leaves for six directions: a list too, where a Leaf opens its file
  await ui.press({ key: 'ring' })
  expect(await ui.find({ key: 'item-7' })).toMatchObject({ props: { label: 'g.md' } })
  expect(
    await ui.find({ type: 'Text', text: /^7 Leaves, and no direction left for g\.md\./ }),
  ).toBeDefined()
  await ui.press({ key: 'item-7' })
  expect(await ui.find({ key: 'preview' })).toMatchObject({ props: { text: '# Gee' } })
  await ui.press({ key: 'view' })
  expect(await ui.find({ key: 'list' })).toBeDefined()

  // And a folder in the list walks into it
  await ui.press({ key: 'ring' })
  await ui.press({ key: 'ring' })
  await ui.press({ key: 'item-2' })
  expect(await ui.find({ type: 'Text', text: '/o/1-b  ·  children' })).toBeDefined()
  await ui.unmount()
})
