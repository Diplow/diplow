import { describe, expect, it } from 'vitest'

import type { Given, GivenFile } from './upload'

import { dropped, pickedFile, pickedFolder } from './files'

// What the user hands an import, read into what the API's browser entry takes, over stand-ins for
// the browser's own objects: a picked folder's files and their relative paths, a picked file, and
// what a drop holds, a folder read below through its entries, or a file.

/** A file a folder picker lists, under its path from the picked folder's parent. */
const listed = (relativePath: string, text = relativePath) =>
  Object.defineProperty(
    new File([text], relativePath.split('/').pop() ?? ''),
    'webkitRelativePath',
    {
      value: relativePath,
    },
  )

/** The paths of a folder's files, and the text of each, read as the upload reads them. */
async function contentOf(given: Given | undefined) {
  if (given?._tag !== 'Folder') throw new Error('Not a folder')
  const texts = await Promise.all(
    given.files.map(async ({ path, blob }: GivenFile) => [path, await (await blob()).text()]),
  )
  return { name: given.name, files: Object.fromEntries(texts) as Record<string, string> }
}

/** A folder's entry as a drop hands it, its reader answering at most two entries at a time. */
function folderEntry(name: string, children: ReadonlyArray<FileSystemEntry>): FileSystemEntry {
  return {
    name,
    isDirectory: true,
    isFile: false,
    createReader: () => {
      let at = 0
      return {
        readEntries: (resolve: (entries: Array<FileSystemEntry>) => void) => {
          const some = children.slice(at, at + 2)
          at += some.length
          resolve([...some])
        },
      }
    },
  } as unknown as FileSystemEntry
}

function fileEntry(name: string, text: string): FileSystemEntry {
  return {
    name,
    isDirectory: false,
    isFile: true,
    file: (resolve: (file: File) => void) => {
      resolve(new File([text], name))
    },
  } as unknown as FileSystemEntry
}

/** A drop holding one item: an entry, a file, or both, as the browser hands them. */
const drop = (entry: FileSystemEntry | null, file: File | null, kind = 'file') =>
  ({
    items: [{ kind, webkitGetAsEntry: () => entry, getAsFile: () => file }],
  }) as unknown as DataTransfer

describe('a picked folder', () => {
  it('is named by its first segment, each file by the rest of its path', async () => {
    const given = pickedFolder([listed('vault/CLAUDE.md'), listed('vault/1-a/notes.md', 'A')])
    expect(await contentOf(given)).toEqual({
      name: 'vault',
      files: { 'CLAUDE.md': 'vault/CLAUDE.md', '1-a/notes.md': 'A' },
    })
  })

  it('is nothing when it holds no file', () => {
    expect(pickedFolder([])).toBeUndefined()
  })
})

describe('a picked file', () => {
  it('is a zip’s folder by its name, any other file alone', () => {
    const zip = new File(['PK'], 'Vault.ZIP')
    const note = new File(['# Note'], 'note.md')
    expect(pickedFile(zip, { fileOnly: false })).toEqual({ _tag: 'Zip', file: zip })
    expect(pickedFile(note, { fileOnly: false })).toEqual({ _tag: 'File', file: note })
  })

  it('is one file alone where a slot takes nothing else, a zip included', () => {
    const zip = new File(['PK'], 'vault.zip')
    expect(pickedFile(zip, { fileOnly: true })).toEqual({ _tag: 'File', file: zip })
  })
})

describe('a drop', () => {
  it('reads a folder below, every entry its reader answers, each file by its path', async () => {
    const folder = folderEntry('vault', [
      fileEntry('CLAUDE.md', '# Vault'),
      folderEntry('1-a', [fileEntry('CLAUDE.md', 'A'), folderEntry('empty', [])]),
      fileEntry('notes.md', 'N'),
    ])
    expect(await contentOf(await dropped(drop(folder, null), { fileOnly: false }))).toEqual({
      name: 'vault',
      files: { 'CLAUDE.md': '# Vault', '1-a/CLAUDE.md': 'A', 'notes.md': 'N' },
    })
  })

  it('takes a file as a picked one', async () => {
    const zip = new File(['PK'], 'vault.zip')
    expect(await dropped(drop(fileEntry('vault.zip', 'PK'), zip), { fileOnly: false })).toEqual({
      _tag: 'Zip',
      file: zip,
    })
    expect(await dropped(drop(null, zip), { fileOnly: true })).toEqual({ _tag: 'File', file: zip })
  })

  it('is nothing for a folder where the slot takes one file alone', () => {
    const folder = folderEntry('vault', [fileEntry('CLAUDE.md', '# Vault')])
    expect(dropped(drop(folder, null), { fileOnly: true })).toBeUndefined()
  })

  it('is nothing when it holds no file', () => {
    expect(dropped(drop(null, null, 'string'), { fileOnly: false })).toBeUndefined()
    expect(dropped({ items: [] } as unknown as DataTransfer, { fileOnly: false })).toBeUndefined()
  })
})
