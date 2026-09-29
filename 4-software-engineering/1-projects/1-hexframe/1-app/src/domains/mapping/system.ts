// A System as a reader finds it, built from the repository's rows: the Root, then everything below
// it, each Tile with its Children and its Context. Pure: what a row means is decided here.
import type { TileRow } from '#/repositories/database/tiles/tiles'

import {
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
export interface Reference {
  readonly _tag: 'Reference'
  readonly tile: Tile
}

/** A Reference whose Tile was deleted: shown as broken, it never blocked the delete. */
export interface BrokenReference {
  readonly _tag: 'BrokenReference'
  readonly target: string
}

const tileOf = ({ id, title, preview, body }: TileRow): Tile => ({ id, title, preview, body })

/** The row of a Tile of this id, not a Reference's. */
export const tileRow = (rows: ReadonlyArray<TileRow>, id: string) =>
  rows.find((row) => row.id === id && row.target === null)

/** The row holding this slot of that parent, a Tile's or a Reference's. */
export const rowAt = (rows: ReadonlyArray<TileRow>, parent: string, slot: number) =>
  rows.find((row) => row.parentId === parent && row.direction === slot)

/** The ids of a Tile and of everything below it. */
export function below(rows: ReadonlyArray<TileRow>, id: string): ReadonlySet<string> {
  const found = new Set([id])
  for (const parent of found) {
    for (const row of rows) if (row.parentId === parent) found.add(row.id)
  }
  return found
}

/** The System these rows hold, from its Root down; `undefined` when they hold no Root. */
export function systemOf(rows: ReadonlyArray<TileRow>): SystemTile | undefined {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const under = new Map<string | null, Array<TileRow>>()
  for (const row of rows) under.set(row.parentId, [...(under.get(row.parentId) ?? []), row])

  const referenceTo = (target: string): Reference | BrokenReference => {
    const row = byId.get(target)
    return row === undefined || row.target !== null
      ? { _tag: 'BrokenReference', target }
      : { _tag: 'Reference', tile: tileOf(row) }
  }

  const place = (row: TileRow): SystemTile => {
    const children: Partial<Record<Direction, SystemTile>> = {}
    const context: SystemTile['context'] = {}
    for (const slot of under.get(row.id) ?? []) {
      const { direction, target } = slot
      if (direction === null) continue
      if (isDirection(direction)) children[direction] = place(slot)
      else if (isContextDirection(direction)) {
        context[direction] = target === null ? place(slot) : referenceTo(target)
      }
    }
    return { _tag: 'Tile', ...tileOf(row), children, context }
  }

  const root = under.get(null)?.[0]
  return root === undefined ? undefined : place(root)
}
