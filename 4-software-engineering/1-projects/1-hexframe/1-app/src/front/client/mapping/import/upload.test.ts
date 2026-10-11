import { Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { archived, unpacked } from '#/api/mapping/files/upload'
import { ImportUpload } from '#/api/mapping/mapping'
import * as Mapping from '#/api/mapping/programs'
import { noKey, run, type StartContext } from '#/api/server/run'
import { systemOf } from '#/domains/mapping/entities'

import { type Given, type GivenFile, type Prepared, prepared } from './upload'

// What the browser makes of what the user gave, before a byte is sent: a folder or a zip pruned of
// what Mapping's reading leaves out, checked against the bounds the server unpacks within and its
// verdict on every path, and zipped; one file sent as it is; or refused, every fault at once. Then an
// upload it made, landed by the server function's program over PGlite.

/** A file of a folder, by its path, holding this text or these bytes, read only when asked. */
const given = (path: string, content: string | Uint8Array = ''): GivenFile => ({
  path,
  kind: 'File',
  blob: () => Promise.resolve(new Blob([typeof content === 'string' ? content : content.slice()])),
})

const folder = (files: ReadonlyArray<GivenFile>, name = 'vault'): Given => ({
  _tag: 'Folder',
  name,
  files,
})

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

/** An archive holding these files, by their paths, in this order, text in UTF-8. */
const archiveOf = (files: Readonly<Record<string, string | Uint8Array>>) =>
  archived(
    Object.entries(files).map(([path, content]) => ({
      path,
      bytes: typeof content === 'string' ? new TextEncoder().encode(content) : content,
    })),
  )

/** The paths of the files an archive the browser made holds, read back as the server would. */
function pathsIn(archive: Uint8Array) {
  const opened = unpacked(archive, {
    entries: 10_000,
    entryBytes: 16_000_000,
    totalBytes: 64_000_000,
  })
  if (opened._tag !== 'Unpacked') throw new Error(opened._tag)
  return opened.entries.flatMap(({ path, kind }) => (kind === 'Folder' ? [] : [path]))
}

/** What is ready to send, which must be ready, with its archive's files read back by path. */
async function readyOf(what: Given) {
  const ready = await prepared(what)
  if (ready._tag !== 'Ready') throw new Error(JSON.stringify(ready.faults))
  const bytes = new Uint8Array(await ready.upload.arrayBuffer())
  const files = ready.as === 'Zip' ? pathsIn(bytes) : []
  return { ...ready, files }
}

/** Why what the user gave is refused, which it must be. */
async function refusedOf(what: Given): Promise<Extract<Prepared, { _tag: 'Refused' }>> {
  const ready = await prepared(what)
  if (ready._tag !== 'Refused') throw new Error('Nothing was refused')
  return ready
}

/** Random text, `length` letters of 64, which deflate can't shrink below three quarters. */
function noisy(length: number) {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/'
  // getRandomValues fills 64 KB at most at a time.
  const bytes = new Uint8Array(length)
  for (let at = 0; at < length; at += 65_536)
    crypto.getRandomValues(bytes.subarray(at, at + 65_536))
  return Array.from(bytes, (byte) => letters[byte % 64]).join('')
}

describe('a folder the user gave', () => {
  it('is zipped without what a reading leaves out, named by the folder, listing what was left out', async () => {
    const ready = await readyOf(
      folder([
        given('CLAUDE.md', '---\ntitle: Vault\n---\n'),
        given('1-a/CLAUDE.md'),
        given('1-a/photo.png', png),
        given('.1-why/CLAUDE.md'),
        given('.DS_Store', png),
        given('.git/HEAD', 'ref'),
        given('node_modules/x/index.js', 'x'),
        given('.hexframe/config.yaml', 'fileName: SKILL.md\n'),
      ]),
    )
    expect(ready).toMatchObject({ as: 'Zip', upload: { name: 'vault.zip' } })
    expect([...ready.files].sort()).toEqual(
      ['.1-why/CLAUDE.md', '.hexframe/config.yaml', '1-a/CLAUDE.md', 'CLAUDE.md'].sort(),
    )
    expect([...ready.leftOut].sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: '.DS_Store', reason: 'DotFile' },
      { path: '.git', reason: 'Excluded' },
      { path: '1-a/photo.png', reason: 'Binary' },
      { path: 'node_modules', reason: 'Excluded' },
    ])
  })

  it('leaves out what its exclusions name, and sends them for the server to read again', async () => {
    const ready = await readyOf(
      folder([
        given('CLAUDE.md'),
        given('.hexframe/exclusions.yaml', 'exclude: [dist/, "*.log"]'),
        given('dist/CLAUDE.md'),
        given('run.log', 'log'),
      ]),
    )
    expect([...ready.files].sort()).toEqual(['.hexframe/exclusions.yaml', 'CLAUDE.md'])
    expect(ready.leftOut).toEqual(
      expect.arrayContaining([
        { path: 'dist', reason: 'Excluded' },
        { path: 'run.log', reason: 'Excluded' },
      ]),
    )
  })

  it('tells a binary past 1 MB by its head, and refuses a text past it, reading only its head', async () => {
    const huge = new Uint8Array(1_000_001).fill(0x61)
    const read: Array<string> = []
    const watched = (path: string, bytes: Uint8Array): GivenFile => ({
      path,
      kind: 'File',
      blob: () => {
        const blob = new Blob([bytes.slice()])
        return Promise.resolve(
          Object.assign(blob, {
            arrayBuffer: () => {
              read.push(path)
              return Blob.prototype.arrayBuffer.call(blob)
            },
          }),
        )
      },
    })
    const video = new Uint8Array(1_000_001)
    const ready = await readyOf(folder([given('CLAUDE.md'), watched('film.mp4', video)]))
    expect(ready.leftOut).toEqual([{ path: 'film.mp4', reason: 'Binary' }])
    expect(read).toEqual([])
    const refused = await refusedOf(folder([given('CLAUDE.md'), watched('long.md', huge)]))
    expect(refused.faults).toEqual([{ path: 'long.md', fault: 'FileTooLarge' }])
  })

  it('is refused past the bounds the server unpacks within, before it is zipped', async () => {
    let reads = 0
    const many = Array.from({ length: 2_100 }, (_, index): GivenFile => ({
      ...given(`${String(index)}.md`),
      blob: () => {
        reads += 1
        return Promise.resolve(new Blob(['x']))
      },
    }))
    expect((await refusedOf(folder(many))).faults).toEqual([{ path: '', fault: 'TooManyEntries' }])
    // Reading stops once the files pass what the server takes.
    expect(reads).toBe(2_001)
  })

  it('is refused on any path the server would refuse, every one at once', async () => {
    const refused = await refusedOf(
      folder([given('CLAUDE.md'), given('a\\b.md'), given('x.md'), given('X.md')]),
    )
    expect(refused.faults).toEqual([
      { path: 'a\\b.md', fault: 'Backslash' },
      { path: 'X.md', fault: 'PathsClash' },
    ])
  })

  it('is refused when its zip passes 4 MB, though every file fits', async () => {
    const files = Array.from({ length: 7 }, (_, index) =>
      given(`${String(index)}.md`, noisy(900_000)),
    )
    expect((await refusedOf(folder(files))).faults).toEqual([{ path: '', fault: 'UploadTooLarge' }])
  })
})

describe('a zip the user gave', () => {
  const zip = (
    files: Readonly<Record<string, string | Uint8Array>>,
    name = 'vault.zip',
  ): Given => ({
    _tag: 'Zip',
    file: new File([archiveOf(files).slice()], name),
  })

  it('is unpacked, pruned and zipped again, named by its folder', async () => {
    const modules = Object.fromEntries(
      Array.from({ length: 2_500 }, (_, index) => [`node_modules/m/${String(index)}.js`, 'x']),
    )
    const ready = await readyOf(
      zip({ 'CLAUDE.md': '', '1-a/CLAUDE.md': '', 'cover.png': png, ...modules }, 'Vault.ZIP'),
    )
    expect(ready).toMatchObject({ as: 'Zip', upload: { name: 'Vault.zip' } })
    expect([...ready.files].sort()).toEqual(['1-a/CLAUDE.md', 'CLAUDE.md'])
    expect(ready.leftOut).toEqual(
      expect.arrayContaining([
        { path: 'node_modules', reason: 'Excluded' },
        { path: 'cover.png', reason: 'Binary' },
      ]),
    )
  })

  it('is its one folder when it wraps it in one more, as macOS’s Compress does', async () => {
    const ready = await readyOf(
      zip(
        {
          'notes/CLAUDE.md': '---\ntitle: Notes\n---\n',
          'notes/1-a/CLAUDE.md': '',
          'notes/.git/HEAD': 'ref',
          '__MACOSX/notes/._CLAUDE.md': png,
        },
        'Archive.zip',
      ),
    )
    expect(ready).toMatchObject({ upload: { name: 'notes.zip' } })
    expect([...ready.files].sort()).toEqual(['1-a/CLAUDE.md', 'CLAUDE.md'])
    // What was left out reads from the folder sent, as the server's answer does.
    expect(ready.leftOut).toEqual(expect.arrayContaining([{ path: '.git', reason: 'Excluded' }]))
    const beside = await readyOf(zip({ 'notes/CLAUDE.md': '', 'README.md': '' }))
    expect(beside).toMatchObject({ upload: { name: 'vault.zip' } })
  })

  it('is refused when it can’t be read, or where the server would refuse its paths', async () => {
    const garbage: Given = { _tag: 'Zip', file: new File(['not a zip'], 'vault.zip') }
    expect((await refusedOf(garbage)).faults).toEqual([{ path: '', fault: 'ArchiveUnreadable' }])
    expect((await refusedOf(zip({ 'CLAUDE.md': '', '../up.md': 'up' }))).faults).toEqual([
      { path: '../up.md', fault: 'DotSegment' },
    ])
  })
})

describe('one file the user gave', () => {
  it('is sent as it is', async () => {
    const file = new File(['# Notes'], 'notes.md')
    expect(await prepared({ _tag: 'File', file })).toEqual({
      _tag: 'Ready',
      upload: file,
      as: 'File',
      leftOut: [],
    })
  })

  it('is refused past 4 MB, and past the shape’s 1 MB', async () => {
    const big = new File([new Uint8Array(4_000_001)], 'big.md')
    expect((await refusedOf({ _tag: 'File', file: big })).faults).toEqual([
      { path: '', fault: 'UploadTooLarge' },
    ])
    const large = new File([new Uint8Array(1_000_001)], 'large.md')
    expect((await refusedOf({ _tag: 'File', file: large })).faults).toEqual([
      { path: 'large.md', fault: 'FileTooLarge' },
    ])
  })
})

describe('an upload the browser made', () => {
  it('lands through the server function’s program as the folder it was given', async () => {
    const context: StartContext = {
      requestId: 'req-upload',
      scope: 'importTiles',
      waitUntil: () => undefined,
      exchange: {
        url: 'https://hexframe.test/',
        headers: new Headers(),
        setCookies: () => undefined,
      },
      session: Exit.succeed(
        Option.some({
          account: { id: crypto.randomUUID(), email: 'someone@example.com' },
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      key: noKey,
    }
    const ready = await prepared(
      folder([
        given('CLAUDE.md', '---\ntitle: Vault\n---\n'),
        given('1-a/CLAUDE.md'),
        given('.x', 'x'),
      ]),
    )
    if (ready._tag !== 'Ready') throw new Error('Refused')
    const form = Schema.encodeSync(ImportUpload)({
      upload: ready.upload,
      as: ready.as,
      place: { _tag: 'Root' },
    })
    const landed = await run(
      context,
      Mapping.importTiles(Schema.decodeUnknownSync(ImportUpload)(form)),
    )
    expect(landed).toMatchObject({ ok: true, value: { skipped: [] } })
    const system = await run(context, Mapping.system)
    if (!system.ok) throw new Error('The System was not read')
    expect(systemOf(system.value)).toMatchObject({
      title: 'Vault',
      branches: { 1: { title: 'A' } },
    })
  })
})
