// A batch's inverse: the Operations that undo the events a batch made, from the System it ran on, so
// an undo never needs a history it doesn't have. Each event's own: an edit's previous Title, Preview
// and Body, a move's previous slot, a swap's swap, a create's delete, a delete making again what it
// removed, under the same ids, a Reference's create's delete and its delete's create. They run in the
// reverse order of the events, each naming the Version it finds once the ones before it ran over what
// the batch left, the first ones the Versions the batch left, so `decide` refuses an undo over a Tile
// changed since (`TileChanged`); and an undo deletes a Tile its batch made only while nothing lies
// below it, which only another writer could have put there since (`undone`). A batch that grows, an
// applied Turn's writes, keeps one undo of all of it (`extended`). Pure
// (`hexframe-app-assistant/decisions.md#DEC-16`).
import { Result, Schema, Struct } from 'effect'

import {
  below,
  type FoundTile,
  type PlacedReference,
  type PlacedTile,
  type System,
  tileAt,
} from '../../entities'
import { BatchOutdated } from '../../errors'
import { evolve } from '../decider/evolve'
import type { OperationEvent } from '../events'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  type Operation,
  SwapTiles,
} from '../operation'
import { Batched, type Folded, KeptParts, whole } from './fold'

/**
 * What undoes a batch that ran: its `Inverse`, the Operations that reverse its events, in the order
 * they run; or `Outdated`, once a Tile it touched changed between two of its runs, for good.
 */
export const Undo = Schema.Union([
  Schema.TaggedStruct('Inverse', { batch: Schema.Array(Batched) }),
  Schema.TaggedStruct('Outdated', {}),
])
export type Undo = typeof Undo.Type

/** One Operation of an undo, made on the System the undo stands on when it runs; none for nothing. */
type Step = (system: System) => Batched | undefined

/** The Version of the Tile of this id where an undo stands: a Tile an event left there. */
function versionIn(system: System, id: string) {
  const found = tileAt(system, id)
  if (found === undefined) throw new Error('An undo lost a Tile its batch left')
  return found.version
}

/** A Tile the System holds below its Root, by its id. */
function placedIn(system: System, id: string): PlacedTile {
  const found = tileAt(system, id)
  if (found === undefined || !('parent' in found)) throw new Error('An event named no Tile it held')
  return found
}

const keptParts = Schema.decodeUnknownSync(KeptParts)

/**
 * What a Tile kept from its files, only the parts it keeps, as a batch keeps them: checked again by
 * the Schemas that checked them before they were stored, which a stored part failing is a defect.
 */
const keptBy = ({ name, config, frontmatter }: FoundTile): Batched['kept'] => {
  const kept = {
    ...(name !== undefined && { name }),
    ...(config !== undefined && { config }),
    ...(frontmatter !== undefined && { frontmatter }),
  }
  return Object.keys(kept).length === 0 ? undefined : keptParts(kept)
}

/** A Tile made again as it stood, under its id, with what it kept from its files. */
const madeAgain = (tile: PlacedTile): Step => {
  const { id, parent, slot, title, preview, body } = tile
  const kept = keptBy(tile)
  return () => ({
    operation: new CreateTile({ id, parent, slot, title, preview, body }),
    made: id,
    ...(kept !== undefined && { kept }),
  })
}

/**
 * A Reference put back in its slot, under its id; none while the Tile it points at is not there as
 * the undo runs, a Reference no create can make broken.
 */
const referredAgain =
  ({ id, parent, slot, target }: Omit<PlacedReference, '_tag'>): Step =>
  (system) =>
    tileAt(system, target) === undefined
      ? undefined
      : {
          operation: new CreateReference({
            parent,
            parentVersion: versionIn(system, parent),
            slot,
            target,
          }),
          made: id,
        }

/**
 * A deleted Tile made again with everything below it, from the System before its delete: its Tiles
 * first, each after the one it stands under, then its References, which may point at any of them.
 */
function deletedAgain(before: System, id: string): ReadonlyArray<Step> {
  const held = [...below(before, id)].flatMap((each) => {
    const found = before.tiles[each]
    return found === undefined ? [] : [found]
  })
  return [
    ...held.flatMap((found) => (found._tag === 'Tile' ? [madeAgain(found)] : [])),
    ...held.flatMap((found) => (found._tag === 'Reference' ? [referredAgain(found)] : [])),
  ]
}

/**
 * What a Tile said before an edit, of the fields the edit changed. A Title only the Root has empty,
 * before the user names themselves, stays: no edit takes a Title back to nothing.
 */
function saidBefore(was: FoundTile, event: Extract<OperationEvent, { _tag: 'TileEdited' }>) {
  return {
    ...(event.title !== undefined && was.title !== '' && { title: was.title }),
    ...(event.preview !== undefined && { preview: was.preview }),
    ...(event.body !== undefined && { body: was.body }),
  }
}

/** The steps that undo one event, from the System it ran on. */
function stepsOf(before: System, event: OperationEvent): ReadonlyArray<Step> {
  switch (event._tag) {
    case 'TileCreated':
      return [
        (system) => ({
          operation: new DeleteTile({ id: event.id, version: versionIn(system, event.id) }),
        }),
      ]
    case 'TileEdited': {
      const was = tileAt(before, event.id)
      if (was === undefined) throw new Error('An edit named no Tile it held')
      const said = saidBefore(was, event)
      return [
        (system) => ({
          operation: new EditTile({ id: event.id, version: versionIn(system, event.id), ...said }),
        }),
      ]
    }
    case 'TileMoved': {
      const { parent, slot } = placedIn(before, event.id)
      return [
        (system) => ({
          operation: new MoveTile({
            id: event.id,
            version: versionIn(system, event.id),
            parent,
            slot,
          }),
        }),
      ]
    }
    case 'TilesSwapped':
      return [
        (system) => ({
          operation: new SwapTiles({
            a: event.a,
            aVersion: versionIn(system, event.a),
            b: event.b,
            bVersion: versionIn(system, event.b),
          }),
        }),
      ]
    case 'TileDeleted':
      return deletedAgain(before, event.id)
    case 'ReferenceCreated':
      return [
        (system) => ({
          operation: new DeleteReference({
            parent: event.parent,
            parentVersion: versionIn(system, event.parent),
            slot: event.slot,
          }),
        }),
      ]
    case 'ReferenceDeleted': {
      const was = before.tiles[event.id]
      if (was?._tag !== 'Reference') throw new Error('A delete named no Reference it held')
      return [referredAgain(was)]
    }
  }
}

/**
 * One more Operation of an undo, run on the System it stands on: refused as `decide` refuses it, a
 * Tile changed since included, and a delete refused unless its Tile holds nothing by then. An undo
 * deletes only a Tile its batch made, whose own Children it undid before, so anything still below
 * it was put there by another writer since, which the undo would delete with it.
 */
function stepped(system: System, batched: Batched): Result.Result<Folded, BatchOutdated> {
  const { operation } = batched
  if (operation._tag === 'DeleteTile' && below(system, operation.id).size > 1) {
    return Result.fail(new BatchOutdated())
  }
  return whole(system, [batched])
}

/** The System once one more Operation of an undo ran on it, or `BatchOutdated` (`stepped`). */
const ranOn = (system: System, batched: Batched) =>
  Result.map(stepped(system, batched), (folded) => folded.system)

/**
 * An undo run on a System, all of it or nothing: each Operation in order, as `stepped` runs it, and
 * their events, or `BatchOutdated` once one is refused.
 */
export function undone(
  system: System,
  batch: ReadonlyArray<Batched>,
): Result.Result<Folded, BatchOutdated> {
  let folded: Folded = { system, events: [], left: [] }
  for (const batched of batch) {
    const next = stepped(folded.system, batched)
    if (Result.isFailure(next)) return next
    folded = {
      ...folded,
      system: next.success.system,
      events: [...folded.events, ...next.success.events],
    }
  }
  return Result.succeed(folded)
}

/**
 * The steps that undo the events a batch made on `before`, the last event's first, and the System
 * the batch left, which they run on.
 */
function undoing(before: System, events: ReadonlyArray<OperationEvent>) {
  const steps: Array<ReadonlyArray<Step>> = []
  let after = before
  for (const event of events) {
    steps.push(stepsOf(after, event))
    after = evolve(after, event)
  }
  return { steps: steps.reverse().flat(), after }
}

/**
 * Steps run in order on a System, each Operation made on the System the ones before it left, or
 * `BatchOutdated` once one is refused. A Reference whose Tile is not there when its turn comes waits,
 * and is put back as soon as a step makes that Tile again, before the next step: it stood there from
 * then until its delete, so the undo of an older event may count on it, a delete of it or of the Tile
 * it stands under. One whose Tile never comes back was broken before the batch, and stays out.
 */
function walked(system: System, steps: ReadonlyArray<Step>) {
  const undo: Array<Batched> = []
  let standing = system
  let waiting: ReadonlyArray<Step> = []
  const ran = (batched: Batched) => {
    const after = ranOn(standing, batched)
    if (Result.isFailure(after)) return false
    standing = after.success
    undo.push(batched)
    return true
  }
  for (const step of steps) {
    const batched = step(standing)
    if (batched === undefined) {
      waiting = [...waiting, step]
      continue
    }
    if (!ran(batched)) return Result.fail(new BatchOutdated())
    const still: Array<Step> = []
    for (const held of waiting) {
      const back = held(standing)
      if (back === undefined) still.push(held)
      else if (!ran(back)) return Result.fail(new BatchOutdated())
    }
    waiting = still
  }
  return Result.succeed(undo)
}

/**
 * The Operations that undo the events a batch made on `before`, in the order they run: the last
 * event's first, each Operation naming the Version it finds where the ones before it left the System,
 * the first ones the Versions the batch left; a Reference whose Tile is not there yet when its turn
 * comes, put back as soon as the Tile is (`walked`). A Reference already broken before the batch, and
 * a Title only the untitled Root had, are what an undo cannot make again.
 */
export function inverse(
  before: System,
  events: ReadonlyArray<OperationEvent>,
): ReadonlyArray<Batched> {
  const { steps, after } = undoing(before, events)
  const undo = walked(after, steps)
  if (Result.isFailure(undo)) throw new Error('An undo refused what its batch left')
  return undo.success
}

/** What undoes the events a batch made on `before`: their inverse. */
export const undoOf = (before: System, events: ReadonlyArray<OperationEvent>): Undo => ({
  _tag: 'Inverse',
  batch: inverse(before, events),
})

/** An Operation naming each Tile it changes at the Version the System holds it at, as a writer reads it. */
function readAgain(system: System, operation: Operation): Operation {
  const now = (id: string, was: number) => tileAt(system, id)?.version ?? was
  switch (operation._tag) {
    case 'CreateTile':
      return operation
    case 'EditTile':
      return new EditTile({
        ...Struct.omit(operation, ['_tag']),
        version: now(operation.id, operation.version),
      })
    case 'MoveTile':
      return new MoveTile({
        ...Struct.omit(operation, ['_tag']),
        version: now(operation.id, operation.version),
      })
    case 'DeleteTile':
      return new DeleteTile({ id: operation.id, version: now(operation.id, operation.version) })
    case 'SwapTiles':
      return new SwapTiles({
        a: operation.a,
        aVersion: now(operation.a, operation.aVersion),
        b: operation.b,
        bVersion: now(operation.b, operation.bVersion),
      })
    case 'CreateReference':
      return new CreateReference({
        ...Struct.omit(operation, ['_tag']),
        parentVersion: now(operation.parent, operation.parentVersion),
      })
    case 'DeleteReference':
      return new DeleteReference({
        ...Struct.omit(operation, ['_tag']),
        parentVersion: now(operation.parent, operation.parentVersion),
      })
  }
}

/** An Operation of an earlier undo, made on the System it now runs on, naming the Versions held there. */
const readOn =
  (batched: Batched): Step =>
  (system) => ({ ...batched, operation: readAgain(system, batched.operation) })

/**
 * What undoes a batch that ran once more, making `events` on `before`, the System as it stood just
 * then: their inverse first, then the undo of what ran earlier, its Versions as the System holds them
 * once these are undone, walked as one undo (`walked`), so a Reference this run deleted whose Tile an
 * earlier run deleted is put back once the earlier undo makes that Tile again. `Outdated`, for good,
 * once that earlier undo no longer applied on `before`: a Tile it touched changed between the two
 * runs, by another writer, so undoing the whole would undo what that writer did.
 */
export function extended(
  earlier: Undo,
  before: System,
  events: ReadonlyArray<OperationEvent>,
): Undo {
  if (earlier._tag === 'Outdated') return earlier
  if (Result.isFailure(undone(before, earlier.batch))) return { _tag: 'Outdated' }
  const { steps, after } = undoing(before, events)
  return Result.match(walked(after, [...steps, ...earlier.batch.map(readOn)]), {
    onSuccess: (batch): Undo => ({ _tag: 'Inverse', batch }),
    onFailure: (): Undo => ({ _tag: 'Outdated' }),
  })
}
