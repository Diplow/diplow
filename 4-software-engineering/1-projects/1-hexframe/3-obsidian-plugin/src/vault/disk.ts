// The Disk over Obsidian's vault. Branches and Leaves come from the vault's index; the dot folders,
// which the index leaves out, and every read come from its adapter. The real paths a medium checks
// a read against come from Node, which is why the plugin is desktop only.
import { realpath, stat } from 'node:fs/promises'

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
    read: (path) => adapter.read(vaultPath(path)),
  }
}

async function list(app: App, adapter: FileSystemAdapter, folder: string): Promise<Entry[]> {
  const listed = await adapter.list(folder)
  const indexed = folder === '' ? app.vault.getRoot() : app.vault.getFolderByPath(folder)
  const dir = (path: string): Entry => ({ name: nameOf(path), kind: 'dir' })
  // A folder inside a dot folder is not in the index: the adapter lists all of it.
  if (indexed === null) {
    return [
      ...listed.folders.map(dir),
      ...listed.files.map((path): Entry => ({ name: nameOf(path), kind: 'file' })),
    ]
  }
  return [
    ...indexed.children.map((child): Entry => ({
      name: child.name,
      kind: child instanceof TFolder ? 'dir' : 'file',
    })),
    ...listed.folders.filter((path) => nameOf(path).startsWith('.')).map(dir),
  ]
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** What is at `fullPath` on disk, every symlink followed, or undefined when nothing is there. */
async function statAt(fullPath: string): Promise<FileStat | undefined> {
  try {
    const [found, realPath] = await Promise.all([stat(fullPath), realpath(fullPath)])
    const kind = found.isFile() ? 'file' : found.isDirectory() ? 'dir' : 'other'
    return { kind, size: found.size, realPath }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
}
