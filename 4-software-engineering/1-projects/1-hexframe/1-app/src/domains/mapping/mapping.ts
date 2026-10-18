// Mapping: someone lays out a System they maintain as a hierarchy of Tiles, where what comes first is
// what matters most. Each Account has one System, whose Root, its star, is the user. The tiles
// repository keeps the rows (src/repositories/database/tiles/); Mapping decides what an Operation
// does to the System it locked (`decide`, ./operations/), then writes one change per event it made,
// and publishes them. Every read and every change is `Acting`: an actor, who acts, on a System,
// named by its star, which the API layer resolves from the request; Mapping asks `may` what the
// actor may read and do there, from the Grants its Tiles carry (./operations/rights/). A change runs
// in the transaction the API layer opens around it (`transactional`): its type requires one. Beside
// the Systems it reaches, every actor reads the Systems hexframe ships, Help and the tutorial
// (./shipped/shipped.ts), mounted under the Hexframe Organization's star (./shipped/mount.ts), which
// no change may write.
import { Effect, Result, Struct } from 'effect'

import { Bus } from '#/domains/bus'
import type { InTransaction } from '#/repositories/database/database'
import { type IdTaken, Tiles, type TileRow, type Writes } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { BatchOutdated, Shipped, TileIdTaken, TileNotFound } from './errors'
import {
  type Acting,
  type Across,
  grantsIn,
  outside,
  ownerOf,
  pinnedFor,
  pinnedShown,
  pinning,
  reading,
  seenThrough,
  titles,
  titlesAcross,
  wholeOf,
} from './sharing/reading'
import { acrossFolder, type LinkOf, exportOf, seenFiles } from './files/files'
import { withMounted } from './shipped/mount'
import { findInShipped, type ShippedLanguage } from './shipped/shipped'
import {
  type Content,
  type Depth,
  type Field,
  type FieldsAsked,
  type Found,
  acrossGaps,
  anyone,
  foundInSeen,
  hexframeStar,
  isShippedId,
  lineageOf,
  owns,
  readOf,
  type ReadTile,
  carded,
  shippedOf,
  rowDirection,
  seenBy,
  sharingOf,
  showing,
  type System,
  systemFrom,
  systemOf,
  type Tile,
  tileAt,
  type ToKeep,
  pointing,
  pointsAt,
  type Version,
  withContent,
} from './entities'
import {
  added,
  allowed,
  allowedBatch,
  allowedStep,
  allowedThrough,
  type Batched,
  type CreateReference,
  type CreateTile,
  decide,
  decidedOne,
  type DeleteReference,
  type DeleteTile,
  type EditTile,
  evolve,
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
  writtenAt,
  extended,
} from './operations'

export { HelpId, helpRoot, shippedSystem } from './shipped/shipped'
export type { Acting, Across } from './sharing/reading'
export {
  agentAt,
  agentStillAt,
  glimpses,
  grantsIn,
  holding,
  ownerOf,
  ownTile,
  shownTile,
  titles,
  titlesAcross,
  wholeOf,
} from './sharing/reading'

/** The content of a Root nobody has named yet, and of every Reference, which keeps none of its own. */
export const untitled: Content = { title: '', preview: '', body: '' }

/**
 * The star of the owner's System, the id of its Root, added untitled on the first read, until the
 * user names it; any later read, or two at once, finds that one. What the API layer names an
 * Account's own System by. Who acts on it is the API layer's to say, from IAM.
 */
export const starOf = (owner: string) => Tiles.use((tiles) => tiles.root(owner, untitled))

/**
 * The owner of the System the actor acts on, once Mapping found the actor stands for it: what a read
 * of the System whole, a batch and an import ask, which only its owner makes until they read and
 * write as the actor may (`hexframe-app-sharing-organizations/decisions.md#DEC-2`). Anyone else is
 * `TileNotFound`, as is a star that names none, so nothing says whether it exists.
 */
const reached = ({ actor, system }: Acting) =>
  Effect.flatMap(ownerOf(system), (owner) =>
    owns(actor, owner) ? Effect.succeed(owner) : Effect.fail(new TileNotFound()),
  )

/**
 * The System the actor acts on, flat, as they may see it (`Seen`): its Root, its star, and every Tile
 * and Reference below it they may read, by id, Bodies included, at the System's Version, each Tile
 * with the actor's rights on it; the star as its card, its Title and Preview, when they may not read
 * it; a Tile below one they may not read placed under the star, the gap marked; and the Tiles of
 * other Systems its References point at that they may read there (`pinnedFor`), unless a read
 * resolves none (`Across`). Its owner reads it whole, in one query as before. The Hexframe
 * Organization's holds the Systems hexframe ships mounted under its star, and a pin may be one of
 * their Tiles: each read in `language`, English by default. `systemOf` builds its tree.
 * `TileNotFound` for a star that names no System.
 */
export const system = (
  { actor, system: star }: Acting,
  { across = true, language = 'en' }: Across & { readonly language?: ShippedLanguage } = {},
) =>
  Effect.gen(function* () {
    const owner = yield* ownerOf(star)
    const whole = yield* wholeOf(owner, language)
    const grants = owns(actor, owner) ? [] : yield* grantsIn(owner)
    const pinned = across ? yield* pinnedFor(actor, outside(whole), star, language) : {}
    return seenBy(actor, whole, sharingOf(owner, lineageOf(whole), grants), pinned)
  })

/**
 * The System the actor acts on, flat and whole, its owner's read alone (`reached`): what an export
 * reads, until it reads as the actor may.
 */
const ownersWhole = (acting: Acting) => Effect.flatMap(reached(acting), wholeOf)

/**
 * The Version of the System the actor acts on, as they are shown it: what a client polls to know when
 * to read the System again. Its owner's is how many events changed it, read alone, 0 before its first
 * change; anyone else's how what they see of it stands (`sightVersion`), read as `system` reads it,
 * since a count of the System's changes would tell of the Tiles kept from them.
 */
export const systemVersion = (acting: Acting) =>
  Effect.flatMap(ownerOf(acting.system), (owner) =>
    owns(acting.actor, owner)
      ? Tiles.use((tiles) => Effect.map(tiles.systemVersion(owner), (version) => version ?? 0))
      : Effect.map(system(acting), ({ version }) => version),
  )

/**
 * Summarizes one of Mapping's events, on the System it changed, which the actor acts on
 * (`summaryOf`), for the actor's own timeline. A Title the event does not say is read as the System
 * holds it now, after the change, or, a pin's, as another System holds it, as the actor may see it
 * there (`titlesAcross`); a deleted Tile's comes from its event, since no read finds it.
 */
export const summary = (acting: Acting, event: MappingEvent) =>
  Effect.map(titlesAcross(acting, untitledIn(event)), (read) =>
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
interface ReadFrom<O extends Field, F extends Field> extends Across {
  readonly id?: string | undefined
  readonly depth: Depth
  readonly fields: FieldsAsked<O, F>
  readonly language: ShippedLanguage
  readonly over?: ReadonlyArray<Batched> | undefined
}

/**
 * What a read from a Tile of the System the actor acts on finds, its star when no id is given, or
 * from a Tile of a System hexframe ships by its id, `depth` generations down, with only the fields
 * asked of the Tile and of each Tile below it. A Tile the actor may not read is `TileNotFound`, as is
 * an id of a shipped System that none of its Tiles has. A shipped Tile is read from the bundle, by its
 * id alone, wherever the read works, a Turn's included, its Root's parent the Hexframe star, by its
 * card, which anyone sees; from the Hexframe star, its System is read whole, with them mounted.
 */
const find = <O extends Field, F extends Field>(
  acting: Acting,
  { id, depth, fields, language, over = [], across }: ReadFrom<O, F>,
): Effect.Effect<Found<O, F>, TileNotFound, Tiles> => {
  const shipped = id === undefined ? undefined : shippedOf(id)
  if (id !== undefined && shipped !== undefined)
    return Effect.flatMap(findInShipped(shipped, id, { fields, language }), mountedParent)
  if (over.length === 0 && acting.system === hexframeStar)
    return findMounted(acting, { id, depth, fields, across, language })
  if (over.length === 0) return findOwn(acting, { id, depth, fields, across })
  // A Turn reads through its batch, as the actor may see the System it makes (`seenThrough`).
  return Effect.flatMap(seenThrough(acting, over), (seen) => {
    const found = foundInSeen(seen, { id, depth, fields })
    return found === undefined ? Effect.fail(new TileNotFound()) : Effect.succeed(found)
  })
}

/**
 * A read from a Tile hexframe ships, its Root's parent the star it is mounted under, the Hexframe
 * star, by its Title, which anyone sees on its card.
 */
const mountedParent = <O extends Field, F extends Field>(found: Found<O, F>) =>
  found.parent !== null
    ? Effect.succeed(found)
    : Effect.map(
        titles({ actor: anyone, system: hexframeStar }, [hexframeStar]),
        (named): Found<O, F> => ({
          ...found,
          parent: { id: hexframeStar, title: named[hexframeStar] ?? '' },
        }),
      )

/**
 * What a read from a Tile of the Hexframe Organization's System finds, its star when no id is given:
 * that System read whole as the actor may see it (`system`), the Systems hexframe ships mounted under
 * its star in `language`, then the read made in it, the star as its card when they may not read it.
 */
const findMounted = <O extends Field, F extends Field>(
  acting: Acting,
  { id, depth, fields, across, language }: Omit<ReadFrom<O, F>, 'over'>,
) =>
  Effect.flatMap(system(acting, { across, language }), (seen) => {
    const found = foundInSeen(seen, { id, depth, fields })
    return found === undefined
      ? Effect.fail(new TileNotFound())
      : Effect.succeed({ ...found, pinned: seen.pinned } satisfies Found<O, F>)
  })

/** What a reader sees of a Tile beside the one opened: enough to decide whether to open it. */
const glimpsed = ['title', 'preview'] as const satisfies ReadonlyArray<Field>

/**
 * What a read from a Tile of the System the actor acts on finds, its star when no id is given: only
 * what the actor may read, the star as its card when they may not read it, its Body empty, and the
 * Tile's parent none when they may not read it, the star's Title being anyone's; each Reference they
 * may read with the Tile it points at, of the System or another's they may read there (`pinnedFor`,
 * unless `across` says none), else unavailable, its target told to the System's owner alone.
 */
const findOwn = <O extends Field, F extends Field>(
  acting: Acting,
  { id, depth, fields, across = true }: Omit<ReadFrom<O, F>, 'language' | 'over'>,
) =>
  Tiles.use((tiles) =>
    Effect.gen(function* () {
      const { owner, reads, shows } = yield* reading(acting)
      const from = id ?? acting.system
      if (!shows(from)) return yield* new TileNotFound()
      const found = yield* tiles.generationsFrom(owner, { id: from, depth, columns: fields })
      // A Reference's row is no Tile: its id names nothing to open.
      if (found === undefined || found.opened.target !== null) return yield* new TileNotFound()
      // The star's card, when the actor may not read it: its Title and Preview, never its Body.
      const opened = reads(from) ? found.opened : carded(found.opened)
      // What the actor may not read is left out, and what stands below it with it.
      const below = found.below.filter((row) => reads(row.id))
      const targets = below.flatMap(({ target }) => (target === null ? [] : [target]))
      const parentIds = opened.parentId === null || !shows(opened.parentId) ? [] : [opened.parentId]
      const [parents, pointedAt] = yield* Effect.all(
        [
          tiles.ofIds(owner, parentIds, ['title']),
          tiles.ofIds(owner, targets.filter(shows), glimpsed),
        ],
        { concurrency: 'unbounded' },
      )
      const here = new Set(pointedAt.flatMap((row) => (row.target === null ? [row.id] : [])))
      const away = targets.filter((target) => !here.has(target))
      const pinned = across ? yield* pinnedFor(acting.actor, away, acting.system) : {}
      // A Reference to no Tile they are shown says nothing of it, to its System's owner either.
      const shown = pointsAt((target) => here.has(target), pinned)
      const parent = parents[0]
      return {
        opened: withContent(opened, fields.opened),
        rows: below.map((row) => withContent(pointing(row, shown), fields.below)),
        pointedAt: pointedAt.map((row) => withContent(row, glimpsed)),
        pinned,
        parent: parent === undefined ? null : { id: parent.id, title: parent.title },
      } satisfies Found<O, F>
    }),
  )

/**
 * A Tile of the System the actor acts on, its star when no id is given, or a Tile of a System
 * hexframe ships, Help or the tutorial, by its id, read `depth` generations down with only the fields
 * asked of each Tile, and its parent. A Reference shows the id, Title and Preview of the Tile it
 * points at. A Body is read only when asked. A Tile the actor may not read is `TileNotFound`, as is
 * an id of a shipped System that none of its Tiles has, and what lies below the Tile is left out
 * where they may not read it. A shipped System is read in `language`, which the caller picks. With a
 * batch `over` it, the System it reads is the one the batch makes (`fold`).
 */
export const readTile = <F extends Field>(
  acting: Acting,
  { fields, ...from }: Omit<ReadFrom<F, F>, 'fields'> & { readonly fields: ReadonlyArray<F> },
) =>
  Effect.map(
    find(acting, { ...from, fields: { opened: fields, below: fields } }),
    ({ opened, rows, pointedAt, pinned, parent }): Read<F> => ({
      tile: readOf(opened, { rows, depth: from.depth, pointedAt, pinned }),
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
 * A Tile of the System the actor acts on, its star when no id is given, or a Tile of a System
 * hexframe ships by its id, opened: it with only the fields asked, its parent, and its Branches, Leaves and Context
 * by Title and Preview, as a reader opens a Tile before deciding which of them to open next. One read,
 * one generation down, and a Body below the Tile never leaves the database. With a batch `over` it,
 * the System it reads is the one the batch makes (`fold`).
 */
export const openTile = <F extends Field>(
  acting: Acting,
  {
    id,
    fields,
    language,
    over,
    across,
  }: Pick<ReadFrom<F, F>, 'id' | 'language' | 'over' | 'across'> & {
    readonly fields: ReadonlyArray<F>
  },
) =>
  Effect.map(
    find(acting, {
      id,
      depth: 1,
      fields: { opened: [...new Set([...fields, ...glimpsed])], below: glimpsed },
      language,
      over,
      across,
    }),
    ({ opened, rows, pointedAt, pinned, parent }): Opened<F> => {
      const around = readOf(showing(opened, glimpsed), { rows, depth: 1, pointedAt, pinned })
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
 * The Tile of this id in the System the actor acts on, and everything below it, zipped: the archive's
 * name, `<slug>.zip`, its Tile's slug, and its bytes, streamed as they are zipped. A Tile of another
 * System is `TileNotFound`, as is a Reference, which has no files of its own. `link` is where the app
 * shows a Tile, for a Reference whose Tile the export leaves out: a pin's, with its Title and Preview,
 * while the actor may read it there and `across` lets the export resolve it; any other Tile the
 * System does not hold, deleted or kept from them, by no id (`referencesShown`).
 */
export const exportTile = (
  acting: Acting,
  { id, link, across }: { id: string; link: LinkOf; across: boolean },
) =>
  Effect.gen(function* () {
    const { system, pinned } = yield* pinnedShown(acting, yield* ownersWhole(acting), { across })
    const exported = exportOf(systemOf(system, pinned), id, link)
    if (exported === undefined) return yield* new TileNotFound()
    const { zipped } = yield* Zip
    return { name: `${exported.slug}.zip`, bytes: zipped(exported.files) }
  })

/**
 * The System the actor acts on as files, as they may see it (`seenThrough`), and where each of its
 * Tiles lives in them, by id, both from one read, so a reader of the files finds a Tile's folder or
 * file by its id: its owner's the export of its Root, whole; anyone else's the export of its star as
 * they are shown it, from its card, nothing they may not read, and each Tile across a gap with what
 * they may read below it in a folder of its own (`seenFiles`), whose name it answers when there is
 * one. `link` is where the app shows a Tile, for a Reference whose Tile the files leave out. With a
 * batch `over` it, the System the batch makes, as the reads through it show it. A Turn's files, read on
 * the System it started in alone: a Reference to a Tile that System does not hold, a pin or a deleted
 * Tile's, by no id.
 */
export const systemFiles = (acting: Acting, link: LinkOf, over: ReadonlyArray<Batched> = []) =>
  Effect.map(seenThrough(acting, over), (seen) => {
    const across = acrossGaps(seen, seen.gaps)
    const { files, places } = seenFiles(systemOf(seen), across, link)
    return { files, places, ...(across.length > 0 && { across: acrossFolder }) }
  })

/**
 * Refuses a change that writes a Tile hexframe ships, Help's or the tutorial's, whichever schema let
 * its ids through, before anything is read or locked: each is read by Everyone and written by nobody,
 * its owner and the Hexframe Organization's admins included (`Shipped`). Exported for `sharing/`,
 * whose Grants on such a Tile are nobody's.
 */
export const outsideShipped = (ids: ReadonlyArray<string>) =>
  ids.some(isShippedId) ? Effect.fail(new Shipped()) : Effect.void

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
 * A change to the System the actor acts on that is no Operation, `landing/`'s import, naming these
 * Tiles, none of them a shipped System's, on its rows as they stand once its star is locked, the
 * Tiles hexframe ships mounted among them in the Hexframe Organization's, so a slot one holds is
 * taken: alone until the transaction around it ends, so what it checked still holds when it writes.
 * Once it wrote its rows, it is ended as an Operation is: the System's Version it leaves written, its
 * events published.
 */
export const changing = <A, E>(
  acting: Acting,
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
        const owner = yield* reached(acting)
        const writes = tiles.writes(owner)
        const rows = withMounted(yield* tiles.lock(owner))
        const { answer, events } = yield* change(rows, writes)
        const before = yield* rooted(systemFrom(rows))
        yield* ended(writes, { after: events.reduce(evolve, before), events })
        return answer
      }),
    ),
  )

/** A System no read should find without its Root: a defect, never a refusal. */
const rooted = (found: System | undefined) =>
  found === undefined
    ? Effect.die(new Error('A System was decided on without a Root'))
    : Effect.succeed(found)

/**
 * The owner's System, its star locked until the transaction ends: no other change runs meanwhile. The
 * Hexframe Organization's holds the Tiles hexframe ships, mounted under its star, which no change
 * writes, so a slot one holds is taken.
 */
export const lockedOf = (owner: string) =>
  Tiles.use((tiles) =>
    Effect.flatMap(tiles.lock(owner), (rows) => rooted(systemFrom(withMounted(rows)))),
  )

/**
 * The System an Operation is decided on: the one the actor acts on, locked until the transaction
 * ends, once `may` found the actor may make this Operation on it, from the Grants its Tiles carry as
 * they stand under the lock: `TileNotFound` for a Tile it names that the actor may not read,
 * `NotAllowed` for anything else it may not do. No other change runs meanwhile, so what `decide`
 * ruled on still holds when its events are written. Answers it with its owner, whose rows a change
 * writes.
 */
const allowedOn = ({ actor, system: star }: Acting, operation: Operation) =>
  Effect.gen(function* () {
    const owner = yield* ownerOf(star)
    const system = yield* lockedOf(owner)
    const sharing = sharingOf(owner, lineageOf(system), yield* grantsIn(owner))
    yield* Effect.fromResult(allowed(actor, { system, sharing }, operation))
    return { system, owner }
  })

/**
 * The System the actor acts on, its star locked until the transaction ends, once Mapping found the
 * actor stands for its owner (`reached`): what a batch runs on. Answers it with its owner, whose rows
 * a change writes.
 */
const locked = (acting: Acting) =>
  Effect.flatMap(reached(acting), (owner) =>
    Effect.map(lockedOf(owner), (system) => ({ system, owner })),
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
 * Runs an Operation on the System the actor acts on: refuses it `Shipped` first when it writes a Tile
 * hexframe ships (`writtenAt`), then locks the System, loads it flat, asks `decide` through
 * `decided`, then writes one change per event, as `evolve` leaves the System after it, and the
 * System's Version, publishes the events, and answers the System it ran on, the events and the System
 * they leave. Every rule lives in `decide`: what it refuses is refused here, with nothing written and
 * nothing published. A write under an id already taken answers `onTaken`: a defect, unless the
 * Operation's caller chose the id. The bus holds what is published until the transaction commits.
 */
const operate = <E, T = never>(
  acting: Acting,
  operation: Operation,
  decided: (system: System) => Result.Result<ReadonlyArray<OperationEvent>, E>,
  onTaken: OnTaken<T> = madeHere,
) =>
  Effect.gen(function* () {
    yield* outsideShipped(writtenAt(operation))
    const { system, owner } = yield* allowedOn(acting, operation)
    const events = yield* Effect.fromResult(decided(system))
    return { system, events, after: yield* writtenAll(owner, system, events, onTaken) }
  })

/**
 * Writes the events a change made on the System it locked, one change each, as `evolve` leaves the
 * System after it, then ends it (`ended`), and answers the System they leave. A write under an id
 * already taken answers `onTaken`.
 */
const writtenAll = <T>(
  owner: string,
  system: System,
  events: ReadonlyArray<OperationEvent>,
  onTaken: OnTaken<T>,
) =>
  Effect.gen(function* () {
    const writes = (yield* Tiles).writes(owner)
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
export const createTile = (acting: Acting, operation: CreateTile, kept: ToKeep = {}) =>
  Effect.gen(function* () {
    const id = operation.id ?? (yield* newId)
    const onTaken: OnTaken<TileIdTaken> = operation.id === undefined ? madeHere : chosen
    const made = { id, kept }
    const { after } = yield* operate(
      acting,
      operation,
      (system) => decide(system, operation, made),
      onTaken,
    )
    return yield* answered(after, id)
  })

/** Changes what a Tile says, any of its Title, its Preview and its Body as given, and answers it. */
export const editTile = (acting: Acting, operation: EditTile) =>
  Effect.flatMap(
    operate(acting, operation, (system) => decide(system, operation)),
    ({ after }) => answered(after, operation.id),
  )

/**
 * Moves a Tile, and everything below it, to a free slot under another Tile of the System, never under
 * a Leaf, or to another slot of the same parent. A Leaf slot takes a Tile with nothing below it only,
 * so a Leaf grows into a Branch, and a bare Branch shrinks into a Leaf, by moving. References to it
 * follow, since they hold its id.
 */
export const moveTile = (acting: Acting, operation: MoveTile) =>
  Effect.asVoid(operate(acting, operation, (system) => decide(system, operation)))

/**
 * Two Tiles of the System trade places, each with everything below it: each takes the other's parent
 * and slot, a Branch's, a Leaf's or a Context slot alike. References to them follow, since they hold
 * their ids.
 */
export const swapTiles = (acting: Acting, operation: SwapTiles) =>
  Effect.asVoid(operate(acting, operation, (system) => decide(system, operation)))

/** Deletes a Tile and everything below it. A Reference to any of them stays, broken. */
export const deleteTile = (acting: Acting, operation: DeleteTile) =>
  Effect.asVoid(operate(acting, operation, (system) => decide(system, operation)))

/**
 * Puts a Reference in a free Context slot of a Tile, never of a Leaf, which has no Context: to another
 * Tile of the System, or to itself; or to a Tile of another System the actor may read there, a pin
 * (`pinning`), which its readers see while they may read it, and as unavailable otherwise.
 */
export const createReference = (acting: Acting, operation: CreateReference) =>
  Effect.gen(function* () {
    const id = yield* newId
    const targetElsewhere = yield* pinning(acting, operation)
    yield* operate(acting, operation, (system) =>
      decide(system, operation, { id, targetElsewhere }),
    )
  })

/** Empties a Context slot holding a Reference; the Tile it pointed at is untouched. */
export const deleteReference = (acting: Acting, operation: DeleteReference) =>
  Effect.asVoid(operate(acting, operation, (system) => decide(system, operation)))

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
 * Adds an Operation to a batch kept over the System the actor acts on, writing nothing: `BatchOutdated` once
 * the batch no longer applies whole, so nothing is added to a batch that can no longer run, and, for
 * anyone but its owner, what `allowed` refuses of one of its Operations on what the ones before it
 * made, a Grant taken back since included (`allowedThrough`); then the Operation, `allowed` asked of
 * it there for anyone but the owner, then decided by `decide` on the System the batch makes, refused
 * as it would be there, a create given
 * the id of what it makes now, fresh, so it keeps that id each time the batch is folded again. Answers
 * it as the batch keeps it, Mapping's summary of each event it makes there, and, for a create or an
 * edit, the Tile as the batch now makes it, with its Version, which the writer's next write to it
 * names. `decide` refuses each Operation only what its overload says, so the refusal is typed by it.
 * And `NotAllowed` for one its run would refuse (`allowedBatch`): a batch that, run without a Session,
 * opens a Tile to someone or deletes one carrying a Grant. Who adds to it reads what they may there,
 * so a batch over someone else's System holds only what the actor may write (HEX-134).
 */
export const addToBatch = <O extends Operation>(
  acting: Acting,
  over: ReadonlyArray<Batched>,
  operation: O,
) =>
  Effect.gen(function* () {
    yield* outsideShipped(writtenAt(operation))
    const owner = yield* ownerOf(acting.system)
    const held = yield* wholeOf(owner)
    const grants = yield* grantsIn(owner)
    const folded = yield* Effect.fromResult(
      allowedThrough(acting.actor, { owner, grants }, held, over),
    )
    yield* Effect.fromResult(allowedStep(acting.actor, { owner, grants }, folded.system, operation))
    const made = yield* madeFor(operation)
    const next = yield* Effect.fromResult(added(folded, operation, made))
    // Refused now what its run would refuse, so a batch holds nothing it can't run.
    const sharing = sharingOf(owner, lineageOf(held), grants)
    yield* Effect.fromResult(allowedBatch(acting.actor, sharing, next.system))
    const tile = yield* tileAnswered(next.system, operation, made)
    return {
      batched: next.batched,
      changes: summariesIn(next.system, next.events),
      ...(tile !== undefined && { tile }),
    }
  })

/**
 * Runs a batch on the System the actor acts on as it stands, its star locked, all of it or nothing, folded by
 * `folding`: one that no longer applies refuses the whole, `BatchOutdated`, nothing written nor
 * published; then, unless the owner runs it from a Session, one that would give anyone a right on a
 * Tile they did not hold before refuses the whole, `NotAllowed` (`allowedBatch`); else every event is
 * written and published as an Operation's are, a write under an id already taken answering
 * `onTaken`. Answers the System it ran on and the events it made.
 */
const ranWhole = <T>(
  acting: Acting,
  batch: ReadonlyArray<Batched>,
  { folding, onTaken }: { folding: typeof whole; onTaken: OnTaken<T> },
) =>
  Effect.gen(function* () {
    yield* outsideShipped(batch.flatMap(({ operation }) => writtenAt(operation)))
    const { system, owner } = yield* locked(acting)
    const { events } = yield* Effect.fromResult(folding(system, batch))
    const sharing = sharingOf(owner, lineageOf(system), yield* grantsIn(owner))
    const after = events.reduce<System>(evolve, system)
    yield* Effect.fromResult(allowedBatch(acting.actor, sharing, after))
    yield* writtenAll(owner, system, events, onTaken)
    return { system, events }
  })

/**
 * Runs a batch on the System the actor acts on, in the transaction around it, all of it or nothing:
 * its star locked, the batch folded over the System as it stands, each Operation decided on what the ones
 * before it made, a create under the id it was added with. One that no longer applies, a Tile it
 * names changed since, by the Version it carries, or gone, refuses the whole batch, `BatchOutdated`,
 * nothing written nor published (`whole`); else every event is written and published as an
 * Operation's are. A batch writing a Tile hexframe ships is `Shipped`. Answers how
 * many events it made and what undoes it (`undoOf`), from the System it ran on.
 */
export const runBatch = (acting: Acting, batch: ReadonlyArray<Batched>) =>
  Effect.map(
    ranWhole(acting, batch, { folding: whole, onTaken: madeHere }),
    ({ system, events }) => ({
      undo: undoOf(system, events),
      changes: events.length,
    }),
  )

/**
 * Whether a batch runs whole on the System the actor acts on as it stands, as the actor may make it,
 * its star locked until the transaction ends, writing nothing: for anyone but its owner, each
 * Operation `allowed` on what the ones before it made (`allowedThrough`), then the whole as
 * `allowedBatch` rules on it; `BatchOutdated` once one no longer applies, `TileNotFound` or
 * `NotAllowed` once the actor may not make it, a Grant taken back since included. What the API layer
 * asks before it runs a batch over someone else's System one write at a time, each its owner's to
 * undo, under the same lock, so each then runs as it was found to.
 */
export const batchAllowed = (acting: Acting, batch: ReadonlyArray<Batched>) =>
  Effect.gen(function* () {
    yield* outsideShipped(batch.flatMap(({ operation }) => writtenAt(operation)))
    const owner = yield* ownerOf(acting.system)
    const system = yield* lockedOf(owner)
    const grants = yield* grantsIn(owner)
    const folded = yield* Effect.fromResult(
      allowedThrough(acting.actor, { owner, grants }, system, batch),
    )
    const sharing = sharingOf(owner, lineageOf(system), grants)
    yield* Effect.fromResult(allowedBatch(acting.actor, sharing, folded.system))
  })

/**
 * Runs an Operation on the System the actor acts on by the same `operate` as an Operation's own
 * function, a create under its id or a fresh one, decided by `decidedOne`, a write under an id taken
 * answering `onTaken`, a Reference pinning a Tile of another System as `createReference` pins it
 * when its caller's `across` lets it. Answers the System it ran on, the events it made, the System they leave and,
 * for a create or an edit, the Tile as it now stands: what `runOperation` and `runUndoable` both
 * make what undoes it from.
 */
const ranOne = <O extends Operation, T>(
  acting: Acting,
  operation: O,
  { onTaken, across }: { onTaken: OnTaken<T>; across: boolean },
) =>
  Effect.gen(function* () {
    const made = yield* madeFor(operation)
    const elsewhere = across ? yield* pinning(acting, operation) : false
    const { system, events, after } = yield* operate(
      acting,
      operation,
      (held) =>
        Result.map(
          decidedOne(held, operation, made, { targetElsewhere: elsewhere }),
          (next) => next.events,
        ),
      onTaken,
    )
    const tile = yield* tileAnswered(after, operation, made)
    return { system, events, after, tile }
  })

/**
 * Runs an Operation on the System the actor acts on (`ranOne`), and answers, beside the Tile as it
 * now stands for a create or an edit, how many events it made and what undoes it: its inverse, from
 * the System it ran on, after `earlier`, the undo of what ran before it in the same batch, when one
 * is given (`extended`), as a batch that runs in several goes runs one Operation after the other. A
 * clash on a create's id is a defect: such a create carries none. A Reference pins a Tile of another
 * System only as `across` lets it, which its caller says: never a Turn's, which runs on the System it
 * started in alone (`TileNotFound`, as `decide` answers one).
 */
export const runOperation = <O extends Operation>(
  acting: Acting,
  operation: O,
  { earlier, across }: { readonly earlier: Undo | undefined; readonly across: boolean },
) =>
  Effect.map(
    ranOne(acting, operation, { onTaken: madeHere, across }),
    ({ system, events, tile }) => ({
      undo: earlier === undefined ? undoOf(system, events) : extended(earlier, system, events),
      changes: events.length,
      ...(tile !== undefined && { tile }),
    }),
  )

/**
 * Runs an Operation on the System the actor acts on (`ranOne`) as its own function runs it, a create
 * under the id its caller chose refused `TileIdTaken`, as `createTile` refuses it, a Reference
 * pinning a Tile of another System the actor may read there, as `createReference` pins it, as far as
 * `across`, its caller's, lets it, and answers,
 * beside the Tile as it now stands for a create or an edit, what undoes it, from the System it ran
 * on, and Mapping's summary of the change it made, as the System it leaves holds it, none for one
 * that changed nothing: what the API layer runs a write someone else makes in a System by, so its
 * owner may undo it.
 */
export const runUndoable = <O extends Operation>(
  acting: Acting,
  operation: O,
  { across }: { readonly across: boolean },
) => {
  // Only a create carries an id its caller chose, so only a create's type lists `TileIdTaken`.
  const onTaken = (
    operation._tag === 'CreateTile' && operation.id !== undefined ? chosen : madeHere
  ) as OnTaken<O extends CreateTile ? TileIdTaken : never>
  return Effect.map(
    ranOne(acting, operation, { onTaken, across }),
    ({ system, events, after, tile }) => {
      const [change] = summariesIn(after, events)
      return {
        undo: undoOf(system, events),
        ...(change !== undefined && { change }),
        ...(tile !== undefined && { tile }),
      }
    },
  )
}

/**
 * Undoes a batch that ran, in the transaction around it, all of it or nothing: its inverse run on the
 * System the actor acts on as it stands, under its star's lock, each event written and published as an
 * Operation's are. Refused whole, `BatchOutdated`, once a Tile it touched changed since, by the Version
 * its inverse names, or a Tile it made holds what another writer put below it since (`undone`), or the
 * undo was `Outdated` already: nothing written nor published.
 */
export const undo = (acting: Acting, undoing: Undo) =>
  undoing._tag === 'Outdated'
    ? Effect.fail(new BatchOutdated())
    : Effect.asVoid(
        ranWhole(acting, undoing.batch, {
          folding: undone,
          onTaken: () => Effect.fail(new BatchOutdated()),
        }),
      )
