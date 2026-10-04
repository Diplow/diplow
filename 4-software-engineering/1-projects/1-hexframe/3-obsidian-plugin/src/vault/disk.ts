// The Disk over Obsidian's vault. Branches and Leaves come from the vault's index; the dot folders,
// which the index leaves out, from its adapter. Real paths, and the reads made by the real path
// just checked, come from Node, which is why the plugin is desktop only. The one write, a folder's
// exclusions, goes through the adapter, once `readSettings` has checked where it lands.
import { constants } from 'node:fs'
import { open, realpath, stat } from 'node:fs/promises'

import { FileSystemAdapter, TFolder, type App } from 'obsidian'

import { readLimit, type Entry, type FileStat } from '../../../2-claude-mod/hooks/shape/node.ts'
import { vaultPath, type Disk, type Write } from './frame.ts'

/** The vault as a Disk, or undefined where Obsidian keeps it outside a file system. */
export function diskOf(app: App): Disk | undefined {
  const { adapter } = app.vault
  if (!(adapter instanceof FileSystemAdapter)) return undefined
  return {
    list: (folder) => list(app, adapter, vaultPath(folder)),
    stat: (path) => statAt(adapter.getFullPath(vaultPath(path))),
    read: readChecked,
  }
}

/**
 * Writes through Obsidian's adapter, making the folder holding the file when missing, as a
 * `.hexframe/` is the first time a folder leaves something out.
 */
export function writerOf(app: App): Write {
  const { adapter } = app.vault
  return async (path, text) => {
    const folder = path.slice(0, Math.max(path.lastIndexOf('/'), 0))
    if (folder !== '' && !(await adapter.exists(folder))) await adapter.mkdir(folder)
    await adapter.write(path, text)
  }
}

async function list(app: App, adapter: FileSystemAdapter, folder: string): Promise<Entry[]> {
  const listed = await adapter.list(folder)
  const indexed = folder === '' ? app.vault.getRoot() : app.vault.getFolderByPath(folder)
  const dir = (name: string): Entry => ({ name, kind: 'dir' })
  // A folder inside a dot folder is not in the index: the adapter lists all of it.
  if (indexed === null) {
    return [
      ...listed.folders.map(nameOf).map(dir),
      ...listed.files.map((path): Entry => ({ name: nameOf(path), kind: 'file' })),
    ]
  }
  const entries = indexed.children.map((child): Entry => ({
    name: child.name,
    kind: child instanceof TFolder ? 'dir' : 'file',
  }))
  // A plugin such as Hidden folders access makes the index hold some dot folders already.
  const known = new Set(entries.map(({ name }) => name))
  const context = listed.folders
    .map(nameOf)
    .filter((name) => name.startsWith('.') && !known.has(name))
  return [...entries, ...context.map(dir)]
}

/** Node's flags as this platform has them: Windows has no `O_NOFOLLOW` nor `O_NONBLOCK`. */
const platform: Partial<typeof constants> = constants

/**
 * The text of the file at `realPath`, opened once and held to the shape's rules on that one handle:
 * a regular file of at most the read limit, and never more read than that. The open follows no
 * symlink and doesn't wait on a pipe, so a file swapped in since its check is refused, not read.
 */
async function readChecked(realPath: string): Promise<string> {
  const flags = constants.O_RDONLY | (platform.O_NOFOLLOW ?? 0) | (platform.O_NONBLOCK ?? 0)
  const handle = await open(realPath, flags)
  try {
    const found = await handle.stat()
    if (!found.isFile()) throw new Error('it is not a file')
    if (found.size > readLimit) throw new Error('it is too large')
    const buffer = Buffer.alloc(found.size)
    const { bytesRead } = await handle.read(buffer, 0, found.size, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * What is at `fullPath` on disk, every symlink followed, or undefined when nothing is there. Its
 * real path is written with `/`, Windows' included, as the shape compares paths.
 */
async function statAt(fullPath: string): Promise<FileStat | undefined> {
  try {
    const [found, realPath] = await Promise.all([stat(fullPath), realpath(fullPath)])
    const kind = found.isFile() ? 'file' : found.isDirectory() ? 'dir' : 'other'
    return { kind, size: found.size, realPath: realPath.replaceAll('\\', '/') }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
}
