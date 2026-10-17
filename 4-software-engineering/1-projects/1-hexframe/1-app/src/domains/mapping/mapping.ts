// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root is the user. The tiles repository keeps
// the rows (src/repositories/database/tiles/); Mapping decides what an Operation does to the System
// it locked (`decide`, ./operations/), then writes one change per event it made, and publishes them.
// Every operation is for one Account, which the API layer takes from IAM's Session. A change runs in
// the transaction the API layer opens around it (`transactional`): its type requires one. Beside each
// Account's System, every Account reads the Systems hexframe ships, Help and the tutorial
// (./shipped/shipped.ts), which no change may name.
import { Effect, Result, Struct } from 'effect'

import { Bus } from '#/domains/bus'
import type { InTransaction } from '#/repositories/database/database'
import { type IdTaken, Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { BatchOutdated, ShippedReadOnly, TileIdTaken, TileNotFound } from './errors'
import { type LinkOf, exportOf, placesOf } from './files/files'
import {
  findInShipped,
  flatShipped,
  isShippedId,
  type ShippedLanguage,
  shippedOf,
} from './shipped/shipped'
import {
  type Content,
  type Depth,
  type Field,
  type FieldsAsked,
  type Found,
  foundIn,
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
  added,
  type Batched,
  type CreateReference,
  type CreateTile,
  decide,
  decidedOne,
  type DeleteReference,
  type DeleteTile,
  type EditTile,
  evolve,
  fold,
  type MappingEvent,
  type MoveTile,
  type Operation,
  type OperationEvent,
  summariesIn,
  summaryOf,
  type SwapTiles,
  type Undo,
  undone,
  undoOf,
  untitledIn,
  whole,
  extended,
} from './operations'

export { HelpId, helpRoot, type ShippedRoot, shippedSystem, tutorialRoot } from './shipped/shipped'

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
  Tiles.use((tiles) => Effect.map(tiles.systemVersion(accountId), (version) => version ?? 0))

/**
 * The Titles of the Tiles of the Account's System among these ids, by id: an id it holds no Tile of,
 * a deleted one's or a Reference's, has none. What the timeline names a Tile by where it keeps its id.
 */
export const titles = (accountId: string, ids: ReadonlyArray<string>) =>
  Tiles.use((tiles) =>
    Effect.map(tiles.ofIds(accountId, ids, ['title']), (rows) =>
      Object.fromEntries(
        rows.flatMap(({ id, target, title }) => (target === null ? [[id, title] as const] : [])),
      ),
    ),
  )

/** Nothing when the id is a Tile of the Account's own System, else `TileNotFound`. */
export const ownTile = (accountId: string, id: string) =>
  Effect.flatMap(titles(accountId, [id]), (titled) =>
    id in titled ? Effect.void : Effect.fail(new TileNotFound()),
  )

/**
 * The Title and Preview of the Tiles of the Account's System among these ids, in their order: an id it
 * holds no Tile of, a deleted one's or a Reference's, is left out: a glimpse of each, for a reader
 * shown several at once.
 */
export const glimpses = (accountId: string, ids: ReadonlyArray<string>) =>
  Tiles.use((tiles) =>
    Effect.map(tiles.ofIds(accountId, ids, ['title', 'preview']), (rows) => {
      const found = new Map(
        rows.flatMap(({ id, target, title, preview }) =>
          target === null ? [[id, { id, title, preview }] as const] : [],
        ),
      )
      return [...new Set(ids)].flatMap((id) => {
        const glimpse = found.get(id)
        return glimpse === undefined ? [] : [glimpse]
      })
    }),
  )

/**
 * Summarizes one of Mapping's events, for the Account whose System it changed (`summaryOf`). A Title
 * the event does not say is read as the System holds it now, after the change; a deleted Tile's comes
 * from its event, since no read finds it.
 */
export const summary = (accountId: string, event: MappingEvent) =>
  Effect.map(titles(accountId, untitledIn(event)), (read) =>
    summaryOf(event, (id) => read[id] ?? ''),
  )

/** A Tile read from, with the id and Title of its parent, `null` for the Root. */
interface Read<F extends Field> {
  readonly tile: ReadTile<F>
  readonly parent: Pick<Tile, 'id' | 'title'> | null
}

/**
 * Where a read starts, how far down it goes, what it asks of each Tile, and the language of a System
 * hexframe ships; and the batch it shows folded over the System, Operations kept to run later, none
 * when it reads the System as it stands.
 */
interface ReadFrom<O extends Field, F extends Field> {
  readonly id?: string | undefined
  readonly depth: Depth
  readonly fields: FieldsAsked<O, F>
  readonly language: ShippedLanguage
  readonly over?: ReadonlyArray<Batched> | undefined
}

/**
 * What a read from a Tile of the Account's System finds, its Root when no id is given, or from a Tile
 * of a System hexframe ships by its id, `depth` generations down, with only the fields asked of the
 * Tile and of each Tile below it. A Tile of another System is `TileNotFound`, as is an id of a shipped
 * System that none of its Tiles has. Reading the Root adds it.
 */
const find = <O extends Field, F extends Field>(
  accountId: string,
  { id, depth, fields, language, over = [] }: ReadFrom<O, F>,
): Effect.Effect<Found<O, F>, TileNotFound, Tiles> => {
  const shipped = id === undefined ? undefined : shippedOf(id)
  if (id !== undefined && shipped !== undefined)
    return findInShipped(shipped, id, { fields, language })
  if (over.length === 0) return findOwn(accountId, { id, depth, fields })
  return Effect.flatMap(system(accountId), (held) => {
    const found = foundIn(fold(held, over).system, { id, depth, fields })
    return found === undefined ? Effect.fail(new TileNotFound()) : Effect.succeed(found)
  })
}

/** What a reader sees of a Tile beside the one opened: enough to decide whether to open it. */
const glimpsed = ['title', 'preview'] as const satisfies ReadonlyArray<Field>

/** What a read from a Tile of the Account's System finds, its Root when no id is given. */
const findOwn = <O extends Field, F extends Field>(
  accountId: string,
  { id, depth, fields }: Omit<ReadFrom<O, F>, 'language' | 'over'>,
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
 * A Tile of the Account's System, its Root when no id is given, or a Tile of a System hexframe ships,
 * Help or the tutorial, by its id, read `depth` generations down with only the fields asked of each
 * Tile, and its parent. A Reference shows the id, Title and Preview of the Tile it points at. A Body is
 * read only when asked, and a Tile of another System is `TileNotFound`, as is an id of a shipped
 * System that none of its Tiles has. A shipped System is read in `language`, which the caller picks.
 * Reading the Root adds it, as `system` does. With a batch `over` it, the System it reads is the one
 * the batch makes (`fold`).
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
 * A Tile of the Account's System, its Root when no id is given, or a Tile of a System hexframe ships
 * by its id, opened: it with only the fields asked, its parent, and its Branches, Leaves and Context
 * by Title and Preview, as a reader opens a Tile before deciding which of them to open next. One read,
 * one generation down, and a Body below the Tile never leaves the database. With a batch `over` it,
 * the System it reads is the one the batch makes (`fold`).
 */
export const openTile = <F extends Field>(
  accountId: string,
  {
    id,
    fields,
    language,
    over,
  }: Pick<ReadFrom<F, F>, 'id' | 'language' | 'over'> & {
    readonly fields: ReadonlyArray<F>
  },
) =>
  Effect.map(
    find(accountId, {
      id,
      depth: 1,
      fields: { opened: [...new Set([...fields, ...glimpsed])], below: glimpsed },
      language,
      over,
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
 * The Account's System as files, the export of its Root, and where each of its Tiles lives in them,
 * by id, both from one read, so a reader of the files finds a Tile's folder or file by its id. `link`
 * is where the app shows a Tile, for a Reference whose Tile is gone. With a batch `over` it, the
 * System the batch makes (`fold`), as the reads through it show it.
 */
export const systemFiles = (accountId: string, link: LinkOf, over: ReadonlyArray<Batched> = []) =>
  Effect.gen(function* () {
    const whole = systemOf(fold(yield* system(accountId), over).system)
    const exported = exportOf(whole, whole.id, link)
    if (exported === undefined) return yield* Effect.die(new Error('A System exports its Root'))
    return { files: exported.files, places: placesOf(whole) }
  })

/**
 * Refuses a change that names a Tile of a System hexframe ships, Help or the tutorial, whichever
 * schema let its ids through: each is read by every Account and written by none.
 */
const outsideShipped = (ids: ReadonlyArray<string>) =>
  ids.some(isShippedId) ? Effect.fail(new ShippedReadOnly()) : Effect.void

/**
 * Ends a change that made these events, written already: writes the System's Version as `evolve` left
 * it in `after`, then publishes them. A change that made none leaves the Version where it was. The
 * bus holds what is published until the transaction commits. `changing` ends
 * `landing/`'s import this way too.
 */
const ended = (
  writes: Writes,
  { after, events }: { after: System; events: ReadonlyArray<MappingEvent> },
) =>
  events.length === 0
    ? Effect.void
    : Effect.gen(function* () {
        yield* writes.setSystemVersion(after.version)
        const { publish } = yield* Bus
        yield* Effect.forEach(events, publish, { discard: true })
      })

/**
 * What a change that is no Operation answers once it wrote its rows: its own `answer`, and the events
 * it made, which `changing` folds through `evolve` and ends it with.
 */
export interface Changed<A> {
  readonly answer: A
  readonly events: ReadonlyArray<MappingEvent>
}

/**
 * A change to the Account's System that is no Operation, `landing/`'s import, naming these Tiles, none
 * of them a shipped System's, on its rows as they stand once its Root is locked: alone until the transaction
 * around it ends, so what it checked still holds when it writes. Once it wrote its rows, it is ended
 * as an Operation is: the System's Version it leaves written, its events published.
 */
export const changing = <A, E>(
  accountId: string,
  names: ReadonlyArray<string>,
  change: (
    rows: ReadonlyArray<TileRow>,
    writes: Writes,
  ) => Effect.Effect<Changed<A>, E, InTransaction>,
) =>
  Effect.andThen(
    outsideShipped(names),
    Tiles.use((tiles) =>
      Effect.gen(function* () {
        const writes = tiles.writes(accountId)
        const rows = yield* tiles.lock(accountId)
        const { answer, events } = yield* change(rows, writes)
        const before = yield* rooted(systemFrom(rows, { owned: true }))
        yield* ended(writes, { after: events.reduce(evolve, before), events })
        return answer
      }),
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
 * The System an Operation is decided on. The System hexframe ships whose Tile it names, Help's or the
 * tutorial's, whichever end of a move or a swap, which no Account owns, so `decide` refuses it.
 * Otherwise the Account's, its Root added on its first read as any read adds it, then locked until the
 * transaction ends: no other change runs meanwhile, so what `decide` ruled on still holds when its
 * events are written.
 */
const decidedOn = (accountId: string, operation: Operation) => {
  const shipped = namedBy(operation)
    .map(shippedOf)
    .find((root) => root !== undefined)
  return shipped === undefined ? locked(accountId) : rooted(flatShipped(shipped, 'en'))
}

/**
 * The Account's System, its Root added on its first read as any read adds it, then locked until the
 * transaction ends: no other change runs meanwhile.
 */
const locked = (accountId: string) =>
  Tiles.use((tiles) =>
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
 * Runs an Operation on the Account's System: locks it, loads it flat, asks `decide` through `decided`,
 * then writes one change per event, as `evolve` leaves the System after it, and the System's Version,
 * publishes the events, and answers the System it ran on, the events and the System they leave. Every rule lives in `decide`: what it
 * refuses is refused here, with nothing written and nothing published. A write under an id already taken answers `onTaken`: a defect, unless the
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
    const events = yield* Effect.fromResult(decided(system))
    return { system, events, after: yield* writtenAll(accountId, system, events, onTaken) }
  })

/**
 * Writes the events a change made on the System it locked, one change each, as `evolve` leaves the
 * System after it, then ends it (`ended`), and answers the System they leave. A write under an id
 * already taken answers `onTaken`.
 */
const writtenAll = <T>(
  accountId: string,
  system: System,
  events: ReadonlyArray<OperationEvent>,
  onTaken: OnTaken<T>,
) =>
  Effect.gen(function* () {
    const writes = (yield* Tiles).writes(accountId)
    let after = system
    for (const event of events) {
      after = evolve(after, event)
      yield* Effect.catchTag(written(writes, after)(event), 'IdTaken', onTaken)
    }
    yield* ended(writes, { after, events })
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
    const { after } = yield* operate(
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
    ({ after }) => answered(after, operation.id),
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

/** The id of what an Operation makes, a create's own when it carries one, else a fresh one; none for others. */
const madeFor = (operation: Operation) =>
  operation._tag === 'CreateTile' && operation.id !== undefined
    ? Effect.succeed<string | undefined>(operation.id)
    : operation._tag === 'CreateTile' || operation._tag === 'CreateReference'
      ? newId
      : Effect.succeed(undefined)

/** The Tile a change answers, for a create or an edit, as it leaves the System, with its Version. */
const tileAnswered = (after: System, operation: Operation, made: string | undefined) => {
  if (operation._tag === 'CreateTile' && made !== undefined) return answered(after, made)
  if (operation._tag === 'EditTile') return answered(after, operation.id)
  return Effect.succeed(undefined)
}

/**
 * Adds an Operation to a batch kept over the Account's System, writing nothing: `BatchOutdated` once
 * the batch no longer applies whole (`whole`), so nothing is added to a batch that can no longer run;
 * else decided by `decide` on the System the batch makes, refused as it would be there, a create given
 * the id of what it makes now, fresh, so it keeps that id each time the batch is folded again. Answers
 * it as the batch keeps it, Mapping's summary of each event it makes there, and, for a create or an
 * edit, the Tile as the batch now makes it, with its Version, which the writer's next write to it
 * names. `decide` refuses each Operation only what its overload says, so the refusal is typed by it.
 */
export const addToBatch = <O extends Operation>(
  accountId: string,
  over: ReadonlyArray<Batched>,
  operation: O,
) =>
  Effect.gen(function* () {
    yield* outsideShipped(namedBy(operation))
    const folded = yield* Effect.fromResult(whole(yield* system(accountId), over))
    const made = yield* madeFor(operation)
    const next = yield* Effect.fromResult(added(folded, operation, made))
    const tile = yield* tileAnswered(next.system, operation, made)
    return {
      batched: next.batched,
      changes: summariesIn(next.system, next.events),
      ...(tile !== undefined && { tile }),
    }
  })

/**
 * Runs a batch on the Account's System as it stands, its Root locked, all of it or nothing, folded by
 * `folding`: one that no longer applies refuses the whole, `BatchOutdated`, nothing written nor
 * published; else every event is written and published as an Operation's are, a write under an id
 * already taken answering `onTaken`. Answers the System it ran on and the events it made.
 */
const ranWhole = <T>(
  accountId: string,
  batch: ReadonlyArray<Batched>,
  { folding, onTaken }: { folding: typeof whole; onTaken: OnTaken<T> },
) =>
  Effect.gen(function* () {
    yield* outsideShipped(batch.flatMap(({ operation }) => namedBy(operation)))
    const system = yield* locked(accountId)
    const { events } = yield* Effect.fromResult(folding(system, batch))
    yield* writtenAll(accountId, system, events, onTaken)
    return { system, events }
  })

/**
 * Runs a batch on the Account's System, in the transaction around it, all of it or nothing: its Root
 * locked, the batch folded over the System as it stands, each Operation decided on what the ones
 * before it made, a create under the id it was added with. One that no longer applies, a Tile it
 * names changed since, by the Version it carries, or gone, refuses the whole batch, `BatchOutdated`,
 * nothing written nor published (`whole`); else every event is written and published as an
 * Operation's are. A batch naming a Tile of a System hexframe ships is `ShippedReadOnly`. Answers how
 * many events it made and what undoes it (`undoOf`), from the System it ran on.
 */
export const runBatch = (accountId: string, batch: ReadonlyArray<Batched>) =>
  Effect.map(
    ranWhole(accountId, batch, { folding: whole, onTaken: madeHere }),
    ({ system, events }) => ({
      undo: undoOf(system, events),
      changes: events.length,
    }),
  )

/**
 * Runs an Operation on the Account's System by the same `operate` as an Operation's own function, a
 * create under its id or a fresh one, and answers, beside the Tile as it now stands for a create or
 * an edit, how many events it made and what undoes it: its inverse, from the System it ran on, after
 * `earlier`, the undo of what ran before it in the same batch, when one is given (`extended`), as a
 * batch that runs in several goes runs one Operation after the other. A clash on a create's id is a
 * defect: such a create carries none.
 */
export const runOperation = <O extends Operation>(
  accountId: string,
  operation: O,
  earlier: Undo | undefined,
) =>
  Effect.gen(function* () {
    const made = yield* madeFor(operation)
    const { system, events, after } = yield* operate(accountId, operation, (held) =>
      Result.map(decidedOne(held, operation, made), (next) => next.events),
    )
    const tile = yield* tileAnswered(after, operation, made)
    const undo = earlier === undefined ? undoOf(system, events) : extended(earlier, system, events)
    return { undo, changes: events.length, ...(tile !== undefined && { tile }) }
  })

/**
 * Undoes a batch that ran, in the transaction around it, all of it or nothing: its inverse run on the
 * Account's System as it stands, under its Root's lock, each event written and published as an
 * Operation's are. Refused whole, `BatchOutdated`, once a Tile it touched changed since, by the Version
 * its inverse names, or a Tile it made holds what another writer put below it since (`undone`), or the
 * undo was `Outdated` already: nothing written nor published.
 */
export const undo = (accountId: string, undoing: Undo) =>
  undoing._tag === 'Outdated'
    ? Effect.fail(new BatchOutdated())
    : Effect.asVoid(
        ranWhole(accountId, undoing.batch, {
          folding: undone,
          onTaken: () => Effect.fail(new BatchOutdated()),
        }),
      )
