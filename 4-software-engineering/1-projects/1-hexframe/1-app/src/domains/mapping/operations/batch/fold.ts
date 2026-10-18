// A batch: Operations kept to run later, written nowhere until they run, and the System they would
// make, folded over a System by the Decider. Each was decided once already,
// on the System the batch made before it, a create given the id of what it makes then, so folding the
// batch again over the same System makes the same Tiles under the same ids. An Operation that no longer
// applies, a Tile changed or gone since, is left out of the fold and said so, by its refusal, so the
// rest still folds for a reader; running the batch for good, or adding to it, refuses it whole then
// (`whole`, `BatchOutdated`). Pure.
import { Result, Schema } from 'effect'

import { Frontmatter, Name, type System, TileConfig, TileId, tileAt } from '../../entities'
import { BatchOutdated } from '../../errors'
import { decide, type Decided, type Made, type Refusal, type Refusals } from '../decider/decide'
import { evolve } from '../decider/evolve'
import { changeOf, type ChangeSummary, type OperationEvent } from '../events'
import { Operation } from '../operation'

/** What a Tile kept from its files, each part by the Schema that checked it before it was stored. */
export const KeptParts = Schema.Struct({
  name: Schema.optionalKey(Name),
  config: Schema.optionalKey(TileConfig),
  frontmatter: Schema.optionalKey(Frontmatter),
})

/**
 * An Operation as a batch keeps it, decided once already: a create with `made`, the id of what it
 * makes, given when it was first decided, so every fold makes it under that id; and, for a Tile an
 * undo makes again, `kept`, what it kept from its files.
 */
export const Batched = Schema.Struct({
  operation: Operation,
  made: Schema.optionalKey(TileId),
  kept: Schema.optionalKey(KeptParts),
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

/**
 * What a batched Operation makes on a System, decided as `decide` decides it, a Reference pinning a
 * Tile of another System when its caller found it readable just now (`targetElsewhere`), which a
 * batch never keeps.
 */
function decided(
  system: System,
  { operation, made, kept }: Batched,
  targetElsewhere = false,
): Decided {
  if (made !== undefined) return decide(system, operation, { id: made, kept, targetElsewhere })
  if (operation._tag === 'CreateTile' || operation._tag === 'CreateReference') {
    throw new Error('A batched create lost the id of what it makes')
  }
  return decide(system, operation)
}

/** One step of a fold: the events a batched Operation makes on a System and the System after them. */
interface Step {
  readonly events: ReadonlyArray<OperationEvent>
  readonly system: System
}

/** A batched Operation on a System: its events and the System after them, or its refusal. */
const afterOne = (
  system: System,
  batched: Batched,
  targetElsewhere = false,
): Result.Result<Step, Refusal> =>
  Result.map(decided(system, batched, targetElsewhere), (events) => ({
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
      Result.match(afterOne(folded.system, batched), {
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

/** An Operation as a batch keeps it, a create with `made`, the id of what it makes. */
const batchedOf = (operation: Operation, made: string | undefined): Batched =>
  made === undefined ? { operation } : { operation, made }

/**
 * One Operation decided on a System, a create given `made`, the id of what it makes, a Reference
 * pinning a Tile of another System when its caller just found the actor may read it there
 * (`targetElsewhere`): the events it makes and the System after them, or what `decide` refuses it
 * there, typed by its tag as `decide`'s overloads type it, which the union `decided` goes through
 * loses, so it is said once, here.
 */
export const decidedOne = <O extends Operation>(
  system: System,
  operation: O,
  made?: string,
  { targetElsewhere = false }: Pick<Made, 'targetElsewhere'> = {},
) =>
  afterOne(system, batchedOf(operation, made), targetElsewhere) as Result.Result<
    Step,
    Refusals[O['_tag']]
  >

/**
 * One more Operation for a batch already folded over a System: decided on the System the batch
 * makes, refused as `decide` refuses it there (`decidedOne`), a create given `made`, the id of what
 * it makes. Answers it as the batch keeps it, the events it makes, and the System after them.
 */
export const added = <O extends Operation>(folded: Folded, operation: O, made?: string) =>
  Result.map(decidedOne(folded.system, operation, made), (next) => ({
    batched: batchedOf(operation, made),
    ...next,
  }))

/**
 * What a timeline tells of some events of a batch, each a change summarized by Mapping (`changeOf`),
 * the Titles it does not say read from `after`, the System once they applied; the other Tile a
 * Reference points at left out when `after` does not hold it, a pin's, which whoever's timeline it
 * is may not read, so not even its id is told.
 */
export const summariesIn = (
  after: System,
  events: ReadonlyArray<OperationEvent>,
): ReadonlyArray<ChangeSummary> =>
  events.map((event) => {
    const change = changeOf(event, (id) => tileAt(after, id)?.title ?? '')
    const { other, ...rest } = change
    return other === undefined || tileAt(after, other.id) !== undefined ? change : rest
  })
