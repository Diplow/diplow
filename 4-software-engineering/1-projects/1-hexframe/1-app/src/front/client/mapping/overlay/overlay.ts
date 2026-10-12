// The System on screen: the server's, with every write to it still waiting for its answer folded over
// it, in the order the user made them, each through Mapping's `decide` then `evolve`. The cache keeps
// only what the server said, so a refused write, once no longer pending, simply stops showing: nothing
// is rolled back by hand, and a refetch carrying someone else's change slips in under the writes still
// pending. Each write names the Versions of the Tiles it changes as the screen drew them, so a read
// that already holds it, or holds a change made meanwhile elsewhere, has moved them on, and `decide`
// refuses folding it again over that read. The same `decide` foresees a refusal before a write is
// sent. What the writes on their way change is marked on the canvas while they are (`onItsWay`).
// Pure.
import { Option, Result, Schema } from 'effect'

import { ImportPlace } from '#/api/mapping/places'
import type { Slot, System } from '#/domains/mapping/entities'
import { decide, evolve, isOperationName, Operation, tagOf } from '#/domains/mapping/operations'

/** A write to the System still waiting for its answer, as the MutationCache holds it. */
export interface Pending {
  /** Its turn: the MutationCache numbers mutations in the order they were made. */
  readonly turn: number
  /** The Operation it sends, read once from its name and variables (`operationOf`); none for an import. */
  readonly operation: Operation | undefined
  /** Where an import lands; none for an Operation. */
  readonly landing?: ImportPlace | undefined
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

/** An import's name, which its mutation is keyed by. */
export const importing = 'importTiles'

const decodeLanding = Schema.decodeUnknownOption(Schema.Struct({ place: ImportPlace }))

/**
 * Where an import lands, read from its name and variables by the server function's schema: none for
 * an Operation, nor for a place the schema refuses.
 */
export function landingOf(name: unknown, variables: unknown): ImportPlace | undefined {
  if (name !== importing) return undefined
  return Option.getOrUndefined(Option.map(decodeLanding(variables), ({ place }) => place))
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

/**
 * The Tiles a write changes, by id: the one it creates, edits, moves or deletes, the two a swap
 * trades, the one whose Context slot a Reference's create or delete changes. A create without the
 * id its caller chose names none.
 */
export function tilesWrittenBy(operation: Operation): ReadonlyArray<string> {
  switch (operation._tag) {
    case 'CreateTile':
      return operation.id === undefined ? [] : [operation.id]
    case 'EditTile':
    case 'MoveTile':
    case 'DeleteTile':
      return [operation.id]
    case 'SwapTiles':
      return [operation.a, operation.b]
    case 'CreateReference':
    case 'DeleteReference':
      return [operation.parent]
  }
}

/** What the writes on their way change, as the page marks them. */
export interface OnItsWay {
  /** The Tiles they change, by id, the Root of a System an import lands as included. */
  readonly tiles: ReadonlySet<string>
  /** The free slots imports land in, each by the Tile it stands under. */
  readonly slots: ReadonlyArray<{ readonly parent: string; readonly slot: Slot }>
}

/** What the writes on their way to the System whose Root is `root` change. */
export function onItsWay(pending: ReadonlyArray<Pending>, root: string): OnItsWay {
  const tiles = new Set<string>()
  const slots: { parent: string; slot: Slot }[] = []
  for (const { operation, landing } of pending) {
    if (operation !== undefined) for (const id of tilesWrittenBy(operation)) tiles.add(id)
    if (landing?._tag === 'Root') tiles.add(root)
    if (landing?._tag === 'Slot') slots.push({ parent: landing.parent, slot: landing.slot })
  }
  return { tiles, slots }
}
