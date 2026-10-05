// A System as a reader finds it, built from the repository's rows: the Root, then everything below
// it, each Tile with its Children and its Context; or one Tile read to a depth, with only the fields
// asked. Pure: what a row means is decided here.
import type { TileRow, TileRowWith } from '#/repositories/database/tiles/tiles'

import {
  type Content,
  type ContextDirection,
  type Direction,
  isContextDirection,
  isDirection,
  type Tile,
} from './tile'

/** A Tile in its System: its Children by Direction, its Context by slot. */
export interface SystemTile extends Tile {
  readonly _tag: 'Tile'
  readonly children: Partial<Record<Direction, SystemTile>>
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

/** A Tile's Children by Direction and its Context by slot, as `place` and `refer` make them. */
function slotsOf<R extends Placed, T, L>(
  rows: ReadonlyArray<R>,
  { place, refer }: { place: (row: R) => T; refer: (target: string) => L },
) {
  const children: Partial<Record<Direction, T>> = {}
  const context: Partial<Record<ContextDirection, T | L>> = {}
  for (const row of rows) {
    const { direction, target } = row
    if (direction === null) continue
    if (isDirection(direction)) children[direction] = place(row)
    else if (isContextDirection(direction)) {
      context[direction] = target === null ? place(row) : refer(target)
    }
  }
  return { children, context }
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

  const place = (row: TileRow): SystemTile => ({
    _tag: 'Tile',
    ...tileOf(row),
    ...slotsOf(under.get(row.id) ?? [], { place, refer }),
  })

  const root = under.get(null)?.[0]
  return root === undefined ? undefined : place(root)
}

/** What a read may ask of each Tile: its Title, its Preview, its Body. */
export type Field = keyof Content

/** How many generations below the Tile it opens a read goes: 0 for the Tile alone, at most 3. */
export type Depth = 0 | 1 | 2 | 3

/** A Tile a Reference points at, as a read shows it: what a reader needs to decide to open it. */
type Glimpse = Pick<Tile, 'id' | 'title' | 'preview'>

/**
 * A Tile as a read to a depth finds it: its id and only the fields asked. Above the depth's last
 * generation it holds its Children and its Context; at the last one, where the read stopped, neither.
 */
export type ReadTile<F extends Field> = Pick<Tile, 'id'> &
  Pick<Content, F> & {
    readonly _tag: 'Tile'
    readonly children?: Partial<Record<Direction, ReadTile<F>>>
    readonly context?: Partial<
      Record<ContextDirection, ReadTile<F> | Reference<Glimpse> | BrokenReference>
    >
  }

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

  const place = (row: TileRowWith<F>, generation: number): ReadTile<F> => {
    const tile = { _tag: 'Tile' as const, id: row.id, ...row.content }
    if (generation === depth) return tile
    const next = (below: TileRowWith<F>) => place(below, generation + 1)
    return { ...tile, ...slotsOf(under.get(row.id) ?? [], { place: next, refer }) }
  }

  return place(opened, 0)
}
