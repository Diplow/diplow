import type { FsEntry } from 'claude-code'
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
