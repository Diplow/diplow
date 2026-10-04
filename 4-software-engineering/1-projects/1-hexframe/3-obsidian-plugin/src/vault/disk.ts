// The Disk over Obsidian's vault. Branches and Leaves come from the vault's index; the dot folders,
// which the index leaves out, from its adapter. Real paths, the reads made by the real path just
// checked, and the one write, a folder's exclusions, once `readSettings` has checked where it lands,
// come from Node through `files.ts`, which is why the plugin is desktop only.
import { FileSystemAdapter, TFolder, type App } from 'obsidian'

import type { Entry } from '../../../2-claude-mod/hooks/shape/node.ts'
import { readChecked, replaceFile, statAt } from './files.ts'
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
 * Writes a file of the vault as `replaceFile` does, the file renamed over rather than written
 * through, so a symlink swapped in since `readSettings` checked it, or a dangling one, is replaced
 * and nothing outside the vault is touched; undefined where Obsidian keeps the vault outside a file
 * system.
 */
export function writerOf(app: App): Write | undefined {
  const { adapter } = app.vault
  if (!(adapter instanceof FileSystemAdapter)) return undefined
  return (path, text) => replaceFile(adapter.getFullPath(vaultPath(path)), text)
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
