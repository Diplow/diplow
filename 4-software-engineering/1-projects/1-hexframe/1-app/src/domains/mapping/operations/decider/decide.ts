// The first half of Mapping's Decider: what an Operation does to a System, the events it makes, or the
// refusal Mapping answers. Every rule of an Operation lives here, and nowhere else: the application
// service runs it on the System it locked before it writes, and the client on the System it holds
// before it sends, so the two never disagree on what an Operation does. Every Operation on an existing
// Tile names the Version its writer read of it, and is refused once that Tile changed since. Pure: the
// id of what a create makes is given, never made here.
import { Result, Struct } from 'effect'

import {
  below,
  checked,
  type FoundTile,
  heldAt,
  holdsNothingIfLeaf,
  type PlacedTile,
  sameSlot,
  type System,
  tileAt,
  type ToKeep,
  type Version,
} from '../../entities'
import {
  type DirectionTaken,
  HelpReadOnly,
  type LeafHoldsNothing,
  MovedUnderItself,
  type PreviewTooLong,
  RootFixed,
  TileChanged,
  TileNotFound,
  type TitleMissing,
} from '../../errors'
import {
  type OperationEvent,
  ReferenceCreated,
  ReferenceDeleted,
  TileCreated,
  TileDeleted,
  TileEdited,
  TileMoved,
  TilesSwapped,
} from '../events'
import type {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  Operation,
  SwapTiles,
} from '../operation'
import { freeSlot } from '../placement'

/**
 * What `decide` may refuse each Operation, by its tag: Help's System refuses every one, and each
 * refuses only what its rules check, so a caller handles no refusal its Operation never gets.
 */
interface Refusals {
  readonly CreateTile:
    HelpReadOnly | TitleMissing | PreviewTooLong | TileNotFound | LeafHoldsNothing | DirectionTaken
  readonly EditTile: HelpReadOnly | TitleMissing | PreviewTooLong | TileNotFound | TileChanged
  readonly MoveTile:
    | HelpReadOnly
    | TileNotFound
    | TileChanged
    | RootFixed
    | MovedUnderItself
    | DirectionTaken
    | LeafHoldsNothing
  readonly SwapTiles:
    HelpReadOnly | TileNotFound | TileChanged | RootFixed | MovedUnderItself | LeafHoldsNothing
  readonly DeleteTile: HelpReadOnly | TileNotFound | TileChanged | RootFixed
  readonly CreateReference:
    HelpReadOnly | TileNotFound | TileChanged | LeafHoldsNothing | DirectionTaken
  readonly DeleteReference: HelpReadOnly | TileNotFound | TileChanged
}

/** Every refusal `decide` may answer, each a Mapping error with its kind. */
type Refusal = Refusals[keyof Refusals]

/**
 * What a create is given beside its Operation: the id of what it makes, which `decide` never makes
 * itself, and, for a Tile an import makes, what it keeps from its file, each part already checked
 * (`entities/kept/`).
 */
export interface Made {
  readonly id: string
  readonly kept?: ToKeep | undefined
}

/**
 * What `decide` answers an Operation of this tag: the events it makes, in the order they apply, none
 * when it changes nothing, or one of the refusals it may get.
 */
export type Decided<Tag extends keyof Refusals = keyof Refusals> = Result.Result<
  ReadonlyArray<OperationEvent>,
  Refusals[Tag]
>

/** A refusal, as a `Result.gen` below yields it. */
const refused = <R extends Refusal>(refusal: R) => Result.fail(refusal)

/** The Tile as its writer read it, at this Version: refused `TileChanged` once it moved since. */
const unchanged = <T extends FoundTile>(tile: T, version: Version) =>
  tile.version === version ? Result.succeed(tile) : refused(new TileChanged())

/** The Tile of this id in the System, the Root included, at the Version its writer read. */
const read = (system: System, id: string, version: Version) =>
  Result.gen(function* () {
    const found = tileAt(system, id)
    if (found === undefined) return yield* refused(new TileNotFound())
    return yield* unchanged(found, version)
  })

/**
 * A Tile of the System below its Root, at the Version its writer read: the Root is the user, never
 * moved, swapped nor deleted.
 */
const placed = (system: System, id: string, version: Version) =>
  Result.gen(function* () {
    const found = tileAt(system, id)
    if (found === undefined) return yield* refused(new TileNotFound())
    if (!('parent' in found)) return yield* refused(new RootFixed())
    return yield* unchanged<PlacedTile>(found, version)
  })

/** What a Tile keeps from its file, only the parts it keeps. */
const keptParts = ({ name, config, frontmatter }: ToKeep = {}) => ({
  ...(name === undefined ? {} : { name }),
  ...(config === undefined ? {} : { config }),
  ...(frontmatter === undefined ? {} : { frontmatter }),
})

/** Adds a Tile in a free slot under a Tile of the System, never under a Leaf. */
const createTile = (
  system: System,
  { parent, slot, title, preview, body }: CreateTile,
  { id, kept }: Made,
): Decided<'CreateTile'> =>
  Result.gen(function* () {
    const valid = yield* checked({ title, preview, body })
    yield* freeSlot(system, { parent, slot })
    return [new TileCreated({ id, parent, slot, ...valid, ...keptParts(kept) })]
  })

/** Changes what a Tile says, only the fields given, each checked: none given changes nothing. */
const editTile = (system: System, operation: EditTile): Decided<'EditTile'> =>
  Result.gen(function* () {
    const { id, version } = operation
    const valid = yield* checked(Struct.omit(operation, ['_tag', 'id', 'version']))
    yield* read(system, id, version)
    return Object.keys(valid).length === 0 ? [] : [new TileEdited({ id, ...valid })]
  })

/**
 * Moves a Tile, with everything below it, to a free slot under a Tile of the System, never under a
 * Leaf nor below itself, and into a Leaf slot only holding nothing. To where it stands changes nothing.
 */
const moveTile = (system: System, { id, version, parent, slot }: MoveTile): Decided<'MoveTile'> =>
  Result.gen(function* () {
    const moving = yield* placed(system, id, version)
    if (moving.parent === parent && sameSlot(moving.slot, slot)) return []
    if (below(system, id).has(parent)) return yield* refused(new MovedUnderItself())
    yield* freeSlot(system, { parent, slot })
    yield* holdsNothingIfLeaf(system, id, slot)
    return [new TileMoved({ id, parent, slot })]
  })

/**
 * Two Tiles trade places, each with everything below it: neither the Root, nor one below the other,
 * nor one holding anything into a Leaf slot. A Tile with itself changes nothing.
 */
const swapTiles = (system: System, { a, aVersion, b, bVersion }: SwapTiles): Decided<'SwapTiles'> =>
  Result.gen(function* () {
    const first = yield* placed(system, a, aVersion)
    const second = yield* placed(system, b, bVersion)
    if (a === b) return []
    if (below(system, a).has(b) || below(system, b).has(a)) {
      return yield* refused(new MovedUnderItself())
    }
    yield* holdsNothingIfLeaf(system, a, second.slot)
    yield* holdsNothingIfLeaf(system, b, first.slot)
    return [new TilesSwapped({ a, b })]
  })

/** Deletes a Tile, never the Root, with everything below it. */
const deleteTile = (system: System, { id, version }: DeleteTile): Decided<'DeleteTile'> =>
  Result.map(placed(system, id, version), () => [new TileDeleted({ id })])

/**
 * Puts a Reference to a Tile of the System in a free Context slot of a Tile, never of a Leaf, that Tile
 * at the Version its writer read.
 */
const createReference = (
  system: System,
  { parent, parentVersion, slot, target }: CreateReference,
  { id }: Made,
): Decided<'CreateReference'> =>
  Result.gen(function* () {
    if (tileAt(system, target) === undefined) return yield* refused(new TileNotFound())
    yield* read(system, parent, parentVersion)
    yield* freeSlot(system, { parent, slot })
    return [new ReferenceCreated({ id, parent, slot, target })]
  })

/**
 * Empties a Context slot holding a Reference, of a Tile at the Version its writer read: a slot holding
 * none changes nothing.
 */
const deleteReference = (
  system: System,
  { parent, parentVersion, slot }: DeleteReference,
): Decided<'DeleteReference'> =>
  Result.map(read(system, parent, parentVersion), () => {
    const held = heldAt(system, parent, slot)
    return held?._tag === 'Reference' ? [new ReferenceDeleted({ id: held.id, parent, slot })] : []
  })

/**
 * The id of what a create makes, which every overload taking a create requires: absent only to the
 * implementation, which also serves the Operations that make nothing.
 */
function given(made: Made | undefined): Made {
  if (made === undefined) throw new Error('A create was decided without the id of what it makes')
  return made
}

/**
 * What an Operation does to a System: the events it makes, in the order they apply (`evolve`), none
 * when it changes nothing, or the refusal Mapping answers it. A create is given the id of what it
 * makes (`Made`). A System no Account owns, Help's, takes no change at all (`HelpReadOnly`), whatever
 * the Operation names.
 */
export function decide(system: System, operation: CreateTile, made: Made): Decided<'CreateTile'>
export function decide(system: System, operation: EditTile): Decided<'EditTile'>
export function decide(system: System, operation: MoveTile): Decided<'MoveTile'>
export function decide(system: System, operation: SwapTiles): Decided<'SwapTiles'>
export function decide(system: System, operation: DeleteTile): Decided<'DeleteTile'>
export function decide(
  system: System,
  operation: CreateReference,
  made: Made,
): Decided<'CreateReference'>
export function decide(system: System, operation: DeleteReference): Decided<'DeleteReference'>
export function decide(
  system: System,
  operation: Exclude<Operation, CreateTile | CreateReference>,
): Decided
export function decide(system: System, operation: Operation, made: Made): Decided
export function decide(system: System, operation: Operation, made?: Made): Decided {
  if (!system.owned) return refused(new HelpReadOnly())
  switch (operation._tag) {
    case 'CreateTile':
      return createTile(system, operation, given(made))
    case 'EditTile':
      return editTile(system, operation)
    case 'MoveTile':
      return moveTile(system, operation)
    case 'SwapTiles':
      return swapTiles(system, operation)
    case 'DeleteTile':
      return deleteTile(system, operation)
    case 'CreateReference':
      return createReference(system, operation, given(made))
    case 'DeleteReference':
      return deleteReference(system, operation)
  }
}
