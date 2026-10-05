// What the user hands an import in the browser, read into what the browser's side of an import takes
// (`./upload.ts`): a folder picked through `<input webkitdirectory>`, a zip or a file
// picked, a folder or a file dropped. Only the listing is read here; a file's bytes are read when the
// upload asks for them, once what the server would leave out is gone.
import type { Given, GivenFile } from './upload'

/** What a slot takes: anything, or, a Leaf slot, one file alone, sent as it is, a zip included. */
export interface Takes {
  readonly fileOnly: boolean
}

/**
 * A folder picked through `<input webkitdirectory>`: the folder's name is the first segment of each
 * file's relative path, and each file's path the rest of it. Nothing when the folder holds no file.
 */
export function pickedFolder(files: ReadonlyArray<File>): Given | undefined {
  const [first] = files
  if (first === undefined) return undefined
  const [name = ''] = first.webkitRelativePath.split('/')
  return {
    _tag: 'Folder',
    name,
    files: files.map((file) => ({
      path: file.webkitRelativePath.split('/').slice(1).join('/'),
      kind: 'File',
      blob: () => Promise.resolve(file),
    })),
  }
}

/** A file picked or dropped: a zip holds a folder, unless the slot takes one file alone. */
export function pickedFile(file: File, { fileOnly }: Takes): Given {
  return !fileOnly && /\.zip$/i.test(file.name) ? { _tag: 'Zip', file } : { _tag: 'File', file }
}

/** Every entry of a dropped folder: a reader answers some at a time, then none once it is done. */
async function entriesOf(folder: FileSystemDirectoryEntry): Promise<Array<FileSystemEntry>> {
  const reader = folder.createReader()
  const entries: Array<FileSystemEntry> = []
  for (;;) {
    const some = await new Promise<Array<FileSystemEntry>>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (some.length === 0) return entries
    entries.push(...some)
  }
}

const isFolder = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => entry.isDirectory
const isFile = (entry: FileSystemEntry): entry is FileSystemFileEntry => entry.isFile

const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })

/** The files below a dropped folder, each by its path from it, read only when asked. */
async function filesIn(folder: FileSystemDirectoryEntry, path = ''): Promise<Array<GivenFile>> {
  const files: Array<GivenFile> = []
  for (const entry of await entriesOf(folder)) {
    const at = path === '' ? entry.name : `${path}/${entry.name}`
    if (isFolder(entry)) files.push(...(await filesIn(entry, at)))
    else if (isFile(entry)) files.push({ path: at, kind: 'File', blob: () => fileOf(entry) })
  }
  return files
}

/**
 * What a drop holds, taken while its event lasts, since its items go with it: its first file, a
 * folder read below as the browser lists it, or a file as a picked one; nothing when it holds none,
 * nor for a folder where the slot takes one file alone, as its pickers offer none.
 */
export function dropped(transfer: DataTransfer, takes: Takes): Promise<Given> | undefined {
  const item = [...transfer.items].find(({ kind }) => kind === 'file')
  const entry = item?.webkitGetAsEntry()
  if (entry && isFolder(entry)) {
    if (takes.fileOnly) return undefined
    return filesIn(entry).then((files) => ({ _tag: 'Folder', name: entry.name, files }))
  }
  const file = item?.getAsFile()
  return file ? Promise.resolve(pickedFile(file, takes)) : undefined
}
