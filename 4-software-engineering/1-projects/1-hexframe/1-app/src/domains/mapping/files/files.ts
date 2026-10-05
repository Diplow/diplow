// A Tile and everything below it, written as the files of a vault folder, the shape a System exports
// to: a folder per Branch and per Context Tile holding the Tile's file, a file per Leaf, a Context
// folder per Reference, and a `.hexframe/config.yaml` where a Tile sets its own naming. Mapping decides
// the files; zipping them is a repository's errand, and handing them to another domain the API
// layer's. Pure.
import type { Naming } from '../kept/kept'
import { defaultNaming, inherited } from '../kept/naming'
import type { BrokenReference, LeafTile, Reference, SystemTile } from '../system'
import type { ContextDirection, Direction } from '../tile'
import { type Fields, markdownOf, yamlOf } from './frontmatter'
import { type EntryKind, type ToName, isVerbatim, namesIn } from './names'

/** One file of an export: its path from the export's root, and its text. */
export interface File {
  readonly path: string
  readonly content: string
}

/**
 * Where a Tile is read in the app, by its id: built by whoever calls the export, which knows the
 * routes and the host, never by Mapping.
 */
export type LinkOf = (id: string) => string

/** What a Context slot holds: a Tile of its own or a Reference. */
type Held = SystemTile['context'][ContextDirection]

/** What an export writes for one slot of a folder, under the name the folder gives it. */
type Entry =
  | { readonly _tag: 'Folder'; readonly tile: SystemTile }
  | { readonly _tag: 'Leaf'; readonly tile: LeafTile }
  | { readonly _tag: 'Reference'; readonly held: Reference | BrokenReference }

/** A folder's entries with what names them: its Branches, its Leaves, its Context. */
function entriesOf(tile: SystemTile): ReadonlyArray<readonly [Entry, ToName]> {
  const slots = <T>(record: Partial<Record<number, T>>) =>
    Object.entries(record).flatMap(([slot, held]) =>
      held === undefined ? [] : [[Math.abs(Number(slot)) as Direction, held] as const],
    )
  const folder = (kind: EntryKind, tile: SystemTile, direction: Direction) =>
    [
      { _tag: 'Folder', tile },
      { kind, direction, title: tile.title, name: tile.name },
    ] as const
  return [
    ...slots(tile.branches).map(([direction, branch]) => folder('branch', branch, direction)),
    ...slots(tile.leaves).map(
      ([direction, leaf]) =>
        [
          { _tag: 'Leaf', tile: leaf },
          {
            kind: 'leaf',
            direction,
            title: leaf.title,
            name: leaf.name,
            verbatim: isVerbatim(leaf),
          },
        ] as const,
    ),
    ...slots<NonNullable<Held>>(tile.context).map(([direction, held]) =>
      held._tag === 'Tile'
        ? folder('context', held, direction)
        : ([
            { _tag: 'Reference', held },
            { kind: 'context', direction, title: titleOf(held) },
          ] as const),
    ),
  ]
}

/** The Title a Reference's file carries: its Tile's, or `broken` when its Tile is gone. */
const titleOf = (held: Reference | BrokenReference) =>
  held._tag === 'Reference' ? held.tile.title : 'broken'

/** A path from the export's root: `''` is the root itself. */
const join = (folder: string, name: string) => (folder === '' ? name : `${folder}/${name}`)

/** What a file's `parent` says: the folder it hangs in, from the export's root, `.` at the root. */
const parentOf = (folder: string) => (folder === '' ? '.' : folder)

/** A Markdown file's path as a `[[wikilink]]` writes it, its `.md` dropped. */
const linked = (path: string) => path.replace(/\.md$/i, '')

/** What an export writes for one Tile, placed: a folder with its file, or a Leaf's file. */
type Placed =
  | {
      readonly _tag: 'Folder'
      readonly tile: SystemTile
      readonly folder: string
      readonly naming: Naming
      /** What its `.hexframe/config.yaml` holds, when it writes one. */
      readonly config: Fields | undefined
    }
  | {
      readonly _tag: 'Leaf'
      readonly tile: LeafTile
      readonly folder: string
      readonly name: string
    }
  | {
      readonly _tag: 'Reference'
      readonly held: Reference | BrokenReference
      readonly folder: string
      readonly fileName: string
    }

/**
 * Everything an export writes from a folder down: the folder's own Tile, then, under the names the
 * naming in force gives them, its Branches, Context Tiles and References, each a folder of its own,
 * and its Leaves.
 */
function placed(tile: SystemTile, folder: string, naming: Naming): ReadonlyArray<Placed> {
  const entries = entriesOf(tile)
  const names = namesIn(
    entries.map(([, toName]) => toName),
    naming,
  )
  const below = entries.flatMap(([entry], index): ReadonlyArray<Placed> => {
    const name = names[index] ?? ''
    if (entry._tag === 'Leaf') return [{ _tag: 'Leaf', tile: entry.tile, folder, name }]
    const path = join(folder, name)
    if (entry._tag === 'Reference') {
      return [{ _tag: 'Reference', held: entry.held, folder: path, fileName: naming.fileName }]
    }
    return placed(entry.tile, path, inherited(naming, entry.tile))
  })
  const config = tile.config === undefined ? undefined : partsOf(tile.config)
  return [{ _tag: 'Folder', tile, folder, naming, config }, ...below]
}

/** The parts a Tile config sets, as its file writes them. */
const partsOf = (config: NonNullable<SystemTile['config']>): Fields =>
  Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))

/** The path a `[[wikilink]]` reaches a placed Tile by, by its id: its file's. */
function linksOf(all: ReadonlyArray<Placed>): ReadonlyMap<string, string> {
  return new Map(
    all.flatMap((written): ReadonlyArray<readonly [string, string]> => {
      if (written._tag === 'Reference') return []
      const path =
        written._tag === 'Folder'
          ? join(written.folder, written.naming.fileName)
          : join(written.folder, written.name)
      return [[written.tile.id, linked(path)]]
    }),
  )
}

/** The fields every Tile's file opens with, then what it kept from its own file, in its order. */
function fieldsOf(tile: LeafTile, folder: string): Fields {
  const own = { id: tile.id, title: tile.title, parent: parentOf(folder), preview: tile.preview }
  const kept = Object.entries(tile.frontmatter ?? {}).filter(([key]) => !Object.hasOwn(own, key))
  return { ...own, ...Object.fromEntries(kept) }
}

/** The files one placed Tile writes, its References resolved against what the export holds. */
function filesOf(
  written: Placed,
  { links, link }: { links: ReadonlyMap<string, string>; link: LinkOf },
): ReadonlyArray<File> {
  if (written._tag === 'Leaf') {
    const { tile, folder, name } = written
    const content = isVerbatim(tile) ? tile.body : markdownOf(fieldsOf(tile, folder), tile.body)
    return [{ path: join(folder, name), content }]
  }
  if (written._tag === 'Reference') {
    const { held, folder, fileName } = written
    const target = held._tag === 'Reference' ? held.tile.id : held.target
    const inside = held._tag === 'Reference' ? links.get(target) : undefined
    const fields = {
      title: titleOf(held),
      parent: parentOf(folder),
      preview: held._tag === 'Reference' ? held.tile.preview : '',
      reference: inside === undefined ? link(target) : `[[${inside}]]`,
    }
    return [{ path: join(folder, fileName), content: markdownOf(fields, '') }]
  }
  const { tile, folder, naming, config } = written
  const file = markdownOf(fieldsOf(tile, folder), tile.body)
  const own = { path: join(folder, naming.fileName), content: file }
  return config === undefined
    ? [own]
    : [own, { path: join(folder, '.hexframe/config.yaml'), content: yamlOf(config) }]
}

/** Where the Tile of an id stands in a System: a folder with the naming in force at it, or a Leaf. */
type Found =
  | { readonly _tag: 'Folder'; readonly tile: SystemTile; readonly naming: Naming }
  | { readonly _tag: 'Leaf'; readonly tile: LeafTile; readonly name: string }

/** The Tile of this id at or below `tile`, the naming above it being `above`. */
function find(tile: SystemTile, id: string, above: Naming): Found | undefined {
  const naming = inherited(above, tile)
  if (tile.id === id) return { _tag: 'Folder', tile, naming }
  const entries = entriesOf(tile)
  const index = entries.findIndex(([entry]) => entry._tag === 'Leaf' && entry.tile.id === id)
  const leaf = entries[index]?.[0]
  if (leaf?._tag === 'Leaf') {
    const names = namesIn(
      entries.map(([, toName]) => toName),
      naming,
    )
    return { _tag: 'Leaf', tile: leaf.tile, name: names[index] ?? '' }
  }
  for (const [entry] of entries) {
    const found = entry._tag === 'Folder' ? find(entry.tile, id, naming) : undefined
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * The config an export's root folder writes: every part of the naming in force there that isn't the
 * default, inherited or its own, so the files read back named as they were written; none when the
 * defaults hold.
 */
function rootConfig({ tile, naming }: { tile: SystemTile; naming: Naming }): Fields | undefined {
  const parts = partsOf({
    ...Object.fromEntries(
      Object.entries(naming).filter(
        ([part, value]) => value !== defaultNaming[part as keyof Naming],
      ),
    ),
    ...tile.config,
  })
  return Object.keys(parts).length === 0 ? undefined : parts
}

/**
 * The files the export of the Tile of this id holds, it and everything below it, from the System's
 * Root down; `undefined` when the System holds no Tile of this id. The Tile's own file sits at the
 * export's root, or, for a Leaf, is the export's one file. A Reference whose Tile is exported too
 * links it by its path, `[[1-a/CLAUDE]]`; any other, broken ones included, by `link`. Throws, a
 * defect, rather than write a name that isn't one path segment.
 */
export function exportOf(
  system: SystemTile,
  id: string,
  link: LinkOf,
): ReadonlyArray<File> | undefined {
  const found = find(system, id, defaultNaming)
  if (found === undefined) return undefined
  if (found._tag === 'Leaf') {
    return filesOf({ ...found, folder: '' }, { links: new Map(), link })
  }
  const [root, ...below] = placed(found.tile, '', found.naming)
  const all = root === undefined ? below : [{ ...root, config: rootConfig(found) }, ...below]
  const links = linksOf(all)
  return all.flatMap((written) => filesOf(written, { links, link }))
}
