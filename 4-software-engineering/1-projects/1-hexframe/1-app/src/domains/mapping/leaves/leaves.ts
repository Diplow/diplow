// What a Leaf may hold: nothing. A Leaf is one file, a Title, a Preview and a Body with nothing below
// it and no Context, so Mapping refuses any change that would leave something below a Tile in a Leaf
// slot. A Leaf grows into a Branch, and a Branch with nothing below it shrinks into a Leaf, by moving
// to the other kind's slot. Pure: it decides on the rows a change locked.
import { Effect } from 'effect'

import type { TileRow } from '#/repositories/database/tiles/tiles'

import { LeafHoldsNothing } from '../errors'
import { leafOf } from '../tile'

/** Whether a row stands in a Leaf slot. */
const isLeaf = (row: Pick<TileRow, 'direction'>) => leafOf(row.direction) !== undefined

/** Whether anything stands below the Tile of this id: a Child, a Context Tile or a Reference. */
const holdsAnything = (rows: ReadonlyArray<TileRow>, id: string) =>
  rows.some((row) => row.parentId === id)

/** Refuses to put anything under this Tile when it is a Leaf: nothing is created nor moved below one. */
export const notLeaf = (parent: TileRow) =>
  isLeaf(parent) ? Effect.fail(new LeafHoldsNothing()) : Effect.succeed(parent)

/**
 * Refuses to put the Tile of this id in a slot of this row direction when the slot is a Leaf's and the
 * Tile holds anything: it moves to a Branch slot first, or what it holds moves out.
 */
export const fitsIn = (rows: ReadonlyArray<TileRow>, id: string, direction: number | null) =>
  leafOf(direction) !== undefined && holdsAnything(rows, id)
    ? Effect.fail(new LeafHoldsNothing())
    : Effect.void
