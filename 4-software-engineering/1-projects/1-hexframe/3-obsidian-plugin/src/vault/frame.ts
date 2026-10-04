// Reads a folder of the vault as a Frame, through the shape, from what a Disk says. Every file the
// view reads goes through here, so the shape's rules on what a medium reads hold for all of them.
import {
  exclusionsFile,
  exclusionsFrom,
  isExcluded,
} from '../../../2-claude-mod/hooks/shape/exclusions.ts'
import {
  basename,
  bodySources,
  directions,
  kindsOf,
  liesWithin,
  parent,
  sortEntries,
  tileOf,
  unreadable,
  type Direction,
  type Entry,
  type FileRead,
  type FileStat,
  type Frame,
  type FrameKind,
  type Member,
  type OverflowingRing,
  type Rings,
  type SeatedRing,
  type Slot,
  type Tile,
} from '../../../2-claude-mod/hooks/shape/node.ts'

/**
 * The vault as the view reads it. Paths are relative to the vault, `''` being its root; a leading
 * or trailing `/` is dropped, so the shape's `/`-rooted paths read the same.
 */
export interface Disk {
  /** A folder's entries, its dot folders among them. */
  list(folder: string): Promise<Entry[]>
  /** What is at `path`, every symlink followed, its real path absolute; undefined when nothing. */
  stat(path: string): Promise<FileStat | undefined>
  /**
   * The text of the file at `realPath`, a real path its `stat` gave, refused when what is there is
   * no longer a regular file within the read limit.
   */
  read(realPath: string): Promise<string>
}

/** `path` as a Disk takes it: relative to the vault, with no leading or trailing `/`. */
export function vaultPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

/** A Frame read from the vault, and what the view should say about how it was read. */
export interface Read {
  frame: Frame
  warnings: string[]
}

/**
 * `folder` read as a Frame: its Tile, and the Tile of each member of its rings, once its
 * `exclusions.yaml` has left names out. A file that can't be read gives a Tile from its name.
 */
export async function readFrame(disk: Disk, folder: string): Promise<Read> {
  const reader = await readerOf(disk)
  const { sorted, exclusions } = await sortFolder(reader, folder)
  const rings: Rings<Member> = {}
  if (sorted.children) rings.children = await readRing(reader, folder, sorted.children)
  for (const kind of ['branches', 'leaves', 'context'] as const) {
    const ring = sorted[kind]
    if (ring) rings[kind] = await readRing(reader, folder, ring)
  }
  const frame = { tile: await readTile(reader, folder, 'branch'), rings }
  return { frame, warnings: exclusions.warning === undefined ? [] : [exclusions.warning] }
}

/**
 * `folder` read as a Frame when the view may center on it, or why it isn't: a Branch the view
 * opens is shown as much as a center is, so it is held to the same check, `refusal`. It never
 * throws: a read that fails gives its reason, so one Branch can't take the whole view down.
 */
export async function readOpened(disk: Disk, folder: string): Promise<Read | { refused: string }> {
  const refused = await refusal(disk, folder)
  if (refused !== undefined) return { refused }
  try {
    return await readFrame(disk, folder)
  } catch (error) {
    return { refused: messageOf(error) }
  }
}

/**
 * The Frame kinds `folder` offers when the view may open it, read from its listing alone, or
 * undefined when it may not or can't be read: what a closed Branch would open into.
 */
export async function readKinds(disk: Disk, folder: string): Promise<FrameKind[] | undefined> {
  try {
    const reader = await readerOf(disk)
    if ((await refusalBy(reader, folder)) !== undefined) return undefined
    return kindsOf((await sortFolder(reader, folder)).sorted)
  } catch {
    return undefined
  }
}

/**
 * The Frame kinds each of `folders` offers, by direction, read side by side, as `readKinds` reads
 * them; a folder that offers none is left out.
 */
export async function readKindsOf(
  disk: Disk,
  folders: readonly { direction: Direction; path: string }[],
): Promise<Partial<Record<Direction, FrameKind[]>>> {
  const read = await Promise.all(
    folders.map(async ({ direction, path }) => ({
      direction,
      kinds: await readKinds(disk, vaultPath(path)),
    })),
  )
  const kinds: Partial<Record<Direction, FrameKind[]>> = {}
  for (const { direction, kinds: offered } of read) if (offered) kinds[direction] = offered
  return kinds
}

/** `folder`'s listing sorted into rings of names, once its `exclusions.yaml` has left some out. */
async function sortFolder(reader: Reader, folder: string) {
  const exclusions = exclusionsFrom(await readInFolder(reader, folder, exclusionsFile))
  return { sorted: sortEntries(await reader.disk.list(folder), exclusions.exclusions), exclusions }
}

/** A Disk, and the real path of the vault's root, which everything read must lie within. */
interface Reader {
  disk: Disk
  root: string | undefined
}

async function readerOf(disk: Disk): Promise<Reader> {
  return { disk, root: (await disk.stat(''))?.realPath }
}

/** A seated ring of Slots, `R`, with each one's Tile read. */
type Loaded<R extends SeatedRing<Slot>> = Omit<R, 'members'> & SeatedRing<Member>

/** Reads the Tile of each seated member; an overflowing ring stays names, and reads no file. */
async function readRing<R extends SeatedRing<Slot>>(
  reader: Reader,
  folder: string,
  ring: R | OverflowingRing,
): Promise<Loaded<R> | OverflowingRing> {
  if (ring.overflowing) return ring
  const members: SeatedRing<Member>['members'] = {}
  for (const direction of directions) {
    const slot = ring.members[direction]
    if (slot) {
      const tile = await readTile(reader, inFolder(folder, slot.name), slot.kind)
      members[direction] = { kind: slot.kind, tile }
    }
  }
  return { ...ring, members }
}

/** The Tile at `path`, from the first of its body files that exists and can be read. */
async function readTile(reader: Reader, path: string, kind: Slot['kind']): Promise<Tile> {
  for (const file of bodySources(path, kind)) {
    const read = await readInFolder(reader, parent(file), basename(file))
    if (read) return tileOf(path, 'text' in read ? read.text : undefined, kind)
  }
  return tileOf(path, undefined, kind)
}

/**
 * `relative`, a file of `folder`, read when the shape's `unreadable` lets a medium read it and its
 * real path lies within the vault's, or undefined when there is none. Obsidian's index lists a
 * symlinked folder as a folder, so a file can lie in its folder and still out of the vault. It
 * never throws: a read that fails gives its reason.
 */
async function readInFolder(
  { disk, root }: Reader,
  folder: string,
  relative: string,
): Promise<FileRead | undefined> {
  try {
    const file = await disk.stat(inFolder(folder, relative))
    if (file === undefined) return undefined
    const unread =
      unreadable(file, (await disk.stat(folder))?.realPath, relative) ??
      (isWithin(file.realPath, root) ? undefined : 'it leads outside the vault')
    if (unread !== undefined) return { unread }
    return { text: await disk.read(file.realPath ?? '') }
  } catch (error) {
    return { unread: messageOf(error) }
  }
}

/** The folder a view shows, and what it says about it; or why it can show none. */
export type Center = { folder: string; note?: string } | { refused: string }

/**
 * The folder to show for `wanted`, the center a view state names (`dropped` saying why it named
 * none it may show), with `home`, the hexframe file's own folder, as the fallback. `home` is
 * checked too, since it may lie in a symlinked folder out of the vault: when it can't be shown
 * either, nothing is.
 */
export async function centerToShow(
  disk: Disk,
  wanted: { folder: string; dropped?: string },
  home: string,
): Promise<Center> {
  let note: string | undefined
  if (wanted.dropped !== undefined || wanted.folder !== home) {
    const refused = wanted.dropped ?? (await refusal(disk, wanted.folder))
    if (refused === undefined) return { folder: wanted.folder }
    note = `its center can't be shown, as ${refused}: the view shows its own folder`
  }
  const refused = await refusal(disk, home)
  if (refused !== undefined) return { refused }
  return note === undefined ? { folder: home } : { folder: home, note }
}

/**
 * Why the view can't center on `folder`, or undefined when it can: it must be a folder whose real
 * path, symlinks followed, lies within the vault's, and no folder on the way there may leave out
 * the next one, along the path as written or along the real one. A folder the file system fails
 * on gives the failure.
 */
export async function refusal(disk: Disk, folder: string): Promise<string | undefined> {
  try {
    return await refusalBy(await readerOf(disk), folder)
  } catch (error) {
    return messageOf(error)
  }
}

/** `refusal` through `reader`, whose vault root is already read; it may throw. */
async function refusalBy(reader: Reader, folder: string): Promise<string | undefined> {
  const found = await reader.disk.stat(folder)
  if (found === undefined) return 'it does not exist'
  if (found.kind !== 'dir') return 'it is not a folder'
  const { root } = reader
  if (root === undefined || !isWithin(found.realPath, root)) return 'it leads out of the vault'
  const real = (found.realPath ?? '').slice(root.replace(/\/*$/, '').length)
  return (await leftOut(reader, vaultPath(folder))) ?? (await leftOut(reader, real))
}

/** Who a clicked file is opened by: Obsidian, in the paired pane, or the system's default app. */
export type Opener = 'obsidian' | 'system'

/**
 * The extensions of the files the system's default app may be handed: documents it opens and
 * doesn't run, picked from what a vault holds beside its notes. Office files are left out, since
 * their app runs macros, links and formulas they carry. Whatever else the system may run,
 * or follow elsewhere (a program, a script, an installer, a shortcut, a file with no extension), so
 * it gets nothing that isn't listed here.
 */
const documents = new Set([
  ...['pdf', 'epub', 'txt', 'json', 'yaml', 'yml', 'toml', 'log'],
  ...['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'avif', 'ico'],
  ...['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'],
])

/** Whether the file at `path` is a document the system's default app may be handed. */
function isDocument(path: string): boolean {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 && documents.has(name.slice(dot + 1).toLowerCase())
}

/**
 * Why `path` can't be opened by `opener`, or undefined when it can: it must be a file whose real
 * path, symlinks followed, lies within the vault's, so a shared vault can't make a click open what
 * lies beyond it. The system gets a document only, by the name written and by the real one, so a
 * click never runs anything. A file the file system fails on gives the failure.
 */
export async function unopenable(
  disk: Disk,
  path: string,
  opener: Opener = 'obsidian',
): Promise<string | undefined> {
  try {
    const { root } = await readerOf(disk)
    const found = await disk.stat(path)
    if (found === undefined) return 'it does not exist'
    if (found.kind !== 'file') return 'it is not a file'
    if (!isWithin(found.realPath, root)) return 'it leads out of the vault'
    const isHandable = isDocument(path) && isDocument(found.realPath ?? '')
    return opener === 'system' && !isHandable ? 'it is no document the system opens' : undefined
  } catch (error) {
    return messageOf(error)
  }
}

/** Why a folder on `relative`, a path from the vault's root, leaves out the next one. */
async function leftOut(reader: Reader, relative: string): Promise<string | undefined> {
  let above = ''
  for (const name of relative.split('/').filter(Boolean)) {
    if (isExcluded(name, true, [])) return `every folder leaves out ${name}`
    const { exclusions } = exclusionsFrom(await readInFolder(reader, above, exclusionsFile))
    if (isExcluded(name, true, exclusions)) {
      return `${inFolder(above, exclusionsFile)} leaves out ${name}`
    }
    above = inFolder(above, name)
  }
  return undefined
}

function isWithin(realPath: string | undefined, root: string | undefined): boolean {
  return realPath !== undefined && root !== undefined && liesWithin(realPath, root)
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The path of `name` in `folder`, `''` being the vault root. */
export function inFolder(folder: string, name: string): string {
  const base = vaultPath(folder)
  return base === '' ? name : `${base}/${name}`
}
