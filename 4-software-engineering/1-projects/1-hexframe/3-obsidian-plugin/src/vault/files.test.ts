import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readLimit } from '../../../2-claude-mod/hooks/shape/node.ts'
import { readChecked, replaceFile, statAt } from './files.ts'

/** While set, every file handle's write fails, as on a full disk. */
const failing = vi.hoisted(() => ({ write: false }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...fs,
    open: async (...args: Parameters<typeof fs.open>) => {
      const handle = await fs.open(...args)
      if (!failing.write) return handle
      const writeFile = () => Promise.reject(new Error('ENOSPC: no space left on device'))
      return Object.assign(handle, { writeFile })
    },
  }
})

/** A real folder, its path with every symlink followed, as `statAt` gives real paths. */
let root: string

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'hexframe-files-')))
})

afterEach(async () => {
  failing.write = false
  await rm(root, { recursive: true, force: true })
})

describe('statAt', () => {
  it('gives a file and a folder, their real paths with every symlink followed', async () => {
    await writeFile(join(root, 'a.md'), 'abc')
    await symlink(join(root, 'a.md'), join(root, 'b.md'))
    expect(await statAt(join(root, 'a.md'))).toEqual({
      kind: 'file',
      size: 3,
      realPath: `${root}/a.md`,
    })
    expect(await statAt(join(root, 'b.md'))).toMatchObject({ realPath: `${root}/a.md` })
    expect(await statAt(root)).toMatchObject({ kind: 'dir', realPath: root })
  })

  it('tells nothing there from a symlink that leads nowhere', async () => {
    await symlink(join(root, 'gone.yaml'), join(root, 'dangling.yaml'))
    expect(await statAt(join(root, 'missing.yaml'))).toBeUndefined()
    expect(await statAt(join(root, 'dangling.yaml'))).toEqual({ kind: 'other', size: 0 })
  })
})

describe('readChecked', () => {
  it('reads a regular file', async () => {
    await writeFile(join(root, 'a.md'), 'abc')
    expect(await readChecked(join(root, 'a.md'))).toBe('abc')
  })

  it('refuses a symlink, a folder and a file past the read limit', async () => {
    await writeFile(join(root, 'a.md'), 'abc')
    await symlink(join(root, 'a.md'), join(root, 'b.md'))
    await writeFile(join(root, 'large.md'), 'x'.repeat(readLimit + 1))
    await expect(readChecked(join(root, 'b.md'))).rejects.toThrow()
    await expect(readChecked(root)).rejects.toThrow('it is not a file')
    await expect(readChecked(join(root, 'large.md'))).rejects.toThrow('it is too large')
  })
})

describe('replaceFile', () => {
  const target = () => join(root, '.hexframe', 'exclusions.yaml')

  it('makes the folder when missing and writes the file, leaving nothing beside it', async () => {
    await replaceFile(target(), 'exclude:\n  - a\n')
    expect(await readFile(target(), 'utf8')).toBe('exclude:\n  - a\n')
    expect(await readdir(join(root, '.hexframe'))).toEqual(['exclusions.yaml'])
  })

  it('replaces the content of the file there', async () => {
    await mkdir(join(root, '.hexframe'))
    await writeFile(target(), 'exclude:\n  - a\n  - b\n  - c\n')
    await replaceFile(target(), 'exclude:\n  - a\n')
    expect(await readFile(target(), 'utf8')).toBe('exclude:\n  - a\n')
    expect(await readdir(join(root, '.hexframe'))).toEqual(['exclusions.yaml'])
  })

  it('replaces a symlink at the file, leaving the file it led to as it was', async () => {
    await mkdir(join(root, '.hexframe'))
    await writeFile(join(root, 'outside.txt'), 'untouched')
    await symlink(join(root, 'outside.txt'), target())
    await replaceFile(target(), 'exclude:\n  - a\n')
    expect(await readFile(join(root, 'outside.txt'), 'utf8')).toBe('untouched')
    expect((await lstat(target())).isFile()).toBe(true)
    expect(await readFile(target(), 'utf8')).toBe('exclude:\n  - a\n')
  })

  it('replaces a symlink that leads nowhere, making nothing where it led', async () => {
    await mkdir(join(root, '.hexframe'))
    await symlink(join(root, 'nowhere.txt'), target())
    await replaceFile(target(), 'exclude:\n  - a\n')
    expect((await lstat(target())).isFile()).toBe(true)
    expect(await readdir(root)).toEqual(['.hexframe'])
  })

  it('refuses a folder at the file, leaving it and nothing beside it', async () => {
    await mkdir(target(), { recursive: true })
    await expect(replaceFile(target(), 'exclude:\n  - a\n')).rejects.toThrow()
    expect((await lstat(target())).isDirectory()).toBe(true)
    expect(await readdir(join(root, '.hexframe'))).toEqual(['exclusions.yaml'])
  })

  it('keeps the file as it was when the write fails, leaving nothing beside it', async () => {
    await mkdir(join(root, '.hexframe'))
    await writeFile(target(), 'exclude:\n  - a\n')
    failing.write = true
    await expect(replaceFile(target(), 'exclude:\n  - b\n')).rejects.toThrow('ENOSPC')
    expect(await readFile(target(), 'utf8')).toBe('exclude:\n  - a\n')
    expect(await readdir(join(root, '.hexframe'))).toEqual(['exclusions.yaml'])
  })
})
