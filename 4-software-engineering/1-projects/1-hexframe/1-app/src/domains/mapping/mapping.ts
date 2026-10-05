// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root is the user. The tiles repository keeps
// the rows (src/repositories/database/tiles/); Mapping decides what a change may do, then writes it.
// Every operation is for one Account, which the API layer takes from IAM's Session. A change runs in
// the transaction the API layer opens around it (`transactional`): its type requires one. Beside each
// Account's System, every Account reads Help (./help/help.ts), which no change may name.
import { Effect } from 'effect'

import type { InTransaction } from '#/repositories/database/database'
import { Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { DirectionTaken, HelpReadOnly, MovedUnderItself, RootFixed, TileNotFound } from './errors'
import { type LinkOf, exportOf } from './files/files'
import { findInHelp, type HelpLanguage, isHelpId } from './help/help'
import type { ToKeep } from './kept/kept'
import { holdsNothingIfLeaf, notLeaf } from './leaves/leaves'
import {
  type Depth,
  type Field,
  type FieldsAsked,
  type Found,
  type ReadTile,
  below,
  readOf,
  rowAt,
  showing,
  systemOf,
  tileRow,
} from './system'
import {
  type Content,
  type ContextDirection,
  type Slot,
  type Tile,
  checked,
  rowDirection,
} from './tile'

export { HelpId, helpRoot, helpSystem } from './help/help'
export { depths, fields } from './system'
export { directions, previewLimit } from './tile'
export type { Depth, Field, ReadTile, SystemTile } from './system'
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

/** A Tile read from, with the id and Title of its parent, `null` for the Root. */
interface Read<F extends Field> {
  readonly tile: ReadTile<F>
  readonly parent: Pick<Tile, 'id' | 'title'> | null
}

/** Where a read starts, how far down it goes, what it asks of each Tile, and Help's language. */
interface ReadFrom<O extends Field, F extends Field> {
  readonly id?: string | undefined
  readonly depth: Depth
  readonly fields: FieldsAsked<O, F>
  readonly language: HelpLanguage
}

/**
 * What a read from a Tile of the Account's System finds, its Root when no id is given, or from a Tile
 * of Help by its id, `depth` generations down, with only the fields asked of the Tile and of each Tile
 * below it. A Tile of another System is `TileNotFound`, as is a Help id no Tile of Help has. Reading
 * the Root adds it.
 */
const find = <O extends Field, F extends Field>(
  accountId: string,
  { id, depth, fields, language }: ReadFrom<O, F>,
): Effect.Effect<Found<O, F>, TileNotFound, Tiles> =>
  id !== undefined && isHelpId(id)
    ? findInHelp(id, { fields, language })
    : findOwn(accountId, { id, depth, fields })

/** What a read from a Tile of the Account's System finds, its Root when no id is given. */
const findOwn = <O extends Field, F extends Field>(
  accountId: string,
  { id, depth, fields }: Omit<ReadFrom<O, F>, 'language'>,
) =>
  Tiles.use((tiles) =>
    Effect.gen(function* () {
      const from = id ?? (yield* tiles.root(accountId, untitled))
      const found = yield* tiles.generationsFrom(accountId, { id: from, depth, columns: fields })
      // A Reference's row is no Tile: its id names nothing to open.
      if (found === undefined || found.opened.target !== null) return yield* new TileNotFound()
      const { opened, below } = found
      const targets = below.flatMap(({ target }) => (target === null ? [] : [target]))
      const parentIds = opened.parentId === null ? [] : [opened.parentId]
      const [parents, pointedAt] = yield* Effect.all(
        [
          tiles.ofIds(accountId, parentIds, ['title']),
          tiles.ofIds(accountId, targets, ['title', 'preview']),
        ],
        { concurrency: 'unbounded' },
      )
      const parent = parents[0]
      return {
        opened,
        rows: below,
        pointedAt,
        parent: parent === undefined ? null : { id: parent.id, title: parent.content.title },
      } satisfies Found<O, F>
    }),
  )

/**
 * A Tile of the Account's System, its Root when no id is given, or a Tile of Help by its id, read
 * `depth` generations down with only the fields asked of each Tile, and its parent. A Reference shows
 * the id, Title and Preview of the Tile it points at. A Body is read only when asked, and a Tile of
 * another System is `TileNotFound`, as is a Help id no Tile of Help has. A Tile of Help is read in
 * `language`, which the caller picks. Reading the Root adds it, as `system` does.
 */
export const readTile = <F extends Field>(
  accountId: string,
  { fields, ...from }: Omit<ReadFrom<F, F>, 'fields'> & { readonly fields: ReadonlyArray<F> },
) =>
  Effect.map(
    find(accountId, { ...from, fields: { opened: fields, below: fields } }),
    ({ opened, rows, pointedAt, parent }): Read<F> => ({
      tile: readOf(opened, { rows, depth: from.depth, pointedAt }),
      parent,
    }),
  )

/** What a reader sees of a Tile beside the one opened: enough to decide whether to open it. */
const glimpsed = ['title', 'preview'] as const satisfies ReadonlyArray<Field>

/** A Tile's Branches, Leaves and Context, each by its Title and Preview. */
type Around = Required<Pick<ReadTile<(typeof glimpsed)[number]>, 'branches' | 'leaves' | 'context'>>

/**
 * A Tile opened: it with the fields asked, its parent, and its Branches, Leaves and Context around it.
 */
export type Opened<F extends Field> = Read<F> & Around

/**
 * A Tile of the Account's System, its Root when no id is given, or a Tile of Help by its id, opened:
 * it with only the fields asked, its parent, and its Branches, Leaves and Context by Title and
 * Preview, as a reader opens a Tile before deciding which of them to open next. One read, one
 * generation down, and a Body below the Tile never leaves the database.
 */
export const openTile = <F extends Field>(
  accountId: string,
  {
    id,
    fields,
    language,
  }: Pick<ReadFrom<F, F>, 'id' | 'language'> & {
    readonly fields: ReadonlyArray<F>
  },
) =>
  Effect.map(
    find(accountId, {
      id,
      depth: 1,
      fields: { opened: [...new Set([...fields, ...glimpsed])], below: glimpsed },
      language,
    }),
    ({ opened, rows, pointedAt, parent }): Opened<F> => {
      const around = readOf(showing(opened, glimpsed), { rows, depth: 1, pointedAt })
      return {
        tile: readOf(showing(opened, fields), { rows: [], depth: 0, pointedAt: [] }),
        parent,
        branches: around.branches ?? {},
        leaves: around.leaves ?? {},
        context: around.context ?? {},
      }
    },
  )

/**
 * The Tile of this id in the Account's System, and everything below it, zipped: the archive's name,
 * `<slug>.zip`, its Tile's slug, and its bytes, streamed as they are zipped. A Tile of another System
 * is `TileNotFound`, as is a Reference, which has no files of its own. `link` is where the app shows
 * a Tile, for a Reference whose Tile the export leaves out. Reading the Root adds it, as `system` does.
 */
export const exportTile = (accountId: string, { id, link }: { id: string; link: LinkOf }) =>
  Effect.gen(function* () {
    const exported = exportOf(yield* system(accountId), id, link)
    if (exported === undefined) return yield* new TileNotFound()
    const { zipped } = yield* Zip
    return { name: `${exported.slug}.zip`, bytes: zipped(exported.files) }
  })

/**
 * Refuses a change that names a Tile of Help, whichever schema let its ids through: Help is read by
 * every Account and written by none.
 */
const outsideHelp = (ids: ReadonlyArray<string>) =>
  ids.some(isHelpId) ? Effect.fail(new HelpReadOnly()) : Effect.void

/**
 * A change to the Account's System, naming these Tiles, none of them Help's, on its rows as they
 * stand once its Root is locked: alone until the transaction around it ends, so what it checked still
 * holds when it writes.
 */
const changing = <A, E>(
  accountId: string,
  names: ReadonlyArray<string>,
  change: (rows: ReadonlyArray<TileRow>, writes: Writes) => Effect.Effect<A, E, InTransaction>,
) =>
  Effect.andThen(
    outsideHelp(names),
    Tiles.use((tiles) =>
      Effect.flatMap(tiles.lock(accountId), (rows) => change(rows, tiles.writes(accountId))),
    ),
  )

const tileIn = (rows: ReadonlyArray<TileRow>, id: string) => {
  const row = tileRow(rows, id)
  return row === undefined ? Effect.fail(new TileNotFound()) : Effect.succeed(row)
}

/**
 * The parent Tile of a placement, once it is known to be no Leaf, which holds nothing, and its slot to
 * be free.
 */
const freeSlot = (rows: ReadonlyArray<TileRow>, { parent, slot }: Placement) =>
  Effect.flatMap(Effect.flatMap(tileIn(rows, parent), notLeaf), (row) =>
    rowAt(rows, parent, rowDirection(slot)) === undefined
      ? Effect.succeed(row)
      : Effect.fail(new DirectionTaken()),
  )

const notRoot = (row: TileRow) =>
  row.parentId === null ? Effect.fail(new RootFixed()) : Effect.succeed(row)

/**
 * Adds a Tile in a free slot under a Tile of the System, never under a Leaf: a Branch, a Leaf, or a
 * Tile of its Context. An import gives it what it keeps from its files, each part already checked
 * (`./kept/kept.ts`); nothing else does, and no later change touches them.
 */
export const createTile = (
  accountId: string,
  { parent, slot, name, config, frontmatter, ...content }: Placement & Content & ToKeep,
) =>
  changing(accountId, [parent], (rows, writes) =>
    Effect.gen(function* () {
      const valid = yield* checked(content)
      yield* freeSlot(rows, { parent, slot })
      const direction = rowDirection(slot)
      const kept = { name, config, frontmatter }
      const id = yield* writes.insert({
        parentId: parent,
        direction,
        target: null,
        ...valid,
        ...kept,
      })
      return { id, ...valid } satisfies Tile
    }),
  )

/** Changes what a Tile says: any of its Title, its Preview and its Body. */
export const editTile = (accountId: string, id: string, changes: Partial<Content>) =>
  changing(accountId, [id], (rows, writes) =>
    Effect.gen(function* () {
      const valid = yield* checked(changes)
      const { title, preview, body } = yield* tileIn(rows, id)
      yield* writes.update(id, valid)
      return { id, title, preview, body, ...valid } satisfies Tile
    }),
  )

/**
 * Moves a Tile, and everything below it, to a free slot under another Tile of the System, never under
 * a Leaf, or to another slot of the same parent. A Leaf slot takes a Tile with nothing below it only,
 * so a Leaf grows into a Branch, and a bare Branch shrinks into a Leaf, by moving. References to it
 * follow, since they hold its id.
 */
export const moveTile = (accountId: string, id: string, to: Placement) =>
  changing(accountId, [id, to.parent], (rows, writes) =>
    Effect.gen(function* () {
      const row = yield* Effect.flatMap(tileIn(rows, id), notRoot)
      const direction = rowDirection(to.slot)
      if (row.parentId === to.parent && row.direction === direction) return
      if (below(rows, id).has(to.parent)) return yield* new MovedUnderItself()
      yield* freeSlot(rows, to)
      yield* holdsNothingIfLeaf(rows, id, direction)
      yield* writes.update(id, { parentId: to.parent, direction })
    }),
  )

/**
 * Two Tiles of the System trade places, each with everything below it: each takes the other's parent
 * and slot, a Branch's, a Leaf's or a Context slot alike. Neither may be the Root, nor lie below the
 * other, which would put one below itself, nor hold anything when it takes a Leaf slot. References to
 * them follow, since they hold their ids.
 */
export const swapTiles = (accountId: string, a: string, b: string) =>
  changing(accountId, [a, b], (rows, writes) =>
    Effect.gen(function* () {
      const first = yield* Effect.flatMap(tileIn(rows, a), notRoot)
      const second = yield* Effect.flatMap(tileIn(rows, b), notRoot)
      if (a === b) return
      if (below(rows, a).has(b) || below(rows, b).has(a)) return yield* new MovedUnderItself()
      yield* holdsNothingIfLeaf(rows, a, second.direction)
      yield* holdsNothingIfLeaf(rows, b, first.direction)
      yield* writes.swap(a, b)
    }),
  )

/** Deletes a Tile and everything below it. A Reference to any of them stays, broken. */
export const deleteTile = (accountId: string, id: string) =>
  changing(accountId, [id], (rows, writes) =>
    Effect.gen(function* () {
      yield* Effect.flatMap(tileIn(rows, id), notRoot)
      yield* writes.remove(id)
    }),
  )

/**
 * Puts a Reference to a Tile of the System in a free Context slot of another, or of itself, never of a
 * Leaf, which has no Context.
 */
export const createReference = (
  accountId: string,
  { parent, slot, target }: { parent: string; slot: ContextDirection; target: string },
) =>
  changing(accountId, [parent, target], (rows, writes) =>
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
  changing(accountId, [parent], (rows, writes) =>
    Effect.gen(function* () {
      yield* tileIn(rows, parent)
      const held = rowAt(rows, parent, slot)
      if (held === undefined || held.target === null) return
      yield* writes.remove(held.id)
    }),
  )
