import { describe, expect, it } from 'vitest'

import type { Entry, FileStat } from '../../../2-claude-mod/hooks/shape/node.ts'
import { centerToShow, inFolder, readFrame, refusal, vaultPath, type Disk } from './frame.ts'

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

describe('inFolder', () => {
  it('joins a name to a folder, the vault root being empty', () => {
    expect(inFolder('', 'CLAUDE.md')).toBe('CLAUDE.md')
    expect(inFolder('/', 'CLAUDE.md')).toBe('CLAUDE.md')
    expect(inFolder('3-games', 'CLAUDE.md')).toBe('3-games/CLAUDE.md')
  })
})
