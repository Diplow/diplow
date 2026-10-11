// The System on screen: the server's, with every write to it still waiting for its answer folded over
// it, in the order the user made them, each through Mapping's `decide` then `evolve`. The cache keeps
// only what the server said, so a refused write, once no longer pending, simply stops showing: nothing
// is rolled back by hand, and a refetch carrying someone else's change slips in under the writes still
// pending. Each write names the Versions of the Tiles it changes as the screen drew them, so a read
// that already holds it, or holds a change made meanwhile elsewhere, has moved them on, and `decide`
// refuses folding it again over that read. The same `decide` foresees a refusal before a write is
// sent. Pure.
import { Option, Result, Schema } from 'effect'

import type { System } from '#/domains/mapping/entities'
import { decide, evolve, isOperationName, Operation, tagOf } from '#/domains/mapping/operations'

/** A write to the System still waiting for its answer, as the MutationCache holds it. */
export interface Pending {
  /** Its turn: the MutationCache numbers mutations in the order they were made. */
  readonly turn: number
  /** The Operation it sends, read once from its name and variables (`operationOf`); none for an import. */
  readonly operation: Operation | undefined
}

const decodeOperation = Schema.decodeUnknownOption(Operation)

/**
 * The Operation a write sends, read from its name, the tag in camelCase, and its variables: none for a
 * write that is no Operation, an import, nor for fields Mapping's schema refuses, which the server
 * function refuses in turn.
 */
export function operationOf(name: unknown, variables: unknown): Operation | undefined {
  if (!isOperationName(name) || typeof variables !== 'object' || variables === null) {
    return undefined
  }
  return Option.getOrUndefined(decodeOperation({ ...variables, _tag: tagOf(name) }))
}

/**
 * What an Operation does to a System on the client: the System after its events, or Mapping's refusal.
 * `made` is the id of what a create makes when its Operation carries none: a Reference's, which the
 * server makes, stands in under it until the server's System lands.
 */
function decided(system: System, operation: Operation, made: string) {
  const id = 'id' in operation && operation.id !== undefined ? operation.id : made
  return Result.map(decide(system, operation, { id }), (events) => events.reduce(evolve, system))
}

/** Mapping's refusal of an Operation on this System, foreseen before it is sent; none if it passes. */
export function refusalOf(system: System, operation: Operation) {
  return Option.getOrUndefined(Result.getFailure(decided(system, operation, 'foreseen')))
}

/**
 * The System on screen: the server's, with each pending write folded over it in its turn. A write
 * `decide` refuses on the System as it stands by then changes nothing, so a write queued behind a
 * refused one still shows, and a write a read already holds, its Tiles' Versions moved on since, is
 * not folded again.
 */
export function overlaid(system: System, pending: ReadonlyArray<Pending>): System {
  return [...pending]
    .sort((a, b) => a.turn - b.turn)
    .reduce((shown, { turn, operation }) => {
      if (operation === undefined) return shown
      return Result.getOrElse(decided(shown, operation, `pending-${String(turn)}`), () => shown)
    }, system)
}
