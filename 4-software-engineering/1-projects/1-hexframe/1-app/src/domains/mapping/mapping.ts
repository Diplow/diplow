// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root is the user. The tiles repository keeps
// the rows (src/repositories/database/tiles/); Mapping decides what a change may do, then writes it.
// Every operation is for one Account, which the API layer takes from IAM's Session. A change runs in
// the transaction the API layer opens around it (`transactional`): its type requires one.
import { Effect } from 'effect'

import type { InTransaction } from '#/repositories/database/database'
import { Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'

import { DirectionTaken, MovedUnderItself, RootFixed, TileNotFound } from './errors'
import { below, rowAt, systemOf, tileRow } from './system'
import { type Content, type ContextDirection, type Slot, type Tile, checked } from './tile'

export type { SystemTile } from './system'
export type { Content, ContextDirection, Direction } from './tile'

/** The content of a Root nobody has named yet, and of every Reference, which keeps none of its own. */
const untitled: Content = { title: '', preview: '', body: '' }

/** Where a Tile or a Reference goes: a slot under a parent Tile. */
interface Placement {
  readonly parent: string
  readonly slot: Slot
}

/**
 * The Account's System: its Root, the user, with everything below it. The first read adds the Root,
 * with an empty Title until the user names it; any later read, or two at once, finds that one.
 */
export const system = (accountId: string) =>
  Effect.gen(function* () {
    const rows = yield* Tiles.use((tiles) => tiles.read(accountId, untitled))
    const found = systemOf(rows)
    if (found === undefined) return yield* Effect.die(new Error('A System was read without a Root'))
    return found
  })

/**
 * A change to the Account's System, on its rows as they stand once its Root is locked: alone until
 * the transaction around it ends, so what it checked still holds when it writes.
 */
const changing = <A, E>(
  accountId: string,
  change: (rows: ReadonlyArray<TileRow>, writes: Writes) => Effect.Effect<A, E, InTransaction>,
) =>
  Tiles.use((tiles) =>
    Effect.flatMap(tiles.lock(accountId), (rows) => change(rows, tiles.writes(accountId))),
  )

const tileIn = (rows: ReadonlyArray<TileRow>, id: string) => {
  const row = tileRow(rows, id)
  return row === undefined ? Effect.fail(new TileNotFound()) : Effect.succeed(row)
}

/** The parent Tile of a placement, once its slot is known to be free. */
const freeSlot = (rows: ReadonlyArray<TileRow>, { parent, slot }: Placement) =>
  Effect.flatMap(tileIn(rows, parent), (row) =>
    rowAt(rows, parent, slot) === undefined
      ? Effect.succeed(row)
      : Effect.fail(new DirectionTaken()),
  )

const notRoot = (row: TileRow) =>
  row.parentId === null ? Effect.fail(new RootFixed()) : Effect.succeed(row)

/** Adds a Tile in a free slot under a Tile of the System: a Child, or a Tile of its Context. */
export const createTile = (accountId: string, input: Placement & Content) =>
  Effect.gen(function* () {
    const { parent, slot, ...content } = input
    const valid = yield* checked(content)
    return yield* changing(accountId, (rows, writes) =>
      Effect.gen(function* () {
        yield* freeSlot(rows, { parent, slot })
        const id = yield* writes.insert({
          parentId: parent,
          direction: slot,
          target: null,
          ...valid,
        })
        return { id, ...valid } satisfies Tile
      }),
    )
  })

/** Changes what a Tile says: any of its Title, its Preview and its Body. */
export const editTile = (accountId: string, id: string, changes: Partial<Content>) =>
  Effect.gen(function* () {
    const valid = yield* checked(changes)
    return yield* changing(accountId, (rows, writes) =>
      Effect.gen(function* () {
        const { title, preview, body } = yield* tileIn(rows, id)
        yield* writes.update(id, valid)
        return { id, title, preview, body, ...valid } satisfies Tile
      }),
    )
  })

/**
 * Moves a Tile, and everything below it, to a free slot under another Tile of the System, or to
 * another slot of the same parent. References to it follow, since they hold its id.
 */
export const moveTile = (accountId: string, id: string, to: Placement) =>
  changing(accountId, (rows, writes) =>
    Effect.gen(function* () {
      const row = yield* Effect.flatMap(tileIn(rows, id), notRoot)
      if (row.parentId === to.parent && row.direction === to.slot) return
      if (below(rows, id).has(to.parent)) return yield* new MovedUnderItself()
      yield* freeSlot(rows, to)
      yield* writes.update(id, { parentId: to.parent, direction: to.slot })
    }),
  )

/** Deletes a Tile and everything below it. A Reference to any of them stays, broken. */
export const deleteTile = (accountId: string, id: string) =>
  changing(accountId, (rows, writes) =>
    Effect.gen(function* () {
      yield* Effect.flatMap(tileIn(rows, id), notRoot)
      yield* writes.remove(id)
    }),
  )

/** Puts a Reference to a Tile of the System in a free Context slot of another, or of itself. */
export const createReference = (
  accountId: string,
  { parent, slot, target }: { parent: string; slot: ContextDirection; target: string },
) =>
  changing(accountId, (rows, writes) =>
    Effect.gen(function* () {
      yield* tileIn(rows, target)
      yield* freeSlot(rows, { parent, slot })
      yield* writes.insert({ parentId: parent, direction: slot, target, ...untitled })
    }),
  )

/** Empties a Context slot holding a Reference; the Tile it pointed at is untouched. */
export const deleteReference = (
  accountId: string,
  { parent, slot }: { parent: string; slot: ContextDirection },
) =>
  changing(accountId, (rows, writes) =>
    Effect.gen(function* () {
      yield* tileIn(rows, parent)
      const held = rowAt(rows, parent, slot)
      if (held === undefined || held.target === null) return
      yield* writes.remove(held.id)
    }),
  )
