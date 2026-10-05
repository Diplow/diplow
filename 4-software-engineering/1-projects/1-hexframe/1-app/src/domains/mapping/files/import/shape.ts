// The one module of the app that calls the shape (2-claude-mod/hooks/shape/), the reading rules every
// medium shares, so a folder reads into Tiles in the app as it reads in Claude Code and in Obsidian. It
// hands the shape a folder's listing and a file's text, and answers in Mapping's words: what a folder
// leaves out, where each of its Branches, Leaves and Context folders sits, a Markdown file's
// frontmatter and Body, a Title made from a name. None of the shape's types leaves it. Pure.
import {
  exclusionsFile,
  isExcluded,
  parseExclusions,
  settingsFolder,
} from '../../../../../../2-claude-mod/hooks/shape/exclusions'
import {
  bodyFiles,
  isMarkdown,
  linesOf,
  readLimit,
  type Ring,
  type Slot,
  sortEntries,
  splitFrontmatter,
  titleFromName,
} from '../../../../../../2-claude-mod/hooks/shape/node'
import type { Direction } from '../../tile'
import { type EntryKind, claimedBy } from '../names'

/** The largest file an import reads, in bytes, as every medium does. */
export const fileLimit: number = readLimit

/** A folder's settings, `.hexframe/`, which every reading leaves out once it has read them. */
export const settings = {
  folder: settingsFolder,
  exclusions: exclusionsFile.slice(settingsFolder.length + 1),
  config: 'config.yaml',
}

/** The names a folder lists: its folders, dot folders among them, and its files. */
export interface Listing {
  readonly folders: ReadonlyArray<string>
  readonly files: ReadonlyArray<string>
}

/** The exclusions an `exclusions.yaml` lists; `undefined` when it can't be read as one. */
export function exclusionsIn(text: string): ReadonlyArray<string> | undefined {
  try {
    return parseExclusions(text)
  } catch {
    return undefined
  }
}

/** What a folder lists once its exclusions, and the ones every folder has, leave their names out. */
export const shownIn = (
  { folders, files }: Listing,
  exclusions: ReadonlyArray<string>,
): Listing => ({
  folders: folders.filter((name) => !isExcluded(name, true, exclusions)),
  files: files.filter((name) => !isExcluded(name, false, exclusions)),
})

/**
 * The files a folder's Tile is read from, the first one it holds: the file name in force there, then
 * the shape's own, `CLAUDE.md` and the private `-CLAUDE.md`.
 */
export const ownFilesFor = (fileName: string): ReadonlyArray<string> => [
  ...new Set([fileName, ...bodyFiles]),
]

/** A dot file, which the shape reads as neither a Leaf nor Context. */
export const isDotFile = (name: string) => name.startsWith('.')

/** Whether a Leaf is Markdown, read for its frontmatter, rather than kept as it is. */
export const isMarkdownFile = (name: string) => isMarkdown(name)

/** The Title a name makes for a Tile of this kind: `4-software-engineering` reads `Software engineering`. */
export const titleFromNameOf = (name: string, kind: EntryKind) => titleFromName(name, kind)

/**
 * A Markdown file's frontmatter, as YAML lines, and its Body, cut where the shape cuts them: the
 * frontmatter opens with a `---` first line and closes with the next one, else there is none and the
 * whole file is Body. The Body is kept as written, its line endings included.
 */
export function markdownOf(text: string): { frontmatter: string | undefined; body: string } {
  const lines = linesOf(text)
  const split = splitFrontmatter(text)
  // With a block, the shape's Body has fewer lines than the file: the block's and its two fences.
  if (split.body.split('\n').length === lines.length) return { frontmatter: undefined, body: text }
  // The Body starts after the line ending that closes the block, the fences' two lines counted.
  const ending = [...text.matchAll(/\r\n?|[\n\u2028\u2029]/g)][split.frontmatter.length + 1]
  const body = ending === undefined ? '' : text.slice(ending.index + ending[0].length)
  return { frontmatter: split.frontmatter.join('\n'), body }
}

/**
 * Where each name of one kind sits in its ring, as the shape seats it, or why none can: more than six,
 * so the ring overflows, or names of which two claim one Direction, the later in name order.
 */
export interface Seating {
  /** Every name of the kind, in name order, seated or not. */
  readonly candidates: ReadonlyArray<string>
  /** Where each name sits, when the ring seats every one. */
  readonly seats: ReadonlyMap<string, Direction>
  readonly overflows: boolean
  readonly claimed: ReadonlyArray<string>
}

/** The candidates of a ring, in name order, wherever the shape seated them. */
function candidatesOf(ring: Ring<Slot> | undefined): ReadonlyArray<string> {
  if (ring === undefined) return []
  if (ring.overflowing) return ring.candidates.map(({ name }) => name)
  return Object.values(ring.members)
    .map(({ name }) => name)
    .sort()
}

/** The seats of a ring the shape seated whole: each name by its Direction. */
function seatsOf(ring: Ring<Slot> | undefined): ReadonlyMap<string, Direction> {
  if (ring === undefined || ring.overflowing) return new Map()
  return new Map(
    Object.entries(ring.members).map(([direction, { name }]) => [
      name,
      Number(direction) as Direction,
    ]),
  )
}

/** The names of a kind that claim a Direction an earlier name, in name order, already claims. */
function claimedIn(kind: EntryKind, names: ReadonlyArray<string>): ReadonlyArray<string> {
  const claims = new Set<Direction>()
  return names.filter((name) => {
    const direction = claimedBy(kind, name)
    if (direction === undefined) return false
    if (claims.has(direction)) return true
    claims.add(direction)
    return false
  })
}

function seatingOf(kind: EntryKind, ring: Ring<Slot> | undefined): Seating {
  const candidates = candidatesOf(ring)
  return {
    candidates,
    seats: seatsOf(ring),
    overflows: candidates.length > 6,
    claimed: claimedIn(kind, candidates),
  }
}

/**
 * Where a folder's Branches, Leaves and Context folders sit, its listing already shown (`shownIn`) and
 * its own file left out. Mapping holds Branches and Leaves apart, so each kind is seated alone, as the
 * shape seats a ring of Branches or of Leaves: the numbered names in their number's Direction, the
 * others in the free ones in name order; dot files and the shape's own files are no Leaves.
 */
export function seatingIn({ folders, files }: Listing): Readonly<Record<EntryKind, Seating>> {
  const ofFolders = sortEntries(folders.map((name) => ({ name, kind: 'dir' as const })))
  const ofFiles = sortEntries(files.map((name) => ({ name, kind: 'file' as const })))
  return {
    branch: seatingOf('branch', ofFolders.children ?? ofFolders.branches),
    leaf: seatingOf('leaf', ofFiles.children ?? ofFiles.leaves),
    context: seatingOf('context', ofFolders.context),
  }
}
