// Mapping's errors, in its language, each with the kind the client routes it by (src/domains/kind.ts).
import { Schema } from 'effect'

import { invalid, kind } from '../kind'

/** No Tile of this id in the Account's System: it was deleted, or it is someone else's. */
export class TileNotFound extends Schema.TaggedError<TileNotFound>()('TileNotFound', {
  kind: kind('NotFound'),
}) {}

/** A Tile's Title is empty. */
export class TitleMissing extends Schema.TaggedError<TitleMissing>()('TitleMissing', invalid) {}

/** A Tile's Preview is longer than a reader needs to decide whether to open it: 350 characters. */
export class PreviewTooLong extends Schema.TaggedError<PreviewTooLong>()(
  'PreviewTooLong',
  invalid,
) {}

/**
 * A name a Tile keeps or a Tile config sets isn't one path segment: it is `.` or `..`, holds a `/`, a
 * `\` or a control character, or runs over 255 bytes; or a folder pattern fills in nothing, or a
 * Tile config sets no part at all. Named on the field at fault, `name` or `config`.
 */
export class NameInvalid extends Schema.TaggedError<NameInvalid>()('NameInvalid', invalid) {}

/**
 * The slot, a Branch's or a Leaf's Direction or a Context slot, already holds a Tile or a Reference. A
 * seventh Branch or a seventh Leaf is refused this way: the user regroups some Children under a new
 * one, by moving them.
 */
export class DirectionTaken extends Schema.TaggedError<DirectionTaken>()('DirectionTaken', {
  kind: kind('Conflict'),
}) {}

/** The Root is the user: it can be neither moved nor deleted. */
export class RootFixed extends Schema.TaggedError<RootFixed>()('RootFixed', {
  kind: kind('Forbidden'),
}) {}

/**
 * A Tile cannot move below itself: under one of its own Children, or theirs. Nor can it swap with a
 * Tile above or below it, which would put one of the two below itself.
 */
export class MovedUnderItself extends Schema.TaggedError<MovedUnderItself>()('MovedUnderItself', {
  kind: kind('Conflict'),
}) {}

/**
 * A Leaf is one file: nothing stands below it, neither Children nor Context. Nothing is created or
 * moved under a Leaf, and a Tile holding anything never takes a Leaf slot, by a move or a swap: a
 * Leaf grows into a Branch, and a Branch with nothing below it shrinks into a Leaf, by moving.
 */
export class LeafHoldsNothing extends Schema.TaggedError<LeafHoldsNothing>()('LeafHoldsNothing', {
  kind: kind('Conflict'),
}) {}

/**
 * Help is hexframe's own System, which every Account reads and none writes: a change naming one of its
 * Tiles is refused, whichever end of a move or a swap it is.
 */
export class HelpReadOnly extends Schema.TaggedError<HelpReadOnly>()('HelpReadOnly', {
  kind: kind('Forbidden'),
}) {}

export const mappingFailures = [
  TileNotFound,
  TitleMissing,
  PreviewTooLong,
  NameInvalid,
  DirectionTaken,
  MovedUnderItself,
  LeafHoldsNothing,
  RootFixed,
  HelpReadOnly,
] as const
