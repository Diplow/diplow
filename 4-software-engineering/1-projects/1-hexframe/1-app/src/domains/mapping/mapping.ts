// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root is the user. The tiles repository keeps
// the rows (src/repositories/database/tiles/); Mapping decides what an Operation does to the System
// it locked (`decide`, ./operations/), then writes one change per event it made.
// Every operation is for one Account, which the API layer takes from IAM's Session. A change runs in
// the transaction the API layer opens around it (`transactional`): its type requires one. Beside each
// Account's System, every Account reads Help (./help/help.ts), which no change may name.
import { Effect, Result, Struct } from 'effect'

import type { InTransaction } from '#/repositories/database/database'
import { Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { HelpReadOnly, TileNotFound } from './errors'
import { type LinkOf, exportOf } from './files/files'
import { findInHelp, flatHelp, type HelpLanguage, isHelpId } from './help/help'
import {
  type Content,
  type Depth,
  type Field,
  type FieldsAsked,
  type Found,
  readOf,
  type ReadTile,
  rowDirection,
  showing,
  type System,
  systemFrom,
  systemOf,
  type Tile,
  tileAt,
  type ToKeep,
  withContent,
} from './entities'
import {
  type CreateReference,
  type CreateTile,
  decide,
  type DeleteReference,
  type DeleteTile,
  type EditTile,
  evolve,
  type MappingEvent,
  type MoveTile,
  type Operation,
  type SwapTiles,
  type TileCreated,
} from './operations'

export { HelpId, helpRoot, helpSystem } from './help/help'

/** The content of a Root nobody has named yet, and of every Reference, which keeps none of its own. */
export const untitled: Content = { title: '', preview: '', body: '' }

/**
 * The Account's System, flat: its Root, the user, and every Tile and Reference below it by id, Bodies
 * included, owned by the Account; `systemOf` builds its tree. The first read adds the Root, with an
 * empty Title until the user names it; any later read, or two at once, finds that one.
 */
export const system = (accountId: string) =>
  Effect.gen(function* () {
    const rows = yield* Tiles.use((tiles) => tiles.read(accountId, untitled))
    const found = systemFrom(rows, { owned: true })
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

/** What a reader sees of a Tile beside the one opened: enough to decide whether to open it. */
const glimpsed = ['title', 'preview'] as const satisfies ReadonlyArray<Field>

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
        [tiles.ofIds(accountId, parentIds, ['title']), tiles.ofIds(accountId, targets, glimpsed)],
        { concurrency: 'unbounded' },
      )
      const parent = parents[0]
      return {
        opened: withContent(opened, fields.opened),
        rows: below.map((row) => withContent(row, fields.below)),
        pointedAt: pointedAt.map((row) => withContent(row, glimpsed)),
        parent: parent === undefined ? null : { id: parent.id, title: parent.title },
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
    const exported = exportOf(systemOf(yield* system(accountId)), id, link)
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
 * A change to the Account's System that is no Operation, `landing/`'s import, naming these Tiles, none
 * of them Help's, on its rows as they stand once its Root is locked: alone until the transaction
 * around it ends, so what it checked still holds when it writes.
 */
export const changing = <A, E>(
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

/** The ids an Operation names: the Tiles it changes, and those it puts something under or points at. */
function namedBy(operation: Operation): ReadonlyArray<string> {
  switch (operation._tag) {
    case 'CreateTile':
    case 'DeleteReference':
      return [operation.parent]
    case 'EditTile':
    case 'DeleteTile':
      return [operation.id]
    case 'MoveTile':
      return [operation.id, operation.parent]
    case 'SwapTiles':
      return [operation.a, operation.b]
    case 'CreateReference':
      return [operation.parent, operation.target]
  }
}

/** A System no read should find without its Root: a defect, never a refusal. */
const rooted = (found: System | undefined) =>
  found === undefined
    ? Effect.die(new Error('A System was decided on without a Root'))
    : Effect.succeed(found)

/**
 * The System an Operation is decided on. Help's, which no Account owns, when it names a Tile of Help,
 * whichever end of a move or a swap, so `decide` refuses it. Otherwise the Account's, its Root added
 * on its first read as any read adds it, then locked until the transaction ends: no other change runs
 * meanwhile, so what `decide` ruled on still holds when its events are written.
 */
const decidedOn = (accountId: string, operation: Operation) =>
  namedBy(operation).some(isHelpId)
    ? rooted(flatHelp('en'))
    : Tiles.use((tiles) =>
        Effect.andThen(tiles.root(accountId, untitled), tiles.lock(accountId)).pipe(
          Effect.flatMap((rows) => rooted(systemFrom(rows, { owned: true }))),
        ),
      )

/** Whether an event is a Tile's create. */
const isTileCreated = (event: MappingEvent): event is TileCreated => event._tag === 'TileCreated'

/** Writes one event: the one change to the rows it stands for. */
const written =
  (writes: Writes) =>
  (event: MappingEvent): Effect.Effect<void, never, InTransaction> => {
    switch (event._tag) {
      case 'TileCreated': {
        const { id, parent, slot, title, preview, body, name, config, frontmatter } = event
        const row = { id, parentId: parent, direction: rowDirection(slot), target: null }
        return writes.insert({ ...row, title, preview, body, name, config, frontmatter })
      }
      case 'TileEdited':
        return writes.update(event.id, Struct.omit(event, ['_tag', 'id']))
      case 'TileMoved':
        return writes.update(event.id, {
          parentId: event.parent,
          direction: rowDirection(event.slot),
        })
      case 'TilesSwapped':
        return writes.swap(event.a, event.b)
      case 'TileDeleted':
      case 'ReferenceDeleted':
        return writes.remove(event.id)
      case 'ReferenceCreated': {
        const { id, parent, slot, target } = event
        return writes.insert({ id, parentId: parent, direction: slot, target, ...untitled })
      }
    }
  }

/** What an Operation did: the events `decide` made, in the order they were written, and the System after. */
interface Operated {
  readonly events: ReadonlyArray<MappingEvent>
  readonly system: System
}

/**
 * Runs an Operation on the Account's System: locks it, loads it flat, asks `decide` through `decided`,
 * then writes one change per event, and answers the events with the System they leave (`evolve`).
 * Every rule lives in `decide`: what it refuses is refused here, with nothing written. `decided` is
 * given the id a create gives what it makes, the repository's, made for every Operation and used by a
 * create alone, so `decide` never makes one.
 */
const operate = <E>(
  accountId: string,
  operation: Operation,
  decided: (system: System, id: string) => Result.Result<ReadonlyArray<MappingEvent>, E>,
) =>
  Effect.gen(function* () {
    const system = yield* decidedOn(accountId, operation)
    const writes = (yield* Tiles).writes(accountId)
    const events = yield* Effect.fromResult(decided(system, yield* writes.newId))
    yield* Effect.forEach(events, written(writes), { discard: true })
    return { events, system: events.reduce(evolve, system) } satisfies Operated
  })

/** The Tile of this id, as an Operation leaves it, for a change that answers it. */
const answered = ({ system }: Operated, id: string | undefined) => {
  const found = id === undefined ? undefined : tileAt(system, id)
  if (found === undefined) return Effect.die(new Error('A change lost the Tile it answers'))
  const { title, preview, body } = found
  return Effect.succeed({ id: found.id, title, preview, body } satisfies Tile)
}

/**
 * Adds a Tile in a free slot under a Tile of the System, never under a Leaf: a Branch, a Leaf, or a
 * Tile of its Context, and answers it. An import gives it what it keeps from its files, each part
 * already checked (`entities/kept/`); nothing else does, and no later change touches them. The id
 * the Operation may carry is not honoured yet: the repository makes it.
 */
export const createTile = (accountId: string, operation: CreateTile, kept: ToKeep = {}) =>
  Effect.flatMap(
    operate(accountId, operation, (system, id) => decide(system, { ...operation, id, kept })),
    (operated) => answered(operated, operated.events.find(isTileCreated)?.id),
  )

/** Changes what a Tile says, any of its Title, its Preview and its Body as given, and answers it. */
export const editTile = (accountId: string, operation: EditTile) =>
  Effect.flatMap(
    operate(accountId, operation, (system) => decide(system, operation)),
    (operated) => answered(operated, operation.id),
  )

/**
 * Moves a Tile, and everything below it, to a free slot under another Tile of the System, never under
 * a Leaf, or to another slot of the same parent. A Leaf slot takes a Tile with nothing below it only,
 * so a Leaf grows into a Branch, and a bare Branch shrinks into a Leaf, by moving. References to it
 * follow, since they hold its id.
 */
export const moveTile = (accountId: string, operation: MoveTile) =>
  Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation)))

/**
 * Two Tiles of the System trade places, each with everything below it: each takes the other's parent
 * and slot, a Branch's, a Leaf's or a Context slot alike. References to them follow, since they hold
 * their ids.
 */
export const swapTiles = (accountId: string, operation: SwapTiles) =>
  Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation)))

/** Deletes a Tile and everything below it. A Reference to any of them stays, broken. */
export const deleteTile = (accountId: string, operation: DeleteTile) =>
  Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation)))

/**
 * Puts a Reference to a Tile of the System in a free Context slot of another, or of itself, never of a
 * Leaf, which has no Context.
 */
export const createReference = (accountId: string, operation: CreateReference) =>
  Effect.asVoid(
    operate(accountId, operation, (system, id) => decide(system, { ...operation, id })),
  )

/** Empties a Context slot holding a Reference; the Tile it pointed at is untouched. */
export const deleteReference = (accountId: string, operation: DeleteReference) =>
  Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation)))
