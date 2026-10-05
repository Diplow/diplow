// Files read back into Tiles the way the shape reads a vault, through `shape.ts`: a folder is a Tile
// from its file in force, its folders Branches, its files Leaves, its dot folders Context, each seated
// in its Direction; `.hexframe/` gives a Tile its config and leaves names out, then is forgotten. What
// the shape settles is repaired (a folder without a title takes its name, an unnumbered name the first
// free Direction); what a System can't hold, binaries and dot files, is skipped and reported; anything
// else wrong refuses the whole import, every fault at once. Pure: an import plan, or `ImportRefused`.
import { Result } from 'effect'

import { type ImportFault, ImportRefused } from '../../errors'
import { type Frontmatter, keepable, type Naming, reservedKeys } from '../../kept/kept'
import { defaultNaming, inherited } from '../../kept/naming'
import { contentBounds, type ContextDirection, type Direction, fitsPreview } from '../../tile'
import { mappingIn } from '../frontmatter'
import type { EntryKind } from '../names'
import type {
  IdOfLink,
  ImportFile,
  ImportPlan,
  ImportSource,
  PlannedLeaf,
  PlannedReference,
  PlannedTile,
  ReferenceTarget,
  Skipped,
} from './plan'
import {
  exclusionsIn,
  fileLimit,
  isDotFile,
  isMarkdownFile,
  markdownOf,
  ownFilesFor,
  seatingIn,
  settings,
  shownIn,
  titleFromNameOf,
} from './shape'

/** How many folders deep an import goes below its root. */
const depthLimit = 16

/** A folder of an import, as its file list draws it. */
interface Folder {
  readonly files: Map<string, Uint8Array>
  readonly folders: Map<string, Folder>
}

const emptyFolder = (): Folder => ({ files: new Map(), folders: new Map() })

/** The folders a file list draws, from its root: a folder is there when a file is below it. */
function treeOf(files: ReadonlyArray<ImportFile>): Folder {
  const root = emptyFolder()
  for (const { path, bytes } of files) {
    const segments = path.split('/')
    const name = segments.pop() ?? ''
    let folder = root
    for (const segment of segments) {
      const below = folder.folders.get(segment) ?? emptyFolder()
      folder.folders.set(segment, below)
      folder = below
    }
    folder.files.set(name, bytes)
  }
  return root
}

/** A path from the import's root: `''` is the root itself. */
const join = (folder: string, name: string) => (folder === '' ? name : `${folder}/${name}`)

const utf8 = new TextDecoder('utf-8', { fatal: true })

/** A file's text, or `undefined` for a binary: bytes that aren't UTF-8, or that hold a NUL. */
function textOf(bytes: Uint8Array): string | undefined {
  try {
    const text = utf8.decode(bytes)
    return text.includes('\0') ? undefined : text
  } catch {
    return undefined
  }
}

/** A Tile planned before its References are resolved: each holds what its file says it points at. */
type Draft = PlannedTile<string>

/** What a reading collects as it walks the import. */
interface Reading {
  readonly faults: Array<ImportFault>
  readonly skipped: Array<Skipped>
  /** The path of each Tile read, by the path of the file it was read from, with and without `.md`. */
  readonly linkable: Map<string, string>
}

const fault = (reading: Reading, path: string, why: ImportFault['fault']) => {
  reading.faults.push({ path, fault: why })
}

/** The fields a file's frontmatter gives a Tile, read as YAML. */
interface Fields {
  readonly title?: string | undefined
  readonly preview: string
  readonly reference?: string | undefined
  readonly frontmatter?: Frontmatter | undefined
}

/** What a Tile reads from a file it doesn't have: no field, no Body. */
const nothingRead: { readonly fields: Fields; readonly body: string } = {
  fields: { preview: '' },
  body: '',
}

/** A frontmatter value a Tile reads as text: a string as it is, a number or a boolean as written. */
function scalar(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/**
 * The fields of a frontmatter: its Title, Preview and Reference, then the keys it keeps, every key an
 * export writes itself dropped first, `id` among them; `undefined` when it isn't YAML of keys and
 * values, holds a list where a Tile reads text, or keeps what a Tile can't.
 */
function fieldsOf(yaml: string | undefined): Fields | undefined {
  const all = yaml === undefined ? {} : mappingIn(yaml)
  if (all === undefined) return undefined
  const [title, preview, reference] = [all.title, all.preview, all.reference].map(scalar)
  if (title === null || preview === null || reference === null) return undefined
  const kept = Object.fromEntries(
    Object.entries(all).filter(([key]) => !reservedKeys.includes(key)),
  )
  if (Object.keys(kept).length > 0 && !keepable.frontmatter(kept)) return undefined
  return {
    title,
    preview: preview ?? '',
    reference,
    ...(keepable.frontmatter(kept) && Object.keys(kept).length > 0 ? { frontmatter: kept } : {}),
  }
}

/** Where a reading stands: the path of what it reads, its name and kind, the naming above it. */
interface At {
  readonly path: string
  readonly name: string
  readonly kind: EntryKind
  readonly naming: Naming
  readonly depth: number
}

/** A Tile's content and Name, each checked against its bound, every fault on the Tile's path. */
function contentOf(
  { path, name, kind }: Pick<At, 'path' | 'name' | 'kind'>,
  { fields, body }: { fields: Fields; body: string },
  reading: Reading,
) {
  const title = fields.title?.trim() || titleFromNameOf(name, kind)
  if (!keepable.name(name)) fault(reading, path, 'NameInvalid')
  if (title.length > contentBounds.title) fault(reading, path, 'TitleTooLong')
  if (!fitsPreview(fields.preview)) fault(reading, path, 'PreviewTooLong')
  if (body.length > contentBounds.body) fault(reading, path, 'BodyTooLong')
  return {
    path,
    title,
    preview: fields.preview,
    body,
    ...(keepable.name(name) ? { name } : {}),
    ...(fields.frontmatter === undefined ? {} : { frontmatter: fields.frontmatter }),
  }
}

/**
 * A file's text as a Tile reads it: a Markdown file's frontmatter and Body, any other file's whole text
 * as its Body; `undefined`, with its fault, when its frontmatter can't be read.
 */
function fileRead(path: string, text: string, reading: Reading) {
  const { frontmatter, body } = markdownOf(text)
  const fields = fieldsOf(frontmatter)
  if (fields === undefined) fault(reading, path, 'FrontmatterInvalid')
  return fields === undefined ? undefined : { fields, body }
}

/** A Leaf from its file: a Markdown one from its frontmatter and Body, any other as it is. */
function leafOf(at: Pick<At, 'path' | 'name'>, text: string, reading: Reading): PlannedLeaf {
  const read = isMarkdownFile(at.name)
    ? fileRead(at.path, text, reading)
    : { fields: { title: at.name, preview: '' }, body: text }
  const content = contentOf({ ...at, kind: 'leaf' }, read ?? nothingRead, reading)
  linkable(reading, at.path, at.path)
  return { _tag: 'Leaf', ...content }
}

/**
 * The texts of a folder's files, once its exclusions left their names out: a dot file or a binary is
 * skipped and reported, a file past the shape's limit is a fault.
 */
function textsIn(
  folder: Folder,
  { path, files }: { path: string; files: ReadonlyArray<string> },
  reading: Reading,
): ReadonlyMap<string, string> {
  const texts = new Map<string, string>()
  for (const name of files) {
    const bytes = folder.files.get(name) ?? new Uint8Array()
    const text = isDotFile(name) ? undefined : textOf(bytes)
    if (text === undefined) {
      reading.skipped.push({
        path: join(path, name),
        reason: isDotFile(name) ? 'DotFile' : 'Binary',
      })
    } else if (bytes.length > fileLimit) fault(reading, join(path, name), 'FileTooLarge')
    else texts.set(name, text)
  }
  return texts
}

/** A Tile config from its file: only the parts a config sets, each checked; `undefined` otherwise. */
function configIn(text: string) {
  const parts = mappingIn(text)
  if (parts === undefined) return undefined
  const { fileName, folderPattern, ...other } = parts
  const config = {
    ...(fileName === undefined ? {} : { fileName }),
    ...(folderPattern === undefined ? {} : { folderPattern }),
  }
  return Object.keys(other).length === 0 && keepable.config(config) ? config : undefined
}

/**
 * What a folder's `.hexframe/` says: the config it sets and the names it leaves out. A file there that
 * isn't text, or can't be read as what it holds, is a fault.
 */
function settingsOf(folder: Folder, path: string, reading: Reading) {
  const own = folder.folders.get(settings.folder)
  const read = <T>(
    name: string,
    parse: (text: string) => T | undefined,
    why: ImportFault['fault'],
  ) => {
    const bytes = own?.files.get(name)
    if (bytes === undefined) return undefined
    const text = textOf(bytes)
    const parsed = text === undefined ? undefined : parse(text)
    if (parsed === undefined) fault(reading, join(join(path, settings.folder), name), why)
    return parsed
  }
  return {
    config: read(settings.config, configIn, 'ConfigInvalid'),
    exclusions: read(settings.exclusions, exclusionsIn, 'ExclusionsInvalid') ?? [],
  }
}

/** Where a folder's Branches, Leaves and Context folders sit, each kind in its ring. */
type Seating = ReturnType<typeof seatingIn>

/** The faults of a folder's rings: one that overflows, names that claim a Direction already claimed. */
function ringFaults(path: string, seating: Seating, reading: Reading) {
  for (const { overflows, claimed } of Object.values(seating)) {
    if (overflows) fault(reading, path, 'RingOverflows')
    else for (const name of claimed) fault(reading, join(path, name), 'DirectionClaimed')
  }
}

/**
 * Each name of a ring with the Direction it sits in, or none when the ring can't seat it: a ring at
 * fault is still read whole, so the import lists every fault below it too.
 */
const seated = ({ candidates, seats }: Seating[EntryKind]) =>
  candidates.map((name) => [name, seats.get(name)] as const)

/** A file a `[[wikilink]]` reaches the Tile at `path` by, with and without its `.md`. */
function linkable(reading: Reading, file: string, path: string) {
  reading.linkable.set(file, path)
  reading.linkable.set(file.replace(/\.md$/i, ''), path)
}

/** What a folder holds below it, read: its Branches, its Leaves and its Context, each in its slot. */
function belowOf(
  folder: Folder,
  {
    at,
    naming,
    texts,
    seating,
  }: { at: At; naming: Naming; texts: ReadonlyMap<string, string>; seating: Seating },
  reading: Reading,
): Pick<Draft, 'branches' | 'leaves' | 'context'> {
  const read = (name: string, kind: EntryKind) =>
    folderOf(
      folder.folders.get(name) ?? emptyFolder(),
      { path: join(at.path, name), name, kind, naming, depth: at.depth + 1 },
      reading,
    )
  const branches: Partial<Record<Direction, Draft>> = {}
  for (const [name, direction] of seated(seating.branch)) {
    const branch = read(name, 'branch')
    if (branch?._tag === 'Tile' && direction !== undefined) branches[direction] = branch
  }
  const context: Draft['context'] = {}
  for (const [name, direction] of seated(seating.context)) {
    const held = read(name, 'context')
    if (held !== undefined && direction !== undefined) {
      context[-direction as ContextDirection] = held
    }
  }
  const leaves: Draft['leaves'] = {}
  for (const [name, direction] of seated(seating.leaf)) {
    const leaf = leafOf({ path: join(at.path, name), name }, texts.get(name) ?? '', reading)
    if (direction !== undefined) leaves[direction] = leaf
  }
  return { branches, leaves, context }
}

/** A folder's own file, the first of the files in force it holds, read; none when it holds none. */
function ownOf(
  at: At,
  { naming, texts }: { naming: Naming; texts: ReadonlyMap<string, string> },
  reading: Reading,
) {
  const name = ownFilesFor(naming.fileName).find((own) => texts.has(own))
  if (name === undefined) return { read: nothingRead }
  const path = join(at.path, name)
  linkable(reading, path, at.path)
  return { name, read: fileRead(path, texts.get(name) ?? '', reading) }
}

/**
 * A folder read as a Tile, from its file in force, with everything below it; or, for a Context folder
 * whose file names a `reference`, a Reference, which holds nothing. `undefined` past the depth an
 * import goes to.
 */
function folderOf(
  folder: Folder,
  at: At,
  reading: Reading,
): Draft | PlannedReference<string> | undefined {
  if (at.depth > depthLimit) {
    fault(reading, at.path, 'TooDeep')
    return undefined
  }
  const { config, exclusions } = settingsOf(folder, at.path, reading)
  const naming = inherited(at.naming, config === undefined ? {} : { config })
  const shown = shownIn(
    { folders: [...folder.folders.keys()], files: [...folder.files.keys()] },
    exclusions,
  )
  const texts = textsIn(folder, { path: at.path, files: shown.files }, reading)
  const own = ownOf(at, { naming, texts }, reading)
  const leaves = [...texts.keys()].filter((name) => name !== own.name)
  const reference = at.kind === 'context' ? own.read?.fields.reference : undefined
  if (reference !== undefined) {
    if (shown.folders.length + leaves.length > 0) fault(reading, at.path, 'ReferenceHoldsSomething')
    return { _tag: 'Reference', path: at.path, target: reference }
  }
  const seating = seatingIn({ folders: shown.folders, files: leaves })
  ringFaults(at.path, seating, reading)
  return {
    _tag: 'Tile',
    ...contentOf(at, own.read ?? nothingRead, reading),
    ...(config === undefined ? {} : { config }),
    ...belowOf(folder, { at, naming, texts, seating }, reading),
  }
}

/** A `[[wikilink]]`'s path, its alias and heading dropped; `undefined` for anything else. */
const wikilinked = (reference: string) =>
  /^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/.exec(reference.trim())?.[1]?.trim()

/** What a Reference's file points at, once every Tile of the import has been read. */
function targetOf(
  reference: string,
  { linkable, link }: { linkable: ReadonlyMap<string, string>; link: IdOfLink },
): ReferenceTarget {
  const path = wikilinked(reference)
  if (path !== undefined) {
    const inside = linkable.get(path)
    return inside === undefined ? { _tag: 'Broken' } : { _tag: 'Inside', path: inside }
  }
  const id = link(reference)
  return id === undefined ? { _tag: 'Broken' } : { _tag: 'Linked', id }
}

/** A Tile planned whole, each Reference below it resolved. */
function resolved(draft: Draft, resolve: (reference: string) => ReferenceTarget): PlannedTile {
  const map = <K extends number, A, B>(record: Partial<Record<K, A>>, each: (value: A) => B) =>
    Object.fromEntries(
      Object.entries(record).map(([slot, value]) => [slot, each(value as A)]),
    ) as Partial<Record<K, B>>
  return {
    ...draft,
    branches: map(draft.branches, (branch) => resolved(branch, resolve)),
    context: map(draft.context, (held) =>
      held._tag === 'Reference'
        ? { ...held, target: resolve(held.target) }
        : resolved(held, resolve),
    ),
  }
}

/**
 * The import plan for these files: a folder read as the shape reads a vault, its root a Tile, or one
 * file alone, a Leaf; with what was skipped and why. `ImportRefused` with every fault when anything in
 * them is wrong. A `reference: "[[path]]"` points at the Tile read from that file of the import; any
 * other at the Tile `link` reads it as, else at nothing; the `id`s the files carry are ignored.
 */
export function importOf(
  source: ImportSource,
  link: IdOfLink,
): Result.Result<ImportPlan, ImportRefused> {
  const reading: Reading = { faults: [], skipped: [], linkable: new Map() }
  const root = rootOf(source, reading)
  const [first, ...rest] = reading.faults
  if (first !== undefined) {
    return Result.fail(new ImportRefused({ fields: ['files'], faults: [first, ...rest] }))
  }
  if (root === undefined) {
    return Result.fail(
      new ImportRefused({
        fields: ['files'],
        faults: [
          { path: source._tag === 'File' ? source.file.path : '', fault: 'NothingToImport' },
        ],
      }),
    )
  }
  const resolve = (reference: string) => targetOf(reference, { linkable: reading.linkable, link })
  return Result.succeed({
    root: root._tag === 'Leaf' ? root : resolved(root, resolve),
    skipped: reading.skipped,
  })
}

/** The root an import reads: a folder's Tile, or a file's Leaf; nothing for a file a System can't hold. */
function rootOf(source: ImportSource, reading: Reading): Draft | PlannedLeaf | undefined {
  if (source._tag === 'Folder') {
    const at = {
      path: '',
      name: source.name,
      kind: 'branch',
      naming: defaultNaming,
      depth: 0,
    } as const
    const root = folderOf(treeOf(source.files), at, reading)
    return root?._tag === 'Tile' ? root : undefined
  }
  const { path, bytes } = source.file
  const [text] = textsIn(
    { files: new Map([[path, bytes]]), folders: new Map() },
    { path: '', files: [path] },
    reading,
  ).values()
  return text === undefined ? undefined : leafOf({ path, name: path }, text, reading)
}
