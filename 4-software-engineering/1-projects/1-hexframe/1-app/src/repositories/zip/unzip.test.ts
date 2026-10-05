import { strFromU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { archiveOf } from './testing'
import { type UnpackBounds, unpacked } from './unzip'

// An archive a user sends, unpacked as an import reads it: crafted here with fflate, some of them lying
// in their headers, and read back entry by entry, paths as written, bytes counted as they inflate.

const roomy: UnpackBounds = { entries: 100, entryBytes: 1_000_000, totalBytes: 16_000_000 }

const text = (bytes: Uint8Array) => strFromU8(bytes)

/** Every entry of an archive unpacked within roomy bounds: its path, kind and text. */
function entriesOf(archive: Uint8Array, bounds = roomy) {
  const result = unpacked(archive, bounds)
  if (result._tag !== 'Unpacked') throw new Error(`Expected entries, got ${result._tag}`)
  return result.entries.map(({ path, kind, bytes }) => ({ path, kind, text: text(bytes) }))
}

/** Where a header's uncompressed size sits, by its signature: the local header's, the directory's. */
const uncompressedAt = new Map([
  [0x04034b50, 22],
  [0x02014b50, 24],
])

/**
 * An archive whose every header says its files inflate to `size` bytes. Only that size lies: the
 * compressed one says where an entry's data ends.
 */
function lyingAbout(archive: Uint8Array, size: number): Uint8Array {
  const lying = archive.slice()
  const view = new DataView(lying.buffer)
  for (let at = 0; at + 4 <= lying.length; at++) {
    const field = uncompressedAt.get(view.getUint32(at, true))
    if (field !== undefined) view.setUint32(at + field, size, true)
  }
  return lying
}

describe('an archive unpacked', () => {
  it('reads every entry, in its order, paths as written, folders and files apart', () => {
    const archive = zipSync({
      'CLAUDE.md': new TextEncoder().encode('---\ntitle: Root\n---\n\nBody'),
      '1-a': {},
      'Café/日本語.md': new TextEncoder().encode('À la carte'),
    })
    expect(entriesOf(archive)).toEqual([
      { path: 'CLAUDE.md', kind: 'File', text: '---\ntitle: Root\n---\n\nBody' },
      { path: '1-a/', kind: 'Folder', text: '' },
      { path: 'Café/日本語.md', kind: 'File', text: 'À la carte' },
    ])
  })

  it('normalizes no path: each comes back as the archive wrote it', () => {
    const paths = ['../x', '/etc/x', 'C:x', 'a\\b', 'a/./b', 'A.md', 'a.md', 'a//b']
    const archive = archiveOf(Object.fromEntries(paths.map((path) => [path, path])))
    expect(entriesOf(archive).map(({ path, text }) => [path, text])).toEqual(
      paths.map((path) => [path, path]),
    )
  })

  it('says a symlink is one, and inflates nothing of it', () => {
    const symlink = { os: 3, attrs: 0o120777 << 16 }
    const archive = zipSync({
      link: [new TextEncoder().encode('/etc/passwd'), symlink],
      'note.md': new TextEncoder().encode('Note'),
    })
    expect(entriesOf(archive)).toEqual([
      { path: 'link', kind: 'Symlink', text: '' },
      { path: 'note.md', kind: 'File', text: 'Note' },
    ])
  })

  it('stops before inflating anything past its number of entries', () => {
    const archive = archiveOf({ a: 'a', b: 'b', c: 'c' })
    expect(unpacked(archive, { ...roomy, entries: 2 })).toEqual({ _tag: 'TooManyEntries' })
    expect(entriesOf(archive, { ...roomy, entries: 3 })).toHaveLength(3)
  })

  it('counts the bytes an entry inflates to, not what its headers say, and stops past its bound', () => {
    const archive = lyingAbout(archiveOf({ 'small.md': 'ok', 'bomb.md': 'a'.repeat(2_000_000) }), 10)
    expect(unpacked(archive, roomy)).toEqual({ _tag: 'EntryTooLarge', path: 'bomb.md' })
    expect(entriesOf(archive, { ...roomy, entryBytes: 2_000_000 })[1]?.text).toHaveLength(2_000_000)
  })

  it('counts the bytes of every entry together, and stops at the one that passes the total', () => {
    const files = Object.fromEntries(
      ['1.md', '2.md', '3.md'].map((path) => [path, 'b'.repeat(600_000)]),
    )
    const archive = lyingAbout(archiveOf(files), 1)
    const bounds = { ...roomy, totalBytes: 1_000_000 }
    expect(unpacked(archive, bounds)).toEqual({ _tag: 'TotalTooLarge', path: '2.md' })
  })

  it('answers Unreadable for bytes that are no archive, or whose data does not inflate', () => {
    expect(unpacked(new TextEncoder().encode('no zip at all'), roomy)).toEqual({
      _tag: 'Unreadable',
    })
    expect(unpacked(new Uint8Array(), roomy)).toEqual({ _tag: 'Unreadable' })
    const archive = archiveOf({ 'a.md': 'a'.repeat(10_000) })
    const corrupt = archive.slice()
    // The deflated data starts after the local header (30 bytes) and its name (4).
    corrupt.fill(0xff, 34, 44)
    expect(unpacked(corrupt, roomy)).toEqual({ _tag: 'Unreadable' })
  })

  it('reads an empty archive as no entry', () => {
    expect(entriesOf(archiveOf({}))).toEqual([])
  })
})
