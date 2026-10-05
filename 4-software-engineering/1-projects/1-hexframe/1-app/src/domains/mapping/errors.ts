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
 * The Direction, or the Context slot, already holds a Tile or a Reference. A seventh Child is refused
 * this way: the user regroups some Children under a new one, by moving them.
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
  DirectionTaken,
  MovedUnderItself,
  RootFixed,
  HelpReadOnly,
] as const
