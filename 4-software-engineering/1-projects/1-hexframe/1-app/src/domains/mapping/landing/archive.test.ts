import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { ArchiveEntry, Unpacked } from '#/repositories/zip/unzip'

import type { ImportFault } from '../errors'
import { archiveBounds, folderOf, pastBounds, pathFault, wrappingFolder } from './archive'

// The verdict on an archive's entries, on entry lists made by hand: every path that isn't plain, a
// symlink, an entry too deep, two paths a case-blind disk would merge, each a fault on its path, all
// at once; where the zip repository stopped unpacking, as a fault; and a folder's files otherwise.

const file = (path: string, text = path): ArchiveEntry => ({
  path,
  kind: 'File',
  bytes: new TextEncoder().encode(text),
})

const folder = (path: string): ArchiveEntry => ({ path, kind: 'Folder', bytes: new Uint8Array() })

const unpackedOf = (...entries: ReadonlyArray<ArchiveEntry>): Unpacked => ({
  _tag: 'Unpacked',
  entries,
})

/** The faults the verdict lists for an archive, or `[]` when it reads as a folder. */
function faultsOf(unpacked: Unpacked): ReadonlyArray<ImportFault> {
  const verdict = folderOf('vault.zip', unpacked)
  return Result.isFailure(verdict) ? verdict.failure.faults : []
}

describe("an entry's path", () => {
  it('is plain when it is a relative path of plain segments, as written', () => {
    for (const path of ['CLAUDE.md', '1-a/CLAUDE.md', '.1-x/CLAUDE.md', 'Café/日本語.md']) {
      expect(pathFault(path)).toBeUndefined()
    }
  })

  it('is at fault absolute, with a drive, a backslash, a dot segment, or not as it normalizes', () => {
    expect(pathFault('/etc/x')).toBe('PathAbsolute')
    expect(pathFault('C:x')).toBe('DrivePrefix')
    expect(pathFault('c:/x')).toBe('DrivePrefix')
    expect(pathFault('a\\b')).toBe('Backslash')
    expect(pathFault('../x')).toBe('DotSegment')
    expect(pathFault('a/./b')).toBe('DotSegment')
    expect(pathFault('a/..')).toBe('DotSegment')
    expect(pathFault('a//b')).toBe('PathNotNormal')
    expect(pathFault('')).toBe('PathNotNormal')
    // "é" written as an "e" and a combining accent reads as another name once normalized.
    expect(pathFault('Cafe\u0301.md')).toBe('PathNotNormal')
  })
})

describe("an archive's entries, judged", () => {
  it('read as a folder named by the upload, `.zip` dropped, its files only, as written', () => {
    const verdict = folderOf(
      'My Vault.ZIP',
      unpackedOf(folder('1-a/'), file('CLAUDE.md'), file('1-a/CLAUDE.md')),
    )
    expect(Result.isSuccess(verdict)).toBe(true)
    if (!Result.isSuccess(verdict)) return
    const source = verdict.success
    expect(source._tag === 'Folder' && source.name).toBe('My Vault')
    expect(source._tag === 'Folder' && source.files.map(({ path }) => path)).toEqual([
      'CLAUDE.md',
      '1-a/CLAUDE.md',
    ])
  })

  it('lists every path at fault at once, each on the path as written', () => {
    const entries = ['../x', '/etc/x', 'C:x', 'a\\b', 'a/./b', 'a//b'].map((path) => file(path))
    expect(faultsOf(unpackedOf(file('CLAUDE.md'), ...entries))).toEqual([
      { path: '../x', fault: 'DotSegment' },
      { path: '/etc/x', fault: 'PathAbsolute' },
      { path: 'C:x', fault: 'DrivePrefix' },
      { path: 'a\\b', fault: 'Backslash' },
      { path: 'a/./b', fault: 'DotSegment' },
      { path: 'a//b', fault: 'PathNotNormal' },
    ])
  })

  it('refuses a symlink, whatever it points at', () => {
    const link: ArchiveEntry = { path: 'link', kind: 'Symlink', bytes: new Uint8Array() }
    expect(faultsOf(unpackedOf(file('CLAUDE.md'), link))).toEqual([
      { path: 'link', fault: 'Symlink' },
    ])
  })

  it('refuses two entries whose paths differ only by case, or are equal: the later one', () => {
    expect(faultsOf(unpackedOf(file('a.md'), file('A.md')))).toEqual([
      { path: 'A.md', fault: 'PathsClash' },
    ])
    expect(faultsOf(unpackedOf(file('a.md'), file('a.md')))).toEqual([
      { path: 'a.md', fault: 'PathsClash' },
    ])
    expect(faultsOf(unpackedOf(file('x/a.md'), file('X/b.md')))).toEqual([
      { path: 'X/b.md', fault: 'PathsClash' },
    ])
    expect(faultsOf(unpackedOf(file('a'), file('a/b.md')))).toEqual([
      { path: 'a/b.md', fault: 'PathsClash' },
    ])
  })

  it("takes a folder's own entry beside the files below it, before or after them", () => {
    expect(faultsOf(unpackedOf(folder('a/'), file('a/x.md'), file('a/y.md')))).toEqual([])
    expect(faultsOf(unpackedOf(file('a/x.md'), folder('a/')))).toEqual([])
    expect(faultsOf(unpackedOf(folder('a/'), folder('A/')))).toEqual([
      { path: 'A/', fault: 'PathsClash' },
    ])
  })

  it('refuses an entry more than 16 folders deep', () => {
    const deep = (folders: number) => `${Array.from({ length: folders }, () => 'd').join('/')}/x.md`
    expect(faultsOf(unpackedOf(file(deep(16))))).toEqual([])
    expect(faultsOf(unpackedOf(file(deep(17))))).toEqual([{ path: deep(17), fault: 'TooDeep' }])
  })

  it('refuses an archive the zip repository stopped unpacking, saying where', () => {
    expect(faultsOf({ _tag: 'TooManyEntries' })).toEqual([{ path: '', fault: 'TooManyEntries' }])
    expect(faultsOf({ _tag: 'EntryTooLarge', path: 'big.md' })).toEqual([
      { path: 'big.md', fault: 'FileTooLarge' },
    ])
    expect(faultsOf({ _tag: 'TotalTooLarge', path: '9.md' })).toEqual([
      { path: '9.md', fault: 'UnpackedTooLarge' },
    ])
    expect(faultsOf({ _tag: 'Unreadable' })).toEqual([{ path: '', fault: 'ArchiveUnreadable' }])
  })

  it('bounds an archive at 2,000 entries, the shape’s 1 MB a file, 16 MB in all', () => {
    expect(archiveBounds).toEqual({ entries: 2_000, entryBytes: 1_000_000, totalBytes: 16_000_000 })
  })
})

describe('a folder’s files against the bounds, before they are zipped', () => {
  const sized = (path: string, size: number) => ({ path, size })

  it('lets files within the bounds through', () => {
    expect(pastBounds([])).toEqual([])
    expect(pastBounds([sized('a.md', 1_000_000), sized('b.md', 10)])).toEqual([])
  })

  it('refuses more files than an archive holds, before anything else', () => {
    const many = Array.from({ length: 2_001 }, (_, index) =>
      sized(`${String(index)}.md`, 2_000_000),
    )
    expect(pastBounds(many)).toEqual([{ path: '', fault: 'TooManyEntries' }])
    expect(pastBounds(many.slice(1)).length).toBeGreaterThan(1)
  })

  it('names each file past 1 MB, and the one at which the whole passes 16 MB', () => {
    const files = [
      sized('big.md', 1_000_001),
      ...Array.from({ length: 16 }, (_, index) => sized(`${String(index)}.md`, 1_000_000)),
    ]
    expect(pastBounds(files)).toEqual([
      { path: 'big.md', fault: 'FileTooLarge' },
      { path: '14.md', fault: 'UnpackedTooLarge' },
    ])
  })
})

describe('the one folder an archive wraps its folder in', () => {
  const paths = (...all: ReadonlyArray<string>) => all.map((path) => ({ path }))

  it('is the one folder every file sits in, with no file beside it', () => {
    expect(wrappingFolder(paths('notes/CLAUDE.md', 'notes/1-a/CLAUDE.md'))).toBe('notes')
  })

  it('is none with a file beside it, two folders, a file at the root, or no file', () => {
    expect(wrappingFolder(paths('notes/CLAUDE.md', 'README.md'))).toBeUndefined()
    expect(wrappingFolder(paths('a/CLAUDE.md', 'b/CLAUDE.md'))).toBeUndefined()
    expect(wrappingFolder(paths('CLAUDE.md'))).toBeUndefined()
    expect(wrappingFolder([])).toBeUndefined()
  })
})
