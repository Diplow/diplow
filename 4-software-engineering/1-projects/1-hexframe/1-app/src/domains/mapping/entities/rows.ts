// The rows a System is read from, as Mapping reads them. Mapping declares the shapes it reads, and the
// tiles repository's rows satisfy them structurally, so nothing here imports the repository and the
// front may read a System by the same types (`entities/index.ts`). Everything in `entities/` takes
// these; only the application service and `landing/`, which call the repository, name its `TileRow`,
// whose rows they pass on as `Row`s. Pure.
import type { Content } from './tile'

/** What a row's `config` holds: a folder's naming, either part of it left out when not set. */
export interface StoredConfig {
  readonly fileName?: string | undefined
  readonly folderPattern?: string | undefined
}

/** What a row's `frontmatter` holds: the keys an imported file carried, each a scalar. */
type StoredFrontmatter = Readonly<Record<string, string | number | boolean>>

/**
 * One row of a System. A Root has no parent and no direction; a row with a `target` is a Reference to
 * the row of that id. `name`, `config` and `frontmatter` are what an imported file carried, null when
 * it carried nothing.
 */
export interface Row extends Content {
  readonly id: string
  readonly parentId: string | null
  readonly direction: number | null
  readonly target: string | null
  readonly name: string | null
  readonly config: StoredConfig | null
  readonly frontmatter: StoredFrontmatter | null
}

/** The parts of a row keeping what an imported file carried: null when it carried nothing. */
export type KeptPart = 'name' | 'config' | 'frontmatter'

/**
 * A row as a read from one Tile finds it: where it stands, whether it is a Reference, and, apart, only
 * the fields of its content asked. The repository selects such a row flat (`TileRowWith`), and
 * `withContent` nests it here, as it nests one of Help's notes.
 */
export interface RowWith<F extends keyof Content> {
  readonly id: string
  readonly parentId: string | null
  readonly direction: number | null
  readonly target: string | null
  readonly content: Pick<Content, F>
}

/**
 * What a read from one Tile asks of it, and of each Tile below it: the repository's `ColumnsAsked`
 * seen from Mapping, which a repository, importing no domain, declares again.
 */
export interface FieldsAsked<O extends keyof Content, F extends keyof Content> {
  readonly opened: ReadonlyArray<O>
  readonly below: ReadonlyArray<F>
}

/**
 * These fields of what a Tile says, and no other: the one projection a read from one Tile makes, on the
 * rows the tiles repository reads as on those Help's notes give.
 */
export function contentWith<F extends keyof Content>(
  content: Partial<Content>,
  fields: ReadonlyArray<F>,
): Pick<Content, F> {
  // Built from the fields asked, each of them read, which a type cannot follow.
  return Object.fromEntries(fields.map((field) => [field, content[field]])) as Pick<Content, F>
}

/** A row with only the fields asked of its content, apart from where it stands. */
export const withContent = <F extends keyof Content>(
  {
    id,
    parentId,
    direction,
    target,
    ...content
  }: Omit<Row, keyof Content | KeptPart> & Partial<Content>,
  fields: ReadonlyArray<F>,
): RowWith<F> => ({ id, parentId, direction, target, content: contentWith(content, fields) })
