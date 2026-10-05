// A System as a reader finds it, built from the repository's rows: the Root, then everything below
// it, each Tile with its Branches and its Leaves, its Children, and its Context; or one Tile read to a
// depth, with only the fields asked. Pure: what a row means is decided here.
import {
  type ColumnsAsked,
  contentWith,
  type TileRow,
  type TileRowWith,
} from '#/repositories/database/tiles/tiles'

import {
  type Content,
  type ContextDirection,
  type Direction,
  isContextDirection,
  isDirection,
  leafOf,
  type Tile,
} from './tile'

/** A Leaf in its System: one file's worth, a Tile with nothing below it and no Context. */
interface LeafTile extends Tile {
  readonly _tag: 'Tile'
}

/**
 * A Tile in its System: its Branches and its Leaves, its Children, each by Direction, and its Context
 * by slot. A Branch, the Root or a Context Tile alike.
 */
export interface SystemTile extends LeafTile {
  readonly branches: Partial<Record<Direction, SystemTile>>
  readonly leaves: Partial<Record<Direction, LeafTile>>
  readonly context: Partial<Record<ContextDirection, SystemTile | Reference | BrokenReference>>
}

/** A Context slot holding a link to a Tile drawn elsewhere, by its id, so it survives a move. */
interface Reference<T = Tile> {
  readonly _tag: 'Reference'
  readonly tile: T
}

/** A Reference whose Tile was deleted: shown as broken, it never blocked the delete. */
interface BrokenReference {
  readonly _tag: 'BrokenReference'
  readonly target: string
}

const tileOf = ({ id, title, preview, body }: TileRow): Tile => ({ id, title, preview, body })

/** What a walk down needs of a row: where it stands, and whether it is a Reference. */
type Placed = Pick<TileRow, 'id' | 'parentId' | 'direction' | 'target'>

/** The row of a Tile of this id, not a Reference's. */
export const tileRow = <R extends Placed>(rows: ReadonlyArray<R>, id: string) =>
  rows.find((row) => row.id === id && row.target === null)

/** The row holding this slot of that parent, a Tile's or a Reference's. */
export const rowAt = (rows: ReadonlyArray<TileRow>, parent: string, slot: number) =>
  rows.find((row) => row.parentId === parent && row.direction === slot)

/** The rows under each parent, the Root's under `null`: built once, for a walk down. */
function byParent<R extends Placed>(
  rows: ReadonlyArray<R>,
): ReadonlyMap<string | null, ReadonlyArray<R>> {
  const under = new Map<string | null, Array<R>>()
  for (const row of rows) {
    const siblings = under.get(row.parentId)
    if (siblings === undefined) under.set(row.parentId, [row])
    else siblings.push(row)
  }
  return under
}

/** The ids of a Tile and of everything below it. */
export function below(rows: ReadonlyArray<TileRow>, id: string): ReadonlySet<string> {
  const under = byParent(rows)
  const found = new Set([id])
  for (const parent of found) {
    for (const row of under.get(parent) ?? []) found.add(row.id)
  }
  return found
}

/** How a walk down makes what it finds in each slot: a Tile, a Leaf, a Reference. */
interface Makers<R, T, F, L> {
  readonly place: (row: R) => T
  readonly leaf: (row: R) => F
  readonly refer: (target: string) => L
}

/**
 * A Tile's Branches and Leaves, each by Direction, and its Context by slot, as `place`, `leaf` and
 * `refer` make them.
 */
function slotsOf<R extends Placed, T, F, L>(
  rows: ReadonlyArray<R>,
  { place, leaf, refer }: Makers<R, T, F, L>,
) {
  const branches: Partial<Record<Direction, T>> = {}
  const leaves: Partial<Record<Direction, F>> = {}
  const context: Partial<Record<ContextDirection, T | L>> = {}
  for (const row of rows) {
    const { direction, target } = row
    if (direction === null) continue
    const asLeaf = leafOf(direction)
    if (isDirection(direction)) branches[direction] = place(row)
    else if (asLeaf !== undefined) leaves[asLeaf] = leaf(row)
    else if (isContextDirection(direction)) {
      context[direction] = target === null ? place(row) : refer(target)
    }
  }
  return { branches, leaves, context }
}

/** A Reference to the Tile of this row, shown as `shown` says, or a broken one when it is gone. */
function referenceTo<R extends Placed, T>(
  target: string,
  row: R | undefined,
  shown: (row: R) => T,
): Reference<T> | BrokenReference {
  return row === undefined || row.target !== null
    ? { _tag: 'BrokenReference', target }
    : { _tag: 'Reference', tile: shown(row) }
}

/** The System these rows hold, from its Root down; `undefined` when they hold no Root. */
export function systemOf(rows: ReadonlyArray<TileRow>): SystemTile | undefined {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const under = byParent(rows)

  const refer = (target: string) => referenceTo(target, byId.get(target), tileOf)

  const leaf = (row: TileRow): LeafTile => ({ _tag: 'Tile', ...tileOf(row) })

  const place = (row: TileRow): SystemTile => ({
    ...leaf(row),
    ...slotsOf(under.get(row.id) ?? [], { place, leaf, refer }),
  })

  const root = under.get(null)?.[0]
  return root === undefined ? undefined : place(root)
}

/** What a read may ask of each Tile: its Title, its Preview, its Body. */
export const fields = ['title', 'preview', 'body'] as const satisfies ReadonlyArray<keyof Content>
export type Field = (typeof fields)[number]

/** How many generations below the Tile it opens a read goes: 0 for the Tile alone, at most 3. */
export const depths = [0, 1, 2, 3] as const
export type Depth = (typeof depths)[number]

/** What a read asks of the Tile it opens, and of each Tile below it. */
export type FieldsAsked<O extends Field, F extends Field> = ColumnsAsked<O, F>

/** A Tile a Reference points at, as a read shows it: what a reader needs to decide to open it. */
type Glimpse = Pick<Tile, 'id' | 'title' | 'preview'>

/** A Leaf as a read finds it: its id and only the fields asked, and never anything below it. */
type ReadLeaf<F extends Field> = Pick<Tile, 'id'> &
  Pick<Content, F> & {
    readonly _tag: 'Tile'
  }

/**
 * A Tile as a read to a depth finds it: its id and only the fields asked. Above the depth's last
 * generation it holds its Branches, its Leaves and its Context; at the last one, where the read
 * stopped, none of them.
 */
export type ReadTile<F extends Field> = ReadLeaf<F> & {
  readonly branches?: Partial<Record<Direction, ReadTile<F>>>
  readonly leaves?: Partial<Record<Direction, ReadLeaf<F>>>
  readonly context?: Partial<
    Record<ContextDirection, ReadTile<F> | Reference<Glimpse> | BrokenReference>
  >
}

/**
 * What a read from one Tile finds, before it is shaped: the Tile's row and the rows below it, each with
 * the fields asked of it, the rows of the Tiles their References point at, and its parent, by id and
 * Title.
 */
export interface Found<O extends Field, F extends Field> {
  readonly opened: TileRowWith<O>
  readonly rows: ReadonlyArray<TileRowWith<F>>
  readonly pointedAt: ReadonlyArray<TileRowWith<'title' | 'preview'>>
  readonly parent: Pick<Tile, 'id' | 'title'> | null
}

/** A row read with some fields, showing only these of them. */
export const showing = <U extends Field, F extends U>(
  row: TileRowWith<U>,
  fields: ReadonlyArray<F>,
): TileRowWith<F> => ({ ...row, content: contentWith(row.content, fields) })

/**
 * The Tile of this row read `depth` generations down, from the rows reached below it and the rows of
 * the Tiles their References point at.
 */
export function readOf<F extends Field>(
  opened: TileRowWith<F>,
  {
    rows,
    depth,
    pointedAt,
  }: {
    rows: ReadonlyArray<TileRowWith<F>>
    depth: Depth
    pointedAt: ReadonlyArray<TileRowWith<'title' | 'preview'>>
  },
): ReadTile<F> {
  const targets = new Map(pointedAt.map((row) => [row.id, row]))
  const under = byParent(rows)

  const refer = (target: string) =>
    referenceTo(target, targets.get(target), (row) => ({ id: row.id, ...row.content }))

  const leaf = (row: TileRowWith<F>): ReadLeaf<F> => ({ _tag: 'Tile', id: row.id, ...row.content })

  const place = (row: TileRowWith<F>, generation: number): ReadTile<F> => {
    const tile = leaf(row)
    if (generation === depth) return tile
    const next = (below: TileRowWith<F>) => place(below, generation + 1)
    return { ...tile, ...slotsOf(under.get(row.id) ?? [], { place: next, leaf, refer }) }
  }

  return place(opened, 0)
}
