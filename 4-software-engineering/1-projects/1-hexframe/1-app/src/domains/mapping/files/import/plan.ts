// What an import reads and what it plans: the files it is handed, and the tree of Tiles it would create
// from them, in Mapping's own words, each with what it keeps from its file; the shape's never reach it.
// Landing a plan in a System is another step's (`hexframe-app-import-export/decisions.md#DEC-10`).
import type { ToKeep } from '../../kept/kept'
import type { Content, ContextDirection, Direction } from '../../tile'

/** One file handed to an import: its path from the import's root, `/` between folders, and its bytes. */
export interface ImportFile {
  readonly path: string
  readonly bytes: Uint8Array
}

/**
 * What an import reads: a folder, by its name and its files, which a zip or a picked folder hands
 * over; or one file alone, named by its path, which only a Leaf slot takes.
 */
export type ImportSource =
  | { readonly _tag: 'Folder'; readonly name: string; readonly files: ReadonlyArray<ImportFile> }
  | { readonly _tag: 'File'; readonly file: ImportFile }

/**
 * The id of the Tile an app link points at, `/?center=<id>`, or `undefined` for anything else: built by
 * whoever calls the import, which knows the routes and the host, never by Mapping.
 */
export type IdOfLink = (link: string) => string | undefined

/**
 * What a Reference of an import points at: a Tile of the same import, by its path; a Tile of the app,
 * by its id, which only a Tile of the importer's own System answers, checked as it lands; or nothing.
 */
export type ReferenceTarget =
  | { readonly _tag: 'Inside'; readonly path: string }
  | { readonly _tag: 'Linked'; readonly id: string }
  | { readonly _tag: 'Broken' }

/**
 * What an import plans for one Tile: its content and what it keeps, and the path it was read from, from
 * the import's root (`''` the root itself), which names it in a fault and as a Reference's target.
 */
interface Planned extends Content, ToKeep {
  readonly path: string
}

/** A Leaf an import creates: one file's worth. */
export interface PlannedLeaf extends Planned {
  readonly _tag: 'Leaf'
}

/** A Reference an import creates in a Context slot, as `T` names its target. */
export interface PlannedReference<T = ReferenceTarget> {
  readonly _tag: 'Reference'
  readonly path: string
  readonly target: T
}

/** A Tile an import creates, with its Branches and Leaves by Direction and its Context by slot. */
export interface PlannedTile<T = ReferenceTarget> extends Planned {
  readonly _tag: 'Tile'
  readonly branches: Partial<Record<Direction, PlannedTile<T>>>
  readonly leaves: Partial<Record<Direction, PlannedLeaf>>
  readonly context: Partial<Record<ContextDirection, PlannedTile<T> | PlannedReference<T>>>
}

/**
 * A file an import leaves out, and why: a System can't hold a binary nor a dot file, and a folder's
 * own file shadows the shape's others beside it (`-CLAUDE.md` beside `CLAUDE.md`), which the shape
 * reads as neither its Tile nor a Leaf.
 */
export interface Skipped {
  readonly path: string
  readonly reason: 'Binary' | 'DotFile' | 'Shadowed'
}

/** What an import would create, its root a Tile, or a Leaf for a file alone, and what it skipped. */
export interface ImportPlan {
  readonly root: PlannedTile | PlannedLeaf
  readonly skipped: ReadonlyArray<Skipped>
}
