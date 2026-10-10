// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root is the user. The tiles repository keeps
// the rows (src/repositories/database/tiles/); Mapping decides what an Operation does to the System
// it locked (`decide`, ./operations/), then writes one change per event it made, and publishes them.
// Every operation is for one Account, which the API layer takes from IAM's Session. A change runs in
// the transaction the API layer opens around it (`transactional`): its type requires one. Beside each
// Account's System, every Account reads Help (./help/help.ts), which no change may name.
import { Effect, Result, Struct } from 'effect'

import { Bus } from '#/domains/bus'
import type { InTransaction } from '#/repositories/database/database'
import { type IdTaken, Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { HelpReadOnly, TileIdTaken, TileNotFound } from './errors'
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
  type Version,
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
  type OperationEvent,
  type SwapTiles,
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

/**
 * The Version of the Account's System, how many events changed it, read alone: what a client polls to
 * know when to read the System again. 0 before its first change, its Root not yet added included.
 */
export const systemVersion = (accountId: string) =>
  Tiles.use((tiles) => tiles.systemVersion(accountId))

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
  change: (
    rows: ReadonlyArray<TileRow>,
    writes: Writes,
  ) => Effect.Effect<A, E, InTransaction | Bus>,
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

/** The Version `evolve` gave the Tile of this id, for the row a change writes it to. */
const versionIn = (after: System, id: string) => {
  const found = tileAt(after, id)
  if (found === undefined) return Effect.die(new Error('An event counted on a Tile it lost'))
  return Effect.succeed({ version: found.version })
}

/** Writes the Version `evolve` gave the Tile of this id. */
const counted = (writes: Writes, after: System, id: string) =>
  Effect.flatMap(versionIn(after, id), (version) => writes.update(id, version))

/**
 * Writes one event: the one change to the rows it stands for, each Tile it changed at the Version
 * `evolve` gave it in `after`, the System once the event applied.
 */
const written =
  (writes: Writes, after: System) =>
  (event: OperationEvent): Effect.Effect<void, IdTaken, InTransaction> => {
    switch (event._tag) {
      case 'TileCreated': {
        const { id, parent, slot, title, preview, body, name, config, frontmatter } = event
        const row = { id, parentId: parent, direction: rowDirection(slot), target: null }
        return writes.insert({ ...row, title, preview, body, name, config, frontmatter })
      }
      case 'TileEdited':
        return Effect.flatMap(versionIn(after, event.id), (version) =>
          writes.update(event.id, { ...Struct.omit(event, ['_tag', 'id']), ...version }),
        )
      case 'TileMoved':
        return Effect.flatMap(versionIn(after, event.id), (version) =>
          writes.update(event.id, {
            parentId: event.parent,
            direction: rowDirection(event.slot),
            ...version,
          }),
        )
      case 'TilesSwapped':
        return Effect.andThen(
          writes.swap(event.a, event.b),
          Effect.all([counted(writes, after, event.a), counted(writes, after, event.b)], {
            discard: true,
          }),
        )
      case 'TileDeleted':
        return writes.remove(event.id)
      case 'ReferenceDeleted':
        return Effect.andThen(writes.remove(event.id), counted(writes, after, event.parent))
      case 'ReferenceCreated': {
        const { id, parent, slot, target } = event
        return Effect.andThen(
          writes.insert({ id, parentId: parent, direction: slot, target, ...untitled }),
          counted(writes, after, parent),
        )
      }
    }
  }

/**
 * What a write under an id a Tile of any System already has answers. An id Mapping made itself
 * (`Tiles.newId`) is fresh, so its clash is a defect (`madeHere`); one a create's caller chose may be
 * anyone's, and is refused `TileIdTaken` (`chosen`), saying nothing of where that Tile is.
 */
type OnTaken<T> = (taken: IdTaken) => Effect.Effect<never, T>

const madeHere: OnTaken<never> = (taken) => Effect.die(taken)

const chosen: OnTaken<TileIdTaken> = () => Effect.fail(new TileIdTaken())

/**
 * Ends a change that made these events, written already: writes the System's Version as `evolve` left
 * it in `after`, then publishes them. A change that made none leaves the Version where it was. The
 * bus holds what is published until the transaction commits. `landing/`'s import ends this way too.
 */
export const published = (
  writes: Writes,
  { after, events }: { after: System; events: ReadonlyArray<MappingEvent> },
) =>
  events.length === 0
    ? Effect.void
    : Effect.gen(function* () {
        yield* writes.systemVersion(after.version)
        const { publish } = yield* Bus
        yield* Effect.forEach(events, publish, { discard: true })
      })

/**
 * Runs an Operation on the Account's System: locks it, loads it flat, asks `decide` through `decided`,
 * then writes one change per event, as `evolve` leaves the System after it, and the System's Version,
 * publishes the events, and answers the System they leave. Every rule lives in `decide`: what it refuses is refused here, with nothing written and
 * nothing published. A write under an id already taken answers `onTaken`: a defect, unless the
 * Operation's caller chose the id. The bus holds what is published until the transaction commits.
 */
const operate = <E, T = never>(
  accountId: string,
  operation: Operation,
  decided: (system: System) => Result.Result<ReadonlyArray<OperationEvent>, E>,
  onTaken: OnTaken<T> = madeHere,
) =>
  Effect.gen(function* () {
    const system = yield* decidedOn(accountId, operation)
    const writes = (yield* Tiles).writes(accountId)
    const events = yield* Effect.fromResult(decided(system))
    let after = system
    for (const event of events) {
      after = evolve(after, event)
      yield* Effect.catchTag(written(writes, after)(event), 'IdTaken', onTaken)
    }
    yield* published(writes, { after, events })
    return after
  })

/** A fresh id, for what a create makes when its caller chose none, before `decide` is given it. */
const newId = Tiles.use((tiles) => tiles.newId)

/**
 * The Tile of this id, as an Operation leaves it, for a change that answers it: with its Version, which
 * the writer's next write to it names.
 */
const answered = (system: System, id: string) => {
  const found = tileAt(system, id)
  if (found === undefined) return Effect.die(new Error('A change lost the Tile it answers'))
  const { title, preview, body, version } = found
  return Effect.succeed({ id: found.id, title, preview, body, version } satisfies Tile & {
    version: Version
  })
}

/**
 * Adds a Tile in a free slot under a Tile of the System, never under a Leaf: a Branch, a Leaf, or a
 * Tile of its Context, and answers it. Its id is the one the Operation carries, which its caller
 * chose so it can name the Tile before the answer comes: a Tile's already, in any System, is
 * `TileIdTaken`, and nothing is written. Without one, Mapping makes it, and its clash is a defect,
 * never a refusal. An import gives it what it keeps from its files, each part already checked
 * (`entities/kept/`); nothing else does, and no later change touches them.
 */
export const createTile = (accountId: string, operation: CreateTile, kept: ToKeep = {}) =>
  Effect.gen(function* () {
    const id = operation.id ?? (yield* newId)
    const onTaken: OnTaken<TileIdTaken> = operation.id === undefined ? madeHere : chosen
    const made = { id, kept }
    const after = yield* operate(
      accountId,
      operation,
      (system) => decide(system, operation, made),
      onTaken,
    )
    return yield* answered(after, id)
  })

/** Changes what a Tile says, any of its Title, its Preview and its Body as given, and answers it. */
export const editTile = (accountId: string, operation: EditTile) =>
  Effect.flatMap(
    operate(accountId, operation, (system) => decide(system, operation)),
    (system) => answered(system, operation.id),
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
  Effect.flatMap(newId, (id) =>
    Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation, { id }))),
  )

/** Empties a Context slot holding a Reference; the Tile it pointed at is untouched. */
export const deleteReference = (accountId: string, operation: DeleteReference) =>
  Effect.asVoid(operate(accountId, operation, (system) => decide(system, operation)))
