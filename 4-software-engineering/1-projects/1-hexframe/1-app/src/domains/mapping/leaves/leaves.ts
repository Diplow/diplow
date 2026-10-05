// What a Leaf may hold: nothing. A Leaf is one file, a Title, a Preview and a Body with nothing below
// it and no Context, so Mapping refuses any change that would leave something below a Tile in a Leaf
// slot. A Leaf grows into a Branch, and a Branch with nothing below it shrinks into a Leaf, by moving
// to the other kind's slot. Pure: it decides on the rows a change locked, or on a System as a read
// finds it, which the front asks too, so it offers only what Mapping takes.
import { Effect } from 'effect'

import type { TileRow } from '#/repositories/database/tiles/tiles'

import { LeafHoldsNothing } from '../errors'
import type { SystemTile } from '../system'
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

/** What stands below a Tile of a System, each kind by its slots. */
type Below = Pick<SystemTile, 'branches' | 'leaves' | 'context'>

/**
 * Whether anything stands below the Tile of this id: a Child, a Context Tile or a Reference. The rule
 * `holdsNothing` says on a System, said on the rows a change locked: the two must agree.
 */
const holdsAnything = (rows: ReadonlyArray<TileRow>, id: string) =>
  rows.some((row) => row.parentId === id)

/**
 * Whether nothing stands below a Tile of a System: no Branch, no Leaf, no Context Tile nor Reference.
 * Only such a Branch shrinks into a Leaf.
 */
export const holdsNothing = ({ branches, leaves, context }: Below) =>
  [branches, leaves, context].every((below) => Object.keys(below).length === 0)

/**
 * Whether a System is empty, as Mapping adds it: its Root untitled, without Preview nor Body, with
 * nothing below it. Only an empty System takes an import as its Root, which replaces the Root's
 * content, so a Root that holds any, written before its name, takes none.
 */
export const isEmptySystem = (root: Below & Pick<SystemTile, 'title' | 'preview' | 'body'>) =>
  [root.title, root.preview, root.body].every((text) => text === '') && holdsNothing(root)

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
