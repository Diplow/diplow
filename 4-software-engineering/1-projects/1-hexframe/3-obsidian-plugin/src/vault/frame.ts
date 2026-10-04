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
  parent,
  sortEntries,
  tileOf,
  unreadable,
  type Entry,
  type FileRead,
  type FileStat,
  type Frame,
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
  read(path: string): Promise<string>
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
  const exclusions = exclusionsFrom(await readInFolder(disk, folder, exclusionsFile))
  const sorted = sortEntries(await disk.list(folder), exclusions.exclusions)
  const rings: Rings<Member> = {}
  if (sorted.children) rings.children = await readRing(disk, folder, sorted.children)
  for (const kind of ['branches', 'leaves', 'context'] as const) {
    const ring = sorted[kind]
    if (ring) rings[kind] = await readRing(disk, folder, ring)
  }
  const frame = { tile: await readTile(disk, folder, 'branch'), rings }
  return { frame, warnings: exclusions.warning === undefined ? [] : [exclusions.warning] }
}

/** A seated ring of Slots, `R`, with each one's Tile read. */
type Loaded<R extends SeatedRing<Slot>> = Omit<R, 'members'> & SeatedRing<Member>

/** Reads the Tile of each seated member; an overflowing ring stays names, and reads no file. */
async function readRing<R extends SeatedRing<Slot>>(
  disk: Disk,
  folder: string,
  ring: R | OverflowingRing,
): Promise<Loaded<R> | OverflowingRing> {
  if (ring.overflowing) return ring
  const members: SeatedRing<Member>['members'] = {}
  for (const direction of directions) {
    const slot = ring.members[direction]
    if (slot) {
      const tile = await readTile(disk, inFolder(folder, slot.name), slot.kind)
      members[direction] = { kind: slot.kind, tile }
    }
  }
  return { ...ring, members }
}

/** The Tile at `path`, from the first of its body files that exists and can be read. */
async function readTile(disk: Disk, path: string, kind: Slot['kind']): Promise<Tile> {
  for (const file of bodySources(path, kind)) {
    const read = await readInFolder(disk, parent(file), basename(file))
    if (read) return tileOf(path, 'text' in read ? read.text : undefined, kind)
  }
  return tileOf(path, undefined, kind)
}

/**
 * `relative`, a file of `folder`, read when the shape's `unreadable` lets a medium read it, or
 * undefined when there is none. It never throws: a read that fails gives its reason.
 */
async function readInFolder(
  disk: Disk,
  folder: string,
  relative: string,
): Promise<FileRead | undefined> {
  try {
    const file = await disk.stat(inFolder(folder, relative))
    if (file === undefined) return undefined
    const unread = unreadable(file, (await disk.stat(folder))?.realPath, relative)
    return unread === undefined ? { text: await disk.read(inFolder(folder, relative)) } : { unread }
  } catch (error) {
    return { unread: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Why the view can't center on `folder`, or undefined when it can: it must be a folder whose real
 * path, symlinks followed, lies in the vault's, compared folder by folder, and no folder on the way
 * may leave out the next one in its `exclusions.yaml`.
 */
export async function refusal(disk: Disk, folder: string): Promise<string | undefined> {
  const [found, vault] = await Promise.all([disk.stat(folder), disk.stat('')])
  if (found === undefined) return 'it does not exist'
  if (found.kind !== 'dir') return 'it is not a folder'
  const root = vault?.realPath?.replace(/\/*$/, '/')
  const real = found.realPath === undefined ? undefined : `${found.realPath}/`
  if (root === undefined || real?.startsWith(root) !== true) return 'it leads out of the vault'
  let above = ''
  for (const name of vaultPath(folder).split('/').filter(Boolean)) {
    const { exclusions } = exclusionsFrom(await readInFolder(disk, above, exclusionsFile))
    if (isExcluded(name, true, exclusions))
      return `${inFolder(above, exclusionsFile)} leaves it out`
    above = inFolder(above, name)
  }
  return undefined
}

/** The path of `name` in `folder`, `''` being the vault root. */
export function inFolder(folder: string, name: string): string {
  const base = vaultPath(folder)
  return base === '' ? name : `${base}/${name}`
}
