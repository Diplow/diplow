// Reads a folder as a hexframe node, from what a directory listing and its CLAUDE.md say. Pure:
// each medium does the file system calls and hands the results here.
import { exclusionsFile, isExcluded } from './exclusions.js'

export type Direction = 1 | 2 | 3 | 4 | 5 | 6

export const directions: readonly Direction[] = [1, 2, 3, 4, 5, 6]

export interface Entry {
  name: string
  kind: 'file' | 'dir' | 'other'
}

export interface Tile {
  path: string
  title: string
  preview: string
}

/**
 * What a Frame's ring shows around its Tile. Children is the Branches and the Leaves together,
 * offered only when there are six or fewer in all, in place of the Branches and the Leaves.
 */
export type FrameKind = 'children' | 'branches' | 'leaves' | 'context'

/** The Frame kinds in the order a medium offers them. */
export const frameKinds: readonly FrameKind[] = ['children', 'branches', 'leaves', 'context']

/** What a hex of a ring holds: a child folder, a file, or a dot folder. */
export type MemberKind = 'branch' | 'leaf' | 'context'

/** A member of a ring by its name, before a medium reads its Tile. */
export interface Slot {
  kind: MemberKind
  name: string
}

/** A member of a ring with its Tile read. */
export interface Member {
  kind: MemberKind
  tile: Tile
}

/** A Leaf of a Children ring that shares its number with the Branch in that direction. */
export interface Clash {
  direction: Direction
  leaf: string
  branch: string
}

/**
 * One Frame kind's ring: its members by direction, or, when a candidate found no direction, every
 * candidate as a list.
 */
export type Ring<M> = SeatedRing<M> | OverflowingRing

/** A ring where every candidate found a direction. */
export interface SeatedRing<M> {
  overflowing: false
  members: Partial<Record<Direction, M>>
  /** Only a Children ring has any. */
  clashes: Clash[]
}

/**
 * A ring where a candidate found no direction, because six were seated or its number was taken. A
 * medium shows it as a list, not as hexes, until exclusions or renames clear it. Its candidates
 * stay names: a list shows what an exclusion would match, and a large folder reads no file.
 */
export interface OverflowingRing {
  overflowing: true
  /** Every candidate in name order, the Branches before the Leaves in a Children ring. */
  candidates: Slot[]
  /** The candidates that found no direction. */
  overflow: Slot[]
}

/**
 * The rings of the Frame kinds a folder offers: Context always, then Children, or Branches and
 * Leaves when there are more than six of them in all.
 */
export type Rings<M> = Partial<Record<FrameKind, Ring<M>>>

/** A folder seen as a hexframe: its Tile and the rings of the Frame kinds it offers. */
export interface Frame {
  tile: Tile
  rings: Rings<Member>
}

/** The file that presents a node; a private one (`-CLAUDE.md`) when the plain one is missing. */
export const bodyFiles = ['CLAUDE.md', '-CLAUDE.md'] as const

const numbered = /^([1-6])-(.+)$/
const numberedContext = /^\.([1-6])-(.+)$/

const numberOf = (name: string): Direction | undefined => numberIn(numbered, name)
const contextNumberOf = (name: string): Direction | undefined => numberIn(numberedContext, name)

function numberIn(pattern: RegExp, name: string): Direction | undefined {
  const match = pattern.exec(name)
  return match ? (Number(match[1]) as Direction) : undefined
}

/** The members a ring draws as hexes: none when it overflows, since a medium shows it as a list. */
export function membersOf<M>(ring: Ring<M> | undefined): Partial<Record<Direction, M>> {
  return ring?.overflowing === false ? ring.members : {}
}

/** The Frame kinds `rings` offers, in the order a medium cycles through them. */
export function kindsOf(rings: Rings<unknown>): FrameKind[] {
  return frameKinds.filter((kind) => rings[kind] !== undefined)
}

/** Whether a Leaf is a Markdown file, which a medium reads for its Tile and renders. */
export function isMarkdown(name: string): boolean {
  return /\.md$/i.test(name)
}

/**
 * Sorts a folder's listing into the rings of its Frame kinds, once `exclusions` and the built-in
 * ones have left their names out. A child folder is a Branch, a file a Leaf, a dot folder Context.
 * `<n>-<slug>/`, `<n>-<slug>.<ext>` and `.<n>-<slug>/` sit in direction n of their ring, the later
 * of two names claiming one number overflowing; the unnumbered ones take its free directions in
 * name order. The folder's own `CLAUDE.md` and `-CLAUDE.md` are its Tile and dot files are
 * nothing, so neither is a Leaf.
 */
export function sortEntries(
  entries: readonly Entry[],
  exclusions: readonly string[] = [],
): Rings<Slot> {
  const shown = entries.filter(({ name, kind }) => !isExcluded(name, kind === 'dir', exclusions))
  const names = (keep: (entry: Entry) => boolean) =>
    shown
      .filter(keep)
      .map(({ name }) => name)
      .sort()
  const folders = names(({ kind, name }) => kind === 'dir' && !name.startsWith('.'))
  const dotFolders = names(({ kind, name }) => kind === 'dir' && name.startsWith('.'))
  const files = names(
    ({ kind, name }) =>
      kind === 'file' && !name.startsWith('.') && !(bodyFiles as readonly string[]).includes(name),
  )
  const branches = seat('branch', folders, numberOf)
  const context = ringFrom(seat('context', dotFolders, contextNumberOf))
  if (folders.length + files.length > 6) {
    return {
      branches: ringFrom(branches),
      leaves: ringFrom(seat('leaf', files, numberOf)),
      context,
    }
  }
  return { children: ringFrom(childrenOf(branches, files)), context }
}

/** Where a ring's candidates sat, in name order, before it knows whether it overflows. */
interface Seating {
  candidates: Slot[]
  members: Partial<Record<Direction, Slot>>
  overflow: Slot[]
  clashes: Clash[]
}

/** The ring a seating makes: its members, or the list of its candidates when one found no seat. */
function ringFrom({ candidates, members, overflow, clashes }: Seating): Ring<Slot> {
  return overflow.length > 0
    ? { overflowing: true, candidates, overflow }
    : { overflowing: false, members, clashes }
}

/** Seats the numbered names in their direction, then the others in the free ones, in name order. */
function seat(
  kind: MemberKind,
  names: readonly string[],
  number: (name: string) => Direction | undefined,
): Seating {
  const seating: Seating = {
    candidates: names.map((name) => ({ kind, name })),
    members: {},
    overflow: [],
    clashes: [],
  }
  const unnumbered: string[] = []
  for (const name of names) {
    const direction = number(name)
    if (direction === undefined) unnumbered.push(name)
    else if (seating.members[direction] === undefined) seating.members[direction] = { kind, name }
    else seating.overflow.push({ kind, name })
  }
  fill(
    seating,
    unnumbered.map((name) => ({ kind, name })),
  )
  return seating
}

/**
 * The Children ring: the Branches where they sit, then each Leaf in its own number's direction
 * when that is free, then the other Leaves in the free directions in name order. A Leaf whose
 * number is the Branch's in that direction, as `3-games.md` beside `3-games/`, is a clash.
 */
function childrenOf(branches: Seating, leaves: readonly string[]): Seating {
  const seating: Seating = {
    candidates: [
      ...branches.candidates,
      ...leaves.map((name) => ({ kind: 'leaf' as const, name })),
    ],
    members: { ...branches.members },
    overflow: [...branches.overflow],
    clashes: [],
  }
  const unseated: Slot[] = []
  for (const name of leaves) {
    const direction = numberOf(name)
    const holder = direction === undefined ? undefined : seating.members[direction]
    if (direction !== undefined && holder === undefined) {
      seating.members[direction] = { kind: 'leaf', name }
      continue
    }
    if (
      direction !== undefined &&
      holder?.kind === 'branch' &&
      numberOf(holder.name) === direction
    ) {
      seating.clashes.push({ direction, leaf: name, branch: holder.name })
    }
    unseated.push({ kind: 'leaf', name })
  }
  fill(seating, unseated)
  return seating
}

/** Seats each slot in the first free direction; with none left, it overflows. */
function fill(seating: Seating, slots: readonly Slot[]) {
  for (const slot of slots) {
    const free = directions.find((direction) => seating.members[direction] === undefined)
    if (free === undefined) seating.overflow.push(slot)
    else seating.members[free] = slot
  }
}

/**
 * The files a Tile's body is read from, the first one that exists: a folder's `CLAUDE.md` or
 * `-CLAUDE.md`, a Markdown Leaf itself, and none for a Leaf that isn't Markdown. A folder shown in
 * the center reads as a Branch.
 */
export function bodySources(path: string, kind: MemberKind): string[] {
  if (kind !== 'leaf') return bodyFiles.map((name) => join(path, name))
  return isMarkdown(basename(path)) ? [path] : []
}

/** The largest file a medium reads, in bytes. Past it, a Tile comes from its name, as if unread. */
export const readLimit = 1_000_000

/** What a medium's file system says of a file before reading it, every symlink followed. */
export interface FileStat {
  kind: 'file' | 'dir' | 'other'
  size: number
  realPath?: string
}

/** What a medium got from a file: its text, or why it left the file unread. */
export type FileRead = { text: string } | { unread: string }

/**
 * Why a medium leaves `relative`, a file of a folder, unread, or undefined when it reads it. It
 * reads a regular file within the read limit whose real path lies under the folder's, compared
 * folder by folder, so a symlink never leads it out of the folder. The folder's `exclusions.yaml`
 * must sit at its own path exactly: never read through a symlink, it can't speak for another
 * folder. Real paths are absolute and resolved; a missing one is never under the folder.
 */
export function unreadable(
  file: FileStat,
  folderRealPath: string | undefined,
  relative: string,
): string | undefined {
  const folder = folderRealPath?.replace(/\/*$/, '/')
  const real = file.realPath
  const isInside =
    folder !== undefined &&
    real !== undefined &&
    (relative === exclusionsFile ? real === folder + relative : real.startsWith(folder))
  if (!isInside) return 'it leads outside its folder'
  if (file.kind !== 'file') return 'it is not a file'
  if (file.size > readLimit) return 'it is too large'
  return undefined
}

/**
 * The Tile a folder or a Leaf shows:the title and preview of its body's frontmatter, or a title
 * made from its name.
 */
export function tileOf(path: string, body: string | undefined, kind: MemberKind = 'branch'): Tile {
  const fields = body === undefined ? {} : frontmatter(body)
  return {
    path,
    title: fields.title ?? titleFromName(basename(path), kind),
    preview: fields.preview ?? '',
  }
}

/**
 * `4-software-engineering`, `.4-software-engineering` and the Leaf `4-software-engineering.md`
 * read `Software engineering`; `.claude` and a Leaf that isn't Markdown, as `package.json`, stay.
 */
export function titleFromName(name: string, kind: MemberKind = 'branch'): string {
  if (name.startsWith('.') && !numberedContext.test(name)) return name
  if (kind === 'leaf' && !isMarkdown(name)) return name
  const stem = kind === 'leaf' ? name.replace(/\.md$/i, '') : name
  const slug = stem.replace(/^\.?([1-6]-)?/, '').replace(/[-_]+/g, ' ')
  return slug === '' ? name : slug.charAt(0).toUpperCase() + slug.slice(1)
}

/**
 * The scalar fields of a YAML frontmatter: `key: value`, quoted or not, and the block scalars
 * `>` (folded) and `|` (literal), which is all the vault's frontmatters use.
 */
export function frontmatter(text: string): Record<string, string> {
  const block = splitFrontmatter(text).frontmatter
  const fields: Record<string, string> = {}
  for (let index = 0; index < block.length; index++) {
    // One `.*` after the colon, trimmed after: `\s*.*` would backtrack in time quadratic in the line.
    const match = /^([A-Za-z_][\w-]*):(.*)$/.exec(block[index] ?? '')
    if (!match) continue
    const key = match[1] ?? ''
    const raw = (match[2] ?? '').trim()
    if (/^[>|][+-]?$/.test(raw)) {
      const continued: string[] = []
      while (index + 1 < block.length && /^(\s|$)/.test(block[index + 1] ?? '')) {
        index++
        continued.push((block[index] ?? '').trim())
      }
      fields[key] = (raw.startsWith('>') ? continued.join(' ') : continued.join('\n')).trim()
    } else {
      fields[key] = unquote(raw)
    }
  }
  return fields
}

/**
 * A file's lines, split at every line ending a file may hold: `\r\n`, `\r`, `\n`, and the Unicode
 * line and paragraph separators. A line then holds none, so `.` matches all of it and `$` its end.
 */
export function linesOf(text: string): string[] {
  return text.split(/\r\n?|[\n\u2028\u2029]/)
}

/**
 * A Markdown file's frontmatter lines and its body, every line ending made `\n`. The frontmatter
 * opens with a `---` line at the top and closes with the next one; without that closing line, the
 * file has no frontmatter and is all body.
 */
export function splitFrontmatter(text: string): { frontmatter: string[]; body: string } {
  const lines = linesOf(text)
  const isFence = (line: string) => line.trim() === '---'
  // The closing line's index, or 0 when there is none.
  const end = isFence(lines[0] ?? '') ? lines.slice(1).findIndex(isFence) + 1 : 0
  if (end === 0) return { frontmatter: [], body: lines.join('\n') }
  return { frontmatter: lines.slice(1, end), body: lines.slice(end + 1).join('\n') }
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"')
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

export function join(directory: string, name: string): string {
  return directory.endsWith('/') ? directory + name : `${directory}/${name}`
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1) || '/'
}

/** The folder holding `path`, or `path` itself at the root. */
export function parent(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** `path` as written, resolved against `cwd` when relative; `.` and `..` folded. */
export function resolvePath(cwd: string, path: string): string {
  const absolute = path.startsWith('/') ? path : join(cwd, path)
  const parts: string[] = []
  for (const part of absolute.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return '/' + parts.join('/')
}
