// Mapping's errors, in its language, each with the kind the client routes it by (src/domains/kind.ts).
import { Schema } from 'effect'

import { invalid, kind } from '../kind'

/** No Tile of this id in the Account's System: it was deleted, or it is someone else's. */
export class TileNotFound extends Schema.TaggedError<TileNotFound>()('TileNotFound', {
  kind: kind('NotFound'),
}) {}

/**
 * The id a create was given is a Tile's already, in this System or in any other: a Tile's id is its
 * own across every Account. It says nothing of where that Tile is, and nothing is written. The same
 * id given twice is refused the second time.
 */
export class TileIdTaken extends Schema.TaggedError<TileIdTaken>()('TileIdTaken', {
  kind: kind('Conflict'),
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

/**
 * What an import finds wrong in its files, each by the path at fault from the import's root (`''` the
 * root itself, or the whole upload): a ring of more than six Branches, Leaves or Context folders (the
 * folder's path); two names claiming one Direction (the later in name order); a Title, a Preview or a
 * Body past its bound; a file past the shape's 1 MB, as it inflates; a name that is no path segment; a
 * folder deeper than an import goes; a frontmatter that isn't YAML or keeps what a Tile can't; a
 * `.hexframe/` file that can't be read; a Reference's folder holding anything; a file imported alone
 * that holds nothing a System can. Then the upload's and its archive's: an upload past 4 MB; more
 * entries than an import takes, or more bytes unpacked (at the entry that passed them); an archive
 * that can't be read; and an entry whose path isn't plain: a symlink, an absolute path, a drive
 * prefix (`C:`), a backslash, a `.` or `..` segment, a path that doesn't read the same once
 * normalized (an empty segment, a character Unicode writes another way), and two entries whose paths
 * are equal or differ only by case (the later).
 */
const importFaults = [
  'RingOverflows',
  'DirectionClaimed',
  'TitleTooLong',
  'PreviewTooLong',
  'BodyTooLong',
  'FileTooLarge',
  'NameInvalid',
  'TooDeep',
  'FrontmatterInvalid',
  'ConfigInvalid',
  'ExclusionsInvalid',
  'ReferenceHoldsSomething',
  'NothingToImport',
  'UploadTooLarge',
  'TooManyEntries',
  'UnpackedTooLarge',
  'ArchiveUnreadable',
  'Symlink',
  'PathAbsolute',
  'DrivePrefix',
  'Backslash',
  'DotSegment',
  'PathNotNormal',
  'PathsClash',
] as const

/** One fault of an import, by the path at fault. */
export const ImportFault = Schema.Struct({
  path: Schema.String,
  fault: Schema.Literals(importFaults),
})
export type ImportFault = typeof ImportFault.Type

/**
 * An import's files hold something a System can't, or that the shape would not read back as it was
 * written: the whole import is refused, nothing written, with every fault at once, on the field
 * `files`.
 */
export class ImportRefused extends Schema.TaggedError<ImportRefused>()('ImportRefused', {
  ...invalid,
  faults: Schema.NonEmptyArray(ImportFault),
}) {}

export const mappingFailures = [
  TileNotFound,
  TitleMissing,
  PreviewTooLong,
  NameInvalid,
  DirectionTaken,
  TileIdTaken,
  MovedUnderItself,
  LeafHoldsNothing,
  RootFixed,
  HelpReadOnly,
  ImportRefused,
] as const
