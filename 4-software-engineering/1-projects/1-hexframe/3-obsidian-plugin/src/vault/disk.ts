// The Disk over Obsidian's vault. Branches and Leaves come from the vault's index; the dot folders,
// which the index leaves out, from its adapter. Real paths, and the reads made by the real path
// just checked, come from Node, which is why the plugin is desktop only.
import { readFile, realpath, stat } from 'node:fs/promises'

import { FileSystemAdapter, TFolder, type App } from 'obsidian'

import type { Entry, FileStat } from '../../../2-claude-mod/hooks/shape/node.ts'
import { vaultPath, type Disk } from './frame.ts'

/** The vault as a Disk, or undefined where Obsidian keeps it outside a file system. */
export function diskOf(app: App): Disk | undefined {
  const { adapter } = app.vault
  if (!(adapter instanceof FileSystemAdapter)) return undefined
  return {
    list: (folder) => list(app, adapter, vaultPath(folder)),
    stat: (path) => statAt(adapter.getFullPath(vaultPath(path))),
    read: (realPath) => readFile(realPath, 'utf8'),
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
