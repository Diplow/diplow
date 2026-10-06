// What a Leaf may hold: nothing. A Leaf is one file, a Title, a Preview and a Body with nothing below
// it and no Context, so Mapping refuses any change that would leave something below a Tile in a Leaf
// slot. A Leaf grows into a Branch, and a Branch with nothing below it shrinks into a Leaf, by moving
// to the other kind's slot. Pure: it decides on a System, flat, as a change does (`decide`), or as its
// tree, as a read finds it, which the front asks too, so it offers only what Mapping takes.
import { Result } from 'effect'

import { LeafHoldsNothing } from '../../errors'
import type { FoundTile, PlacedTile, System, SystemTile } from '../system'
import { isLeafSlot, type Slot } from '../tile'

/**
 * Refuses a Tile planned with anything below it into a Leaf slot: an import lands there only one file
 * alone, its plan a Leaf.
 */
export const onlyALeafIn = (
  slot: Slot,
  planned: { readonly _tag: 'Tile' | 'Leaf' },
): Result.Result<void, LeafHoldsNothing> =>
  isLeafSlot(slot) && planned._tag !== 'Leaf' ? Result.fail(new LeafHoldsNothing()) : Result.void

/** What stands below a Tile of a System, each kind by its slots. */
type Below = Pick<SystemTile, 'branches' | 'leaves' | 'context'>

/**
 * Whether anything stands below the Tile of this id: a Child, a Context Tile or a Reference. The rule
 * `holdsNothing` says on a System's tree, said on the flat System a change decides on: the two must
 * agree.
 */
const holdsAnything = ({ tiles }: System, id: string) =>
  Object.values(tiles).some((held) => held.parent === id)

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

/**
 * Refuses to put anything under this Tile of a System when it is a Leaf, a Tile in a Leaf slot: nothing
 * is created nor moved below one. The Root, which stands in no slot, never is.
 */
export const notLeaf = <T extends FoundTile | PlacedTile>(
  parent: T,
): Result.Result<T, LeafHoldsNothing> =>
  'slot' in parent && isLeafSlot(parent.slot)
    ? Result.fail(new LeafHoldsNothing())
    : Result.succeed(parent)

/**
 * Refuses to put the Tile of this id in `slot` when the slot is a Leaf's and the Tile holds anything:
 * what it holds moves out first, or it takes a Branch slot instead.
 */
export const holdsNothingIfLeaf = (
  system: System,
  id: string,
  slot: Slot,
): Result.Result<void, LeafHoldsNothing> =>
  isLeafSlot(slot) && holdsAnything(system, id) ? Result.fail(new LeafHoldsNothing()) : Result.void
