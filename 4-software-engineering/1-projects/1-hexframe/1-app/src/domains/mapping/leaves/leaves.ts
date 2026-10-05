// What a Leaf may hold: nothing. A Leaf is one file, a Title, a Preview and a Body with nothing below
// it and no Context, so Mapping refuses any change that would leave something below a Tile in a Leaf
// slot. A Leaf grows into a Branch, and a Branch with nothing below it shrinks into a Leaf, by moving
// to the other kind's slot. Pure: it decides on the rows a change locked.
import { Effect } from 'effect'

import type { TileRow } from '#/repositories/database/tiles/tiles'

import { LeafHoldsNothing } from '../errors'
import { type Slot, leafOf } from '../tile'

/** Whether a row stands in a Leaf slot. */
const isLeaf = (row: Pick<TileRow, 'direction'>) => leafOf(row.direction) !== undefined

/**
 * Refuses a Tile planned with anything below it into a Leaf slot: an import lands there only one file
 * alone, its plan a Leaf.
 */
export const onlyALeafIn = (slot: Slot, planned: { readonly _tag: 'Tile' | 'Leaf' }) =>
  typeof slot !== 'number' && planned._tag !== 'Leaf'
    ? Effect.fail(new LeafHoldsNothing())
    : Effect.void

/** Whether anything stands below the Tile of this id: a Child, a Context Tile or a Reference. */
const holdsAnything = (rows: ReadonlyArray<TileRow>, id: string) =>
  rows.some((row) => row.parentId === id)

/** Refuses to put anything under this Tile when it is a Leaf: nothing is created nor moved below one. */
export const notLeaf = (parent: TileRow) =>
  isLeaf(parent) ? Effect.fail(new LeafHoldsNothing()) : Effect.succeed(parent)

/**
 * Refuses to put the Tile of this id in the slot a row direction names when the slot is a Leaf's and
 * the Tile holds anything: what it holds moves out first, or it takes a Branch slot instead.
 */
export const holdsNothingIfLeaf = (
  rows: ReadonlyArray<TileRow>,
  id: string,
  direction: TileRow['direction'],
) =>
  isLeaf({ direction }) && holdsAnything(rows, id)
    ? Effect.fail(new LeafHoldsNothing())
    : Effect.void
