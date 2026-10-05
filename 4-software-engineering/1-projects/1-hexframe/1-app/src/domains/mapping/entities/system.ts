// A System, Mapping's aggregate, flat: its Root and every Tile and Reference below it by id, each where
// it stands, and whether an Account owns it, built from the repository's rows. Its tree, the Root with
// everything below it, is a view built from it, for drawing and for writing a Tile as files. Or one
// Tile read to a depth, with only the fields asked. Pure: what a row means is decided here.
import { Struct } from 'effect'

import { type Kept, keptOf } from './kept/kept'
import { contentWith, type Row, type RowWith } from './rows'
import {
  type Content,
  type ContextDirection,
  type Direction,
  isContextSlot,
  isLeafSlot,
  type Slot,
  slotOf,
  type Tile,
} from './tile'

/**
 * A Tile as its System holds it, before where it stands and what stands below it, with what it keeps
 * from the files it was imported from: its Name, its Tile config and its Frontmatter, each when it has
 * one.
 */
interface FoundTile extends Tile, Kept {
  readonly _tag: 'Tile'
}

/** Where a Tile or a Reference stands in its System: under its parent, in one of its slots. */
interface Standing {
  readonly parent: string
  readonly slot: Slot
}

/** A Tile of a System below its Root, where it stands: a Branch, a Leaf or a Context Tile. */
interface PlacedTile extends FoundTile, Standing {}

/**
 * A Reference of a System, where it stands, always a Context slot: a link to the Tile of `target`, by
 * its id, so it survives a move. It has an id of its own, and no content.
 */
interface PlacedReference extends Standing {
  readonly _tag: 'Reference'
  readonly id: string
  readonly slot: ContextDirection
  readonly target: string
}

/**
 * A System, Mapping's aggregate, flat, as a change decides on it and the client holds it: its Root,
 * the one Tile without a parent; every Tile and Reference below it by id, each with its parent and
 * its slot; and whether an Account owns it. Help, which every Account reads, is owned by none, so the
 * System alone says that nothing in it may change.
 */
export interface System {
  readonly root: FoundTile
  readonly tiles: Readonly<Record<string, PlacedTile | PlacedReference>>
  readonly owned: boolean
}

/** A Leaf in its System's tree: one file's worth, a Tile with nothing below it and no Context. */
export type LeafTile = FoundTile

/**
 * A Tile in its System's tree: its Branches and its Leaves, its Children, each by Direction, and its
 * Context by slot. A Branch, the Root or a Context Tile alike.
 */
export interface SystemTile extends FoundTile {
  readonly branches: Partial<Record<Direction, SystemTile>>
  readonly leaves: Partial<Record<Direction, LeafTile>>
  readonly context: Partial<Record<ContextDirection, SystemTile | Reference | BrokenReference>>
}

/** A Context slot holding a link to a Tile drawn elsewhere, by its id, so it survives a move. */
export interface Reference<T = Tile> {
  readonly _tag: 'Reference'
  readonly tile: T
}

/** A Reference whose Tile was deleted: shown as broken, it never blocked the delete. */
export interface BrokenReference {
  readonly _tag: 'BrokenReference'
  readonly target: string
}

const tileOf = ({ id, title, preview, body }: Tile): Tile => ({ id, title, preview, body })

/** A row's Tile, with what it keeps from its files. */
const foundOf = (row: Row): FoundTile => ({ _tag: 'Tile', ...tileOf(row), ...keptOf(row) })

/**
 * What a row below the Root holds where it stands, under `parent`: a Tile, or a Reference in a Context
 * slot; `undefined` for a row in no slot, or a Reference outside its parent's Context.
 */
function placedOf(row: Row, parent: string): PlacedTile | PlacedReference | undefined {
  const slot = slotOf(row.direction)
  if (slot === undefined) return undefined
  if (row.target === null) return { ...foundOf(row), parent, slot }
  return isContextSlot(slot)
    ? { _tag: 'Reference', id: row.id, parent, slot, target: row.target }
    : undefined
}

/**
 * The System these rows hold, owned by an Account or, Help, by none; `undefined` when they hold no
 * Root. A row the Root is not above stays in it, out of its tree's reach.
 */
export function systemFrom(
  rows: ReadonlyArray<Row>,
  { owned }: { owned: boolean },
): System | undefined {
  const root = rows.find((row) => row.parentId === null)
  if (root === undefined) return undefined
  const tiles = Object.fromEntries(
    rows.flatMap((row) => {
      const placed = row.parentId === null ? undefined : placedOf(row, row.parentId)
      return placed === undefined ? [] : [[row.id, placed] as const]
    }),
  )
  return { root: foundOf(root), tiles, owned }
}

/** What finding a Tile's row needs of a row: its id, and whether it is a Reference. */
type Walked = Pick<Row, 'id' | 'target'>

/** What stands under each parent, the Root under `null`: built once, for a walk down. */
function byParent<R>(
  items: ReadonlyArray<R>,
  parentOf: (item: R) => string | null,
): ReadonlyMap<string | null, ReadonlyArray<R>> {
  const under = new Map<string | null, Array<R>>()
  for (const item of items) {
    const parent = parentOf(item)
    const siblings = under.get(parent)
    if (siblings === undefined) under.set(parent, [item])
    else siblings.push(item)
  }
  return under
}

/** A row's parent, `null` for the Root's. */
const parentOfRow = (row: Pick<Row, 'parentId'>) => row.parentId

/** The row of a Tile of this id, not a Reference's. */
export const tileRow = <R extends Walked>(rows: ReadonlyArray<R>, id: string) =>
  rows.find((row) => row.id === id && row.target === null)

/** The row holding this slot of that parent, a Tile's or a Reference's. */
export const rowAt = (rows: ReadonlyArray<Row>, parent: string, slot: number) =>
  rows.find((row) => row.parentId === parent && row.direction === slot)

/** The ids of a Tile and of everything below it. */
export function below(rows: ReadonlyArray<Row>, id: string): ReadonlySet<string> {
  const under = byParent(rows, parentOfRow)
  const found = new Set([id])
  for (const parent of found) {
    for (const row of under.get(parent) ?? []) found.add(row.id)
  }
  return found
}

/** How a walk down makes what it finds in each slot: a Branch, a Leaf, what holds a Context slot. */
interface Makers<R, T, Leaf, Held> {
  readonly place: (item: R) => T
  readonly leaf: (item: R) => Leaf
  readonly hold: (item: R) => Held
}

/**
 * A Tile's Branches and Leaves, each by Direction, and its Context by slot, from what stands under it,
 * each in the slot `slotIn` says, as `place`, `leaf` and `hold` make them.
 */
function slotsOf<R, T, Leaf, Held>(
  items: ReadonlyArray<R>,
  slotIn: (item: R) => Slot | undefined,
  { place, leaf, hold }: Makers<R, T, Leaf, Held>,
) {
  const branches: Partial<Record<Direction, T>> = {}
  const leaves: Partial<Record<Direction, Leaf>> = {}
  const context: Partial<Record<ContextDirection, Held>> = {}
  for (const item of items) {
    const slot = slotIn(item)
    if (slot === undefined) continue
    if (isLeafSlot(slot)) leaves[slot.leaf] = leaf(item)
    else if (isContextSlot(slot)) context[slot] = hold(item)
    else branches[slot] = place(item)
  }
  return { branches, leaves, context }
}

/** A Reference to this Tile, shown as `shown` says, or a broken one when it is no Tile. */
const referenceTo = <R, T>(
  target: string,
  tile: R | undefined,
  shown: (tile: R) => T,
): Reference<T> | BrokenReference =>
  tile === undefined
    ? { _tag: 'BrokenReference', target }
    : { _tag: 'Reference', tile: shown(tile) }

/** A Tile below its System's Root, without where it stands, as its tree holds it. */
const unplaced = (tile: PlacedTile): FoundTile => Struct.omit(tile, ['parent', 'slot'])

/**
 * A System's tree: its Root with everything below it, each Tile with its Branches, its Leaves and its
 * Context, a Reference with the Tile it points at, or broken when it points at none.
 */
export function systemOf({ root, tiles }: System): SystemTile {
  const under = byParent(Object.values(tiles), (held) => held.parent)

  const tileAt = (id: string) => {
    const held = id === root.id ? root : tiles[id]
    return held?._tag === 'Tile' ? held : undefined
  }

  const refer = (target: string) => referenceTo(target, tileAt(target), tileOf)

  // A Reference stands in a Context slot only (`systemFrom`): among Branches and Leaves it is none.
  const place = (tile: FoundTile): SystemTile => ({
    ...tile,
    ...slotsOf(under.get(tile.id) ?? [], (held) => held.slot, {
      place: (held) => (held._tag === 'Tile' ? place(unplaced(held)) : undefined),
      leaf: (held) => (held._tag === 'Tile' ? unplaced(held) : undefined),
      hold: (held) => (held._tag === 'Reference' ? refer(held.target) : place(unplaced(held))),
    }),
  })

  return place(root)
}

/** What a read may ask of each Tile: its Title, its Preview, its Body. */
export const fields = ['title', 'preview', 'body'] as const satisfies ReadonlyArray<keyof Content>
export type Field = (typeof fields)[number]

/** How many generations below the Tile it opens a read goes: 0 for the Tile alone, at most 3. */
export const depths = [0, 1, 2, 3] as const
export type Depth = (typeof depths)[number]

/** A Tile a Reference points at, as a read shows it: what a reader needs to decide to open it. */
type Glimpse = Pick<Tile, 'id' | 'title' | 'preview'>

/** A Tile as a read finds it, before what stands below it: its id and only the fields asked. */
type ReadBase<F extends Field> = Pick<Tile, 'id'> &
  Pick<Content, F> & {
    readonly _tag: 'Tile'
  }

/** A Leaf as a read finds it: its id and only the fields asked, and never anything below it. */
type ReadLeaf<F extends Field> = ReadBase<F>

/**
 * A Tile as a read to a depth finds it: its id and only the fields asked. Above the depth's last
 * generation it holds its Branches, its Leaves and its Context; at the last one, where the read
 * stopped, none of them.
 */
export type ReadTile<F extends Field> = ReadBase<F> & {
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
  readonly opened: RowWith<O>
  readonly rows: ReadonlyArray<RowWith<F>>
  readonly pointedAt: ReadonlyArray<RowWith<'title' | 'preview'>>
  readonly parent: Pick<Tile, 'id' | 'title'> | null
}

/** A row read with some fields, showing only these of them. */
export const showing = <U extends Field, F extends U>(
  row: RowWith<U>,
  fields: ReadonlyArray<F>,
): RowWith<F> => ({ ...row, content: contentWith(row.content, fields) })

/**
 * The Tile of this row read `depth` generations down, from the rows reached below it and the rows of
 * the Tiles their References point at.
 */
export function readOf<F extends Field>(
  opened: RowWith<F>,
  {
    rows,
    depth,
    pointedAt,
  }: {
    rows: ReadonlyArray<RowWith<F>>
    depth: Depth
    pointedAt: ReadonlyArray<RowWith<'title' | 'preview'>>
  },
): ReadTile<F> {
  const targets = new Map(pointedAt.map((row) => [row.id, row]))
  const under = byParent(rows, parentOfRow)

  // A Reference's row points at no Tile.
  const refer = (target: string) => {
    const pointed = targets.get(target)
    return referenceTo(target, pointed?.target === null ? pointed : undefined, (row) => ({
      id: row.id,
      ...row.content,
    }))
  }

  const found = (row: RowWith<F>): ReadBase<F> => ({ _tag: 'Tile', id: row.id, ...row.content })

  const place = (row: RowWith<F>, generation: number): ReadTile<F> => {
    const tile = found(row)
    if (generation === depth) return tile
    const next = (below: RowWith<F>) => place(below, generation + 1)
    const hold = (below: RowWith<F>) => (below.target === null ? next(below) : refer(below.target))
    const slotIn = (below: RowWith<F>) => slotOf(below.direction)
    return {
      ...tile,
      ...slotsOf(under.get(row.id) ?? [], slotIn, { place: next, leaf: found, hold }),
    }
  }

  return place(opened, 0)
}
