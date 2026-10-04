import { describe, expect, it } from 'vitest'

import type { Entry, FileStat } from '../../../2-claude-mod/hooks/shape/node.ts'
import {
  centerToShow,
  inFolder,
  readFrame,
  readKinds,
  readBranchKinds,
  readOpened,
  readSettings,
  refusal,
  saveSettings,
  unopenable,
  vaultPath,
  type Disk,
} from './frame.ts'

/**
 * A vault in memory at `/vault`: each key a path relative to it, a string a file's text, `{}` a
 * folder, and `{ link }` a symlink to the real path it names.
 */
type Node = string | Record<string, never> | { link: string }

function diskOf(nodes: Record<string, Node>): Disk {
  // A path's real path: the first symlink on its way followed, the rest kept.
  const real = (path: string) => {
    const parts = vaultPath(path).split('/').filter(Boolean)
    for (let at = parts.length; at > 0; at--) {
      const node = nodes[parts.slice(0, at).join('/')]
      if (typeof node === 'object' && 'link' in node) {
        return [node.link, ...parts.slice(at)].join('/')
      }
    }
    return ['/vault', ...parts].join('/')
  }
  const nodeAt = (path: string): Node | undefined =>
    vaultPath(path) === '' ? {} : nodes[vaultPath(path)]
  return {
    list(folder) {
      const prefix = vaultPath(folder) === '' ? '' : `${vaultPath(folder)}/`
      const entries: Entry[] = Object.entries(nodes)
        .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
        .map(([path, node]) => ({
          name: path.slice(prefix.length),
          kind: typeof node === 'string' ? 'file' : 'dir',
        }))
      return Promise.resolve(entries)
    },
    stat(path) {
      const node = nodeAt(path)
      if (node === undefined) return Promise.resolve(undefined)
      const stat: FileStat = {
        kind: typeof node === 'string' ? 'file' : 'dir',
        size: typeof node === 'string' ? node.length : 0,
        realPath: real(path),
      }
      return Promise.resolve(stat)
    },
    read(realPath) {
      const path = ['', ...Object.keys(nodes)].find((key) => real(key) === realPath)
      const node = path === undefined ? undefined : nodeAt(path)
      if (typeof node !== 'string') return Promise.reject(new Error(`no file at ${realPath}`))
      return Promise.resolve(node)
    },
  }
}

const note = (title: string, preview = '') =>
  `---\ntitle: ${title}\npreview: ${preview}\n---\n# ${title}\n`

describe('readFrame', () => {
  it("reads the center's Tile and its Children ring", async () => {
    const disk = diskOf({
      'CLAUDE.md': note('diplow', 'Who I am'),
      '3-games': {},
      '3-games/CLAUDE.md': note('Games'),
      'STACK.md': note('Top-level stack'),
      '.claude': {},
      '.claude/CLAUDE.md': note('Claude config'),
    })
    const { frame, warnings } = await readFrame(disk, '')
    expect(warnings).toEqual([])
    expect(frame.tile).toEqual({ path: '', title: 'diplow', preview: 'Who I am' })
    expect(frame.rings.children).toEqual({
      overflowing: false,
      clashes: [],
      members: {
        1: { kind: 'leaf', tile: { path: 'STACK.md', title: 'Top-level stack', preview: '' } },
        3: { kind: 'branch', tile: { path: '3-games', title: 'Games', preview: '' } },
      },
    })
    expect(frame.rings.context).toEqual({
      overflowing: false,
      members: {
        1: { kind: 'context', tile: { path: '.claude', title: 'Claude config', preview: '' } },
      },
    })
  })

  it('leaves out what the folder lists in its exclusions.yaml', async () => {
    const disk = diskOf({
      '4-software': {},
      '4-software/dist': {},
      '4-software/1-app': {},
      '4-software/.hexframe': {},
      '4-software/.hexframe/exclusions.yaml': 'exclude:\n  - dist/\n',
    })
    const { frame } = await readFrame(disk, '4-software')
    expect(frame.rings.children).toMatchObject({
      members: { 1: { kind: 'branch', tile: { path: '4-software/1-app', title: 'App' } } },
    })
    expect(frame.rings.context).toEqual({ overflowing: false, members: {} })
  })

  it('warns, and leaves nothing out, when exclusions.yaml is broken', async () => {
    const disk = diskOf({
      a: {},
      'a/dist': {},
      'a/.hexframe': {},
      'a/.hexframe/exclusions.yaml': 'include: [dist/]\n',
    })
    const { frame, warnings } = await readFrame(disk, 'a')
    expect(frame.rings.children).toMatchObject({ members: { 1: { kind: 'branch' } } })
    expect(warnings).toEqual([
      "Can't read .hexframe/exclusions.yaml, so nothing is left out: line 1: the one key is `exclude:`, followed by a list",
    ])
  })

  it('names a Tile whose body a symlink leads out of its folder', async () => {
    const disk = diskOf({
      '3-games': {},
      '3-games/CLAUDE.md': { link: '/etc/passwd' },
    })
    const { frame } = await readFrame(disk, '')
    expect(frame.rings.children).toMatchObject({
      members: { 3: { tile: { path: '3-games', title: 'Games', preview: '' } } },
    })
  })

  it('names a Tile whose folder is a symlink out of the vault, reading nothing there', async () => {
    const disk = diskOf({
      '3-games': { link: '/home/someone' },
      '3-games/CLAUDE.md': note('Someone else'),
    })
    const { frame } = await readFrame(disk, '')
    expect(frame.rings.children).toMatchObject({
      members: { 3: { tile: { path: '3-games', title: 'Games', preview: '' } } },
    })
  })

  it('follows a symlink that stays in the vault', async () => {
    const disk = diskOf({
      '3-games': { link: '/vault/archive/games' },
      '3-games/CLAUDE.md': note('Games, archived'),
    })
    const { frame } = await readFrame(disk, '')
    expect(frame.rings.children).toMatchObject({
      members: { 3: { tile: { title: 'Games, archived' } } },
    })
  })

  it('keeps an overflowing ring as names, reading none of their files', async () => {
    const nodes: Record<string, Node> = {}
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) nodes[`.${name}`] = {}
    const { frame } = await readFrame(diskOf(nodes), '')
    expect(frame.rings.context).toMatchObject({ overflowing: true, overflow: [{ name: '.g' }] })
  })
})

describe('readOpened', () => {
  it('reads a folder the view may center on', async () => {
    const disk = diskOf({ '3-games': {}, '3-games/CLAUDE.md': note('Games') })
    expect(await readOpened(disk, '3-games')).toMatchObject({ frame: { tile: { title: 'Games' } } })
  })

  it('lists nothing of a folder that leaves the vault or that a folder leaves out', async () => {
    const disk = diskOf({
      '3-games': {},
      '3-games/out': { link: '/elsewhere' },
      '3-games/.hexframe': {},
      '3-games/.hexframe/exclusions.yaml': 'exclude: [dist/]\n',
      '3-games/dist': {},
    })
    expect(await readOpened(disk, '3-games/out')).toEqual({ refused: 'it leads out of the vault' })
    expect(await readOpened(disk, '3-games/dist')).toEqual({
      refused: '3-games/.hexframe/exclusions.yaml leaves out dist',
    })
  })

  it('gives the reason of a read that fails, rather than throwing', async () => {
    const disk = diskOf({ '3-games': {} })
    const failing: Disk = { ...disk, list: () => Promise.reject(new Error('EACCES')) }
    expect(await readOpened(failing, '3-games')).toEqual({ refused: 'EACCES' })
  })
})

describe('readKinds', () => {
  it('gives the kinds a folder offers, once its exclusions have left names out', async () => {
    const disk = diskOf({
      '3-games': {},
      ...Object.fromEntries(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => [`3-games/${name}.md`, '']),
      ),
      '3-games/.hexframe': {},
      '3-games/.hexframe/exclusions.yaml': 'exclude: [g.md]\n',
    })
    expect(await readKinds(disk, '3-games')).toEqual(['children', 'context'])
    const crowded = diskOf({ ...Object.fromEntries('abcdefg'.split('').map((n) => [n, {}])) })
    expect(await readKinds(crowded, '')).toEqual(['branches', 'leaves', 'context'])
  })

  it('gives nothing for a folder the view may not open, or that fails to read', async () => {
    const disk = diskOf({ '3-games': {}, out: { link: '/elsewhere' } })
    expect(await readKinds(disk, 'out')).toBeUndefined()
    const failing: Disk = { ...disk, list: () => Promise.reject(new Error('EACCES')) }
    expect(await readKinds(failing, '3-games')).toBeUndefined()
  })
})

const ring = { overflowing: false as const, members: {} }

describe('readBranchKinds', () => {
  it("gives each Branch's kinds by direction, an opened one's from its Frame", async () => {
    const crowded = Object.fromEntries('abcdefg'.split('').map((name) => [`2-b/${name}`, {}]))
    const disk = diskOf({ '1-a': {}, '2-b': {}, ...crowded, out: { link: '/elsewhere' } })
    const opened = {
      3: { tile: { path: '3-c', title: 'c', preview: '' }, rings: { leaves: ring } },
    }
    const read = await readBranchKinds(
      disk,
      [
        { direction: 1, path: '/1-a' },
        { direction: 2, path: '2-b' },
        { direction: 3, path: '3-c' },
        { direction: 4, path: 'out' },
      ],
      opened,
    )
    expect(read).toEqual({
      1: ['children', 'context'],
      2: ['branches', 'leaves', 'context'],
      3: ['leaves'],
    })
  })
})

describe('refusal', () => {
  const disk = diskOf({
    '3-games': {},
    '3-games/1-riftbound': {},
    '3-games/STACK.md': 'stack',
    '3-games/out': { link: '/elsewhere' },
    '3-games/beside': { link: '/vault-old/3-games' },
    '3-games/dist': {},
    '3-games/git': { link: '/vault/.git' },
    '3-games/.hexframe': {},
    '3-games/.hexframe/exclusions.yaml': 'exclude: [dist/]\n',
  })

  it('lets the view center on a folder of the vault', async () => {
    expect(await refusal(disk, '3-games/1-riftbound')).toBeUndefined()
    expect(await refusal(disk, '')).toBeUndefined()
  })

  it('refuses what is not a folder', async () => {
    expect(await refusal(disk, '3-games/2-chess')).toBe('it does not exist')
    expect(await refusal(disk, '3-games/STACK.md')).toBe('it is not a folder')
  })

  it('refuses a symlink out of the vault, compared folder by folder', async () => {
    expect(await refusal(disk, '3-games/out')).toBe('it leads out of the vault')
    expect(await refusal(disk, '3-games/beside')).toBe('it leads out of the vault')
  })

  it('refuses a folder its parent leaves out', async () => {
    expect(await refusal(disk, '3-games/dist')).toBe(
      '3-games/.hexframe/exclusions.yaml leaves out dist',
    )
  })

  it('refuses a folder left out by the path written, whatever its real path', async () => {
    const linked = diskOf({
      '3-games': {},
      '3-games/dist': { link: '/vault/archive' },
      archive: {},
      '3-games/.hexframe': {},
      '3-games/.hexframe/exclusions.yaml': 'exclude: [dist/]\n',
    })
    expect(await refusal(linked, '3-games/dist')).toBe(
      '3-games/.hexframe/exclusions.yaml leaves out dist',
    )
  })

  it('refuses a folder left out by its real path, whatever the path written', async () => {
    expect(await refusal(disk, '3-games/git')).toBe('every folder leaves out .git')
  })

  it('gives the failure of a folder the file system fails on', async () => {
    const failing: Disk = { ...disk, stat: () => Promise.reject(new Error('ELOOP')) }
    expect(await refusal(failing, '3-games')).toBe('ELOOP')
  })
})

describe('centerToShow', () => {
  const disk = diskOf({
    '3-games': {},
    '3-games/1-riftbound': {},
    out: { link: '/elsewhere' },
    'out/notes': {},
  })

  it('shows the center when it may be shown', async () => {
    expect(await centerToShow(disk, { folder: '3-games/1-riftbound' }, '3-games')).toEqual({
      folder: '3-games/1-riftbound',
    })
  })

  it("shows the file's own folder, noted, when the center was dropped", async () => {
    const wanted = { folder: '3-games', dropped: 'it is an absolute path' }
    expect(await centerToShow(disk, wanted, '3-games')).toEqual({
      folder: '3-games',
      note: "its center can't be shown, as it is an absolute path: the view shows its own folder",
    })
  })

  it("shows the file's own folder, noted, when the center is refused", async () => {
    expect(await centerToShow(disk, { folder: '3-games/2-chess' }, '3-games')).toEqual({
      folder: '3-games',
      note: "its center can't be shown, as it does not exist: the view shows its own folder",
    })
  })

  it("shows nothing when the file's own folder leads out of the vault", async () => {
    expect(await centerToShow(disk, { folder: 'out/notes' }, 'out/notes')).toEqual({
      refused: 'it leads out of the vault',
    })
    expect(await centerToShow(disk, { folder: '3-games' }, 'out/notes')).toEqual({
      folder: '3-games',
    })
  })
})

describe('unopenable', () => {
  const disk = diskOf({
    'STACK.md': 'stack',
    '3-games': {},
    '3-games/board.pdf': 'pdf',
    out: { link: '/elsewhere' },
    'out/CLAUDE.md': 'out',
    beside: { link: '/vault-old' },
    'beside/board.pdf': 'pdf',
  })

  it('lets the view open a file of the vault', async () => {
    expect(await unopenable(disk, 'STACK.md')).toBeUndefined()
    expect(await unopenable(disk, '3-games/board.pdf')).toBeUndefined()
  })

  it('refuses what is not a file', async () => {
    expect(await unopenable(disk, '3-games/CLAUDE.md')).toBe('it does not exist')
    expect(await unopenable(disk, '3-games')).toBe('it is not a file')
  })

  it('refuses a file whose real path leaves the vault, compared folder by folder', async () => {
    expect(await unopenable(disk, 'out/CLAUDE.md')).toBe('it leads out of the vault')
    expect(await unopenable(disk, 'beside/board.pdf')).toBe('it leads out of the vault')
    expect(await unopenable(disk, 'beside/board.pdf', 'system')).toBe('it leads out of the vault')
  })

  it('hands the system a document only, by the name written and by the real one', async () => {
    const files = diskOf({
      'board.PDF': 'pdf',
      'setup.exe': 'exe',
      'Notes.lnk': 'lnk',
      'run.command': 'sh',
      'budget.xlsx': 'xlsx',
      'letter.docx': 'docx',
      install: 'sh',
      linked: { link: '/vault/tools' },
      'linked/board.pdf': 'pdf',
      tools: {},
      'tools/board.pdf': 'pdf',
    })
    expect(await unopenable(files, 'board.PDF', 'system')).toBeUndefined()
    expect(await unopenable(files, 'linked/board.pdf', 'system')).toBeUndefined()
    expect(await unopenable(files, 'linked/board.pdf')).toBeUndefined()
    const others = [
      'setup.exe',
      'Notes.lnk',
      'run.command',
      'install',
      'budget.xlsx',
      'letter.docx',
    ]
    for (const path of others) {
      expect(await unopenable(files, path, 'system')).toBe('it is no document the system opens')
      expect(await unopenable(files, path)).toBeUndefined()
    }
  })

  it('refuses the system a document whose real name is not one', async () => {
    const renamed: Disk = {
      ...disk,
      stat: async (path) => {
        const found = await disk.stat(path)
        if (found === undefined || path === '') return found
        return { ...found, realPath: '/vault/3-games/payload.exe' }
      },
    }
    expect(await unopenable(renamed, '3-games/board.pdf', 'system')).toBe(
      'it is no document the system opens',
    )
    expect(await unopenable(renamed, '3-games/board.pdf')).toBeUndefined()
  })

  it('gives the failure of a file the file system fails on', async () => {
    const failing: Disk = { ...disk, stat: () => Promise.reject(new Error('EACCES')) }
    expect(await unopenable(failing, 'STACK.md')).toBe('EACCES')
  })
})

describe('readSettings', () => {
  it("gives a folder's listing and the text of its exclusions.yaml, or none", async () => {
    const disk = diskOf({
      a: {},
      'a/b.md': '',
      'a/.hexframe': {},
      'a/.hexframe/exclusions.yaml': 'exclude: [c]',
      d: {},
    })
    expect(await readSettings(disk, 'a')).toEqual({
      entries: [
        { name: 'b.md', kind: 'file' },
        { name: '.hexframe', kind: 'dir' },
      ],
      text: 'exclude: [c]',
    })
    expect(await readSettings(disk, 'd')).toEqual({ entries: [], text: undefined })
  })

  it('refuses a folder the view may not center on', async () => {
    const disk = diskOf({ a: { link: '/elsewhere' }, b: {}, '.hexframe': {} })
    expect(await readSettings(disk, 'a')).toEqual({ refused: 'it leads out of the vault' })
    expect(await readSettings(disk, '.hexframe')).toEqual({
      refused: 'every folder leaves out .hexframe',
    })
  })

  it('refuses a .hexframe or an exclusions.yaml reached through a symlink, even in the vault', async () => {
    const linkedFolder = diskOf({
      a: {},
      b: {},
      'b/.hexframe': {},
      'a/.hexframe': { link: '/vault/b/.hexframe' },
    })
    expect(await readSettings(linkedFolder, 'a')).toEqual({
      refused: 'its .hexframe is no folder of its own',
    })
    const linkedFile = diskOf({
      a: {},
      'a/.hexframe': {},
      'a/.hexframe/exclusions.yaml': { link: '/vault/b.yaml' },
      'b.yaml': 'exclude: [x]',
    })
    expect(await readSettings(linkedFile, 'a')).toEqual({ refused: 'it leads outside its folder' })
  })
})

describe('saveSettings', () => {
  const recorder = () => {
    const writes: [string, string][] = []
    const write = (path: string, text: string) => {
      writes.push([path, text])
      return Promise.resolve()
    }
    return { writes, write }
  }

  it("makes the change in the folder's exclusions.yaml, as read just before", async () => {
    const { writes, write } = recorder()
    const disk = diskOf({
      a: {},
      'a/.hexframe': {},
      'a/.hexframe/exclusions.yaml': 'exclude:\n  - "*.log"\n',
    })
    expect(await saveSettings(disk, write, 'a', { add: ['b/'], remove: [] })).toEqual({
      saved: 'a/.hexframe/exclusions.yaml',
    })
    expect(writes).toEqual([['a/.hexframe/exclusions.yaml', 'exclude:\n  - "*.log"\n  - b/\n']])
  })

  it("writes the vault root's file at its own path", async () => {
    const { writes, write } = recorder()
    expect(await saveSettings(diskOf({}), write, '', { add: ['x.md'], remove: [] })).toEqual({
      saved: '.hexframe/exclusions.yaml',
    })
    expect(writes).toEqual([['.hexframe/exclusions.yaml', 'exclude:\n  - x.md\n']])
  })

  it('writes nothing where it refuses, over a broken file, or for a change of nothing', async () => {
    const { writes, write } = recorder()
    const broken = diskOf({ a: {}, 'a/.hexframe': {}, 'a/.hexframe/exclusions.yaml': 'nope' })
    expect(await saveSettings(broken, write, 'a', { add: ['b'], remove: [] })).toEqual({
      refused: 'line 1: the one key is `exclude:`, followed by a list',
    })
    const linked = diskOf({ a: {}, 'a/.hexframe': { link: '/elsewhere' } })
    expect(await saveSettings(linked, write, 'a', { add: ['b'], remove: [] })).toEqual({
      refused: 'its .hexframe is no folder of its own',
    })
    expect(await saveSettings(diskOf({ a: {} }), write, 'a', { add: [], remove: [] })).toEqual({
      saved: 'a/.hexframe/exclusions.yaml',
    })
    expect(writes).toEqual([])
  })

  it('gives the reason of a write that fails', async () => {
    const write = () => Promise.reject(new Error('the disk is full'))
    expect(await saveSettings(diskOf({ a: {} }), write, 'a', { add: ['b'], remove: [] })).toEqual({
      refused: 'the disk is full',
    })
  })
})

describe('inFolder', () => {
  it('joins a name to a folder, the vault root being empty', () => {
    expect(inFolder('', 'CLAUDE.md')).toBe('CLAUDE.md')
    expect(inFolder('/', 'CLAUDE.md')).toBe('CLAUDE.md')
    expect(inFolder('3-games', 'CLAUDE.md')).toBe('3-games/CLAUDE.md')
  })
})
