// How an export names what one folder holds: each Branch's folder, each Context folder, each Leaf's
// file. A Tile exports under its Name when it kept one, dressed for the slot it stands in now, else
// under the folder pattern in force. Then every name that would not read back in its Direction, the
// way the shape seats a folder's names, or that another name of the folder takes, gets its number.
// Pure.
import { isSegment } from '../kept/kept'
import { type Direction, directions } from '../tile'

/** What an entry of a folder is, as the shape reads it: a folder, a dot folder, a file. */
export type EntryKind = 'branch' | 'context' | 'leaf'

/** A Tile to name in its folder: where it stands, its Title, and its Name when it kept one. */
export interface ToName {
  readonly kind: EntryKind
  /** Its Direction in its kind's ring: a Context slot's without its sign. */
  readonly direction: Direction
  readonly title: string
  readonly name?: string | undefined
  /** A Leaf written as its content alone, under its Name as it is: see `isVerbatim`. */
  readonly verbatim?: boolean
}

/**
 * The names the shape reads as something other than a Branch, a Leaf or Context, in every folder,
 * however they are cased: a folder's own file and its private one (the shape's `bodyFiles`), and what
 * it always leaves out (its built-in exclusions, `.hexframe/` among them).
 */
const shapeNames = ['CLAUDE.md', '-CLAUDE.md', '.hexframe', '.git', 'node_modules']

const markdown = /\.md$/i

/**
 * Whether a Leaf is written as its content alone, under its Name: when it reads as an import of a
 * file that isn't Markdown made it, its Name not Markdown nor a dot file, its Title that Name and its
 * Preview empty, so writing it bare loses nothing. Any other Leaf is a Markdown file.
 */
export const isVerbatim = ({
  title,
  preview,
  name,
}: Pick<ToName, 'title' | 'name'> & {
  readonly preview: string
}) =>
  name !== undefined &&
  !markdown.test(name) &&
  !name.startsWith('.') &&
  title === name &&
  preview === ''

/** The most characters a slug holds. */
const slugLength = 48

/** The letters accents don't make: what Unicode's decomposition leaves whole. */
const ligatures: Readonly<Record<string, string>> = {
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
}

/**
 * A Title as a slug: lowercase, accents transliterated, anything outside `[a-z0-9-]` a `-`, runs of
 * them one, none at either end; at most 48 characters, cut at a word boundary; `tile` when nothing is
 * left.
 */
export function slugOf(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[æœßøđðłþ]/g, (letter) => ligatures[letter] ?? letter)
  const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (slug.length <= slugLength) return slug === '' ? 'tile' : slug
  const boundary = slug.lastIndexOf('-', slugLength)
  return boundary > 0 ? slug.slice(0, boundary) : slug.slice(0, slugLength)
}

/** A name the shape seats in its number's Direction: `3-games`, `3-games.md`, `.3-games`. */
const numbered = { branch: /^([1-6])-(.+)$/, leaf: /^([1-6])-(.+)$/, context: /^\.([1-6])-(.+)$/ }

/** A Tile being named: where it stands, and the stem its name is made of. */
interface Draft extends ToName {
  readonly stem: string
}

/** The name a stem makes for its kind: a folder as it is, a dot folder, a Markdown file. */
function nameOf({ kind, stem, verbatim }: Draft): string {
  if (verbatim === true || kind === 'branch') return stem
  return kind === 'context' ? `.${stem}` : `${stem}.md`
}

/** The stem of a kept Name, whatever slot it was kept from: its leading dot and its `.md` dropped. */
const stemOf = (name: string) => name.replace(/^\./, '').replace(markdown, '')

/** A numbered stem renumbered to this Direction: `3-games` in Direction 5 is `5-games`. */
const renumbered = (stem: string, direction: Direction) =>
  stem.replace(numbered.branch, (_, __, rest: string) => `${String(direction)}-${rest}`)

/** A stem with this Direction's number put first: `games` in Direction 5 is `5-games`. */
const withNumber = (stem: string, direction: Direction) => `${String(direction)}-${stem}`

/** The stem a Tile starts from: its Name's, renumbered when numbered, else the folder pattern's. */
function stemFor(entry: ToName, folderPattern: string): string {
  const { name, title, direction, verbatim } = entry
  if (name === undefined) {
    return folderPattern.replaceAll('<n>', String(direction)).replaceAll('<slug>', slugOf(title))
  }
  const stem = verbatim === true ? name : stemOf(name)
  return renumbered(stem, direction)
}

/**
 * Where the shape seats each of these names of one kind: the numbered ones in their number's
 * Direction, the later of two claiming one left out; then the others in the free Directions, in name
 * order. Mapping holds Branches and Leaves apart, so each kind is seated among its own.
 */
function seats(names: ReadonlyArray<string>, pattern: RegExp): ReadonlyMap<string, Direction> {
  const seated = new Map<string, Direction>()
  const taken = new Set<Direction>()
  const sorted = [...new Set(names)].sort()
  const numberOf = (name: string) => Number(pattern.exec(name)?.[1]) as Direction
  for (const name of sorted.filter((name) => pattern.test(name))) {
    if (taken.has(numberOf(name))) continue
    taken.add(numberOf(name))
    seated.set(name, numberOf(name))
  }
  const free = directions.filter((direction) => !taken.has(direction))
  sorted
    .filter((name) => !pattern.test(name))
    .forEach((name, index) => {
      const direction = free[index]
      if (direction !== undefined) seated.set(name, direction)
    })
  return seated
}

/** How many times a name may take its number: one still misread after that is a defect. */
const rounds = 3

/** The names of a folder, cased as a file system that ignores case compares them. */
const folded = (name: string) => name.toLowerCase()

/**
 * The names these entries of one folder export under, in their order. `folderPattern` and `fileName`
 * are the naming in force in the folder: the pattern names what has no Name, and the folder's own
 * file takes `fileName`, so nothing else does. Throws, a defect, rather than return a name that isn't
 * one path segment or that two entries would share: such a name is never written.
 */
export function namesIn(
  entries: ReadonlyArray<ToName>,
  { folderPattern, fileName }: { folderPattern: string; fileName: string },
): ReadonlyArray<string> {
  const reserved = new Set([fileName, ...shapeNames].map(folded))
  let drafts: ReadonlyArray<Draft> = entries.map((entry) => ({
    ...entry,
    stem: stemFor(entry, folderPattern),
  }))
  for (let round = 0; round < rounds; round++) {
    const misread = misreadIn(drafts, reserved)
    if (misread.size === 0) break
    drafts = drafts.map((entry) =>
      misread.has(entry) ? { ...entry, stem: withNumber(entry.stem, entry.direction) } : entry,
    )
  }
  const names = drafts.map(nameOf)
  if (misreadIn(drafts, reserved).size > 0 || !names.every(isSegment)) {
    throw new Error(`An export cannot name a folder's entries apart: ${names.join(', ')}`)
  }
  return names
}

/**
 * The entries whose name would not read back where they stand: one the shape would seat in another
 * Direction, one the folder's own names or an entry before it already take, however it is cased, so
 * of two entries claiming one name the first keeps it.
 */
function misreadIn(
  drafts: ReadonlyArray<Draft>,
  reserved: ReadonlySet<string>,
): ReadonlySet<Draft> {
  const names = drafts.map(nameOf)
  const firstOf = new Map<string, number>()
  names.forEach((name, index) => {
    if (!firstOf.has(folded(name))) firstOf.set(folded(name), index)
  })
  const seated = new Map(
    (['branch', 'leaf', 'context'] as const).map((kind) => [
      kind,
      seats(
        names.filter((_, index) => drafts[index]?.kind === kind),
        numbered[kind],
      ),
    ]),
  )
  return new Set(
    drafts.filter((entry, index) => {
      const name = names[index] ?? ''
      return (
        reserved.has(folded(name)) ||
        firstOf.get(folded(name)) !== index ||
        seated.get(entry.kind)?.get(name) !== entry.direction
      )
    }),
  )
}
