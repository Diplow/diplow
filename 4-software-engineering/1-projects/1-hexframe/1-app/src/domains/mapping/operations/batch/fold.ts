// A batch: Operations kept to run later, written nowhere until they run, and the System they would
// make, folded over a System by the Decider. Each was decided once already,
// on the System the batch made before it, a create given the id of what it makes then, so folding the
// batch again over the same System makes the same Tiles under the same ids. An Operation that no longer
// applies, a Tile changed or gone since, is left out of the fold and said so, by its refusal, so the
// rest still folds for a reader; running the batch for good, or adding to it, refuses it whole then
// (`whole`, `BatchOutdated`). Pure.
import { Result, Schema } from 'effect'

import { type System, TileId, tileAt } from '../../entities'
import { BatchOutdated } from '../../errors'
import { decide, type Decided, type Refusal } from '../decider/decide'
import { evolve } from '../decider/evolve'
import { changeOf, type ChangeSummary, type OperationEvent } from '../events'
import { Operation } from '../operation'

/**
 * An Operation as a batch keeps it, decided once already: a create with `made`, the id of what it
 * makes, given when it was first decided, so every fold makes it under that id.
 */
export const Batched = Schema.Struct({
  operation: Operation,
  made: Schema.optionalKey(TileId),
})
export type Batched = typeof Batched.Type

/**
 * What a batch makes of a System: the System after every Operation of it that still applies, in
 * order, their events, and the refusals of those it left out, in order.
 */
export interface Folded {
  readonly system: System
  readonly events: ReadonlyArray<OperationEvent>
  readonly left: ReadonlyArray<Refusal>
}

/** What a batched Operation makes on a System, decided as `decide` decides it. */
function decided(system: System, { operation, made }: Batched): Decided {
  if (made !== undefined) return decide(system, operation, { id: made })
  if (operation._tag === 'CreateTile' || operation._tag === 'CreateReference') {
    throw new Error('A batched create lost the id of what it makes')
  }
  return decide(system, operation)
}

/** A batched Operation on a System: its events and the System after them, or its refusal. */
const applied = (system: System, batched: Batched) =>
  Result.map(decided(system, batched), (events) => ({
    events,
    system: events.reduce(evolve, system),
  }))

/**
 * A batch folded over a System: each Operation decided, in order, on the System the ones before it
 * made, its events evolving it; one `decide` refuses there, a Tile changed or gone since included,
 * left out and said so, the rest folded all the same.
 */
export const fold = (system: System, batch: ReadonlyArray<Batched>): Folded =>
  batch.reduce<Folded>(
    (folded, batched) =>
      Result.match(applied(folded.system, batched), {
        onSuccess: (next) => ({ ...folded, ...next, events: [...folded.events, ...next.events] }),
        onFailure: (refusal) => ({ ...folded, left: [...folded.left, refusal] }),
      }),
    { system, events: [], left: [] },
  )

/**
 * A batch folded over a System whole, as it runs for good and as it takes another Operation: all of
 * it, or `BatchOutdated` once one of its Operations no longer applies, the rest of it with it.
 */
export const whole = (
  system: System,
  batch: ReadonlyArray<Batched>,
): Result.Result<Folded, BatchOutdated> => {
  const folded = fold(system, batch)
  return folded.left.length === 0 ? Result.succeed(folded) : Result.fail(new BatchOutdated())
}

/**
 * One more Operation for a batch already folded over a System: decided on the System the batch
 * makes, refused as `decide` refuses it there, a create given `made`, the id of what it makes. Answers
 * it as the batch keeps it, the events it makes, and the System after them.
 */
export const added = (folded: Folded, operation: Operation, made?: string) => {
  const batched: Batched = made === undefined ? { operation } : { operation, made }
  return Result.map(applied(folded.system, batched), (next) => ({ batched, ...next }))
}

/**
 * What a timeline tells of some events of a batch, each a change summarized by Mapping (`changeOf`),
 * the Titles it does not say read from `after`, the System once they applied.
 */
export const summariesIn = (
  after: System,
  events: ReadonlyArray<OperationEvent>,
): ReadonlyArray<ChangeSummary> =>
  events.map((event) => changeOf(event, (id) => tileAt(after, id)?.title ?? ''))
