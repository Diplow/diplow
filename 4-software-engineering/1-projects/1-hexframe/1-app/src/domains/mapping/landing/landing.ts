// An import, from an upload to the Tiles it lands: `planImport` reads the upload into a plan, its
// archive unpacked within its bounds through the zip repository, outside any transaction; then
// `importTiles` lands the plan in the Account's System as a change does, the Root locked, its slot
// checked, every row written in one batch, all of it or nothing, then its one event, `TilesImported`,
// which the plan makes, counted on the System's Version and published as an Operation's are. It always
// creates: every Tile gets a new id, so importing twice makes two copies
// (`hexframe-app-import-export/decisions.md#DEC-11`).
import { Effect } from 'effect'

import type { BatchRow, RowRef, TileRow, Writes } from '#/repositories/database/tiles/tiles'
import { Tiles } from '#/repositories/database/tiles/tiles'
import { Zip } from '#/repositories/zip/zip'

import { DirectionTaken, TileNotFound } from '../errors'
import type {
  IdOfLink,
  ImportPlan,
  ImportSource,
  LeftOut,
  PlannedLeaf,
  PlannedTile,
  ReferenceTarget,
} from '../files/import/plan'
import { importOf } from '../files/import/read'
import { importedAs } from '../files/import/plan'
import {
  isEmptySystem,
  onlyALeafIn,
  rowDirection,
  type Slot,
  type System,
  systemFrom,
  systemOf,
  tileRow,
} from '../entities'
import { changing, published, untitled } from '../mapping'
import { evolve, freeSlot, type Placement } from '../operations'
import { type Upload, archiveBounds, folderOf } from './archive'

export type { Upload } from './archive'
export { fitsUpload, uploadLimit } from './archive'

/**
 * The plan for an upload: an archive unpacked within its bounds and read as a folder, or one file
 * read alone; or `ImportRefused` with every fault. `link` reads the id of the Tile an app link points
 * at, which only a Tile of the importer's System answers, once the plan lands.
 */
export const planImport = ({ as, name, bytes }: Upload, link: IdOfLink) =>
  Effect.gen(function* () {
    const { unpacked } = yield* Zip
    const source: ImportSource =
      as === 'File'
        ? { _tag: 'File', file: { path: name, bytes } }
        : yield* Effect.fromResult(folderOf(name, unpacked(bytes, archiveBounds)))
    return yield* Effect.fromResult(importOf(source, link))
  })

/** Where an import lands: as a new Tile in a free slot under a Tile of the System, or as its Root. */
export type ImportPlace = ({ readonly _tag: 'Slot' } & Placement) | { readonly _tag: 'Root' }

/**
 * What an import landed: the id of the Tile it landed as, how many Tiles and References it wrote, the
 * Root among them when it landed as the Root, and what it skipped, and why.
 */
interface ImportReport {
  readonly id: string
  readonly tiles: number
  readonly references: number
  readonly skipped: ReadonlyArray<LeftOut>
}

/** How a batch names the Tile a plan's path was read from: a row of the batch, or one stored. */
type NameOf = (path: string) => RowRef

/** What a Reference of the plan points at, as the batch writes it. */
function targetOf(
  target: ReferenceTarget,
  { rows, nameOf }: { rows: ReadonlyArray<TileRow>; nameOf: NameOf },
): BatchRow['target'] {
  if (target._tag === 'Inside') return nameOf(target.path)
  // A Tile of another System, or a Reference's row, is no Tile of this one: nothing of it is read.
  if (target._tag === 'Linked' && tileRow(rows, target.id) !== undefined) {
    return { _tag: 'Stored', id: target.id }
  }
  return { _tag: 'Nowhere' }
}

/** A planned Tile's row, under its parent in a direction, keeping what its file carried. */
const rowOf = (
  { path, title, preview, body, name, config, frontmatter }: PlannedTile | PlannedLeaf,
  { parent, direction }: { parent: RowRef; direction: number },
): BatchRow => ({
  key: path,
  parent,
  direction,
  target: null,
  title,
  preview,
  body,
  name,
  config,
  frontmatter,
})

/**
 * The rows of everything below a planned Tile, each after the row it stands under: its Branches, its
 * Leaves and its Context, a Tile or a Reference, then theirs.
 */
function rowsBelow(
  tile: PlannedTile,
  { parent, resolve }: { parent: RowRef; resolve: (target: ReferenceTarget) => BatchRow['target'] },
): Array<BatchRow> {
  const rows: Array<BatchRow> = []
  const add = (held: PlannedTile | PlannedLeaf, slot: Slot) => {
    rows.push(rowOf(held, { parent, direction: rowDirection(slot) }))
    if (held._tag === 'Tile')
      rows.push(...rowsBelow(held, { parent: { _tag: 'Batch', key: held.path }, resolve }))
  }
  for (const [direction, branch] of entriesOf(tile.branches)) add(branch, direction)
  for (const [direction, leaf] of entriesOf(tile.leaves)) add(leaf, { leaf: direction })
  for (const [slot, held] of entriesOf(tile.context)) {
    if (held._tag === 'Reference') {
      rows.push({
        key: held.path,
        parent,
        direction: slot,
        target: resolve(held.target),
        ...untitled,
      })
    } else add(held, slot)
  }
  return rows
}

/** A plan's record of slots, each slot back as the number it is. */
const entriesOf = <K extends number, V>(record: Partial<Record<K, V>>) =>
  // Built from a record keyed by K alone, whose keys `Object.entries` gives back as strings.
  Object.entries(record).map(([slot, held]) => [Number(slot) as K, held as V] as const)

/** What a batch landed, counted: its Tiles and its References, the Root's row when it was replaced. */
function reportOf(
  batch: ReadonlyArray<BatchRow>,
  { id, plan, replaced }: { id: string; plan: ImportPlan; replaced: boolean },
): ImportReport {
  const references = batch.filter(({ target }) => target !== null).length
  return {
    id,
    tiles: batch.length - references + (replaced ? 1 : 0),
    references,
    skipped: plan.skipped,
  }
}

/**
 * Ends an import landed as the Tile of this id: the plan's event counted on the System as `evolve`
 * leaves it, its Version written, the event published.
 */
const landed = (
  writes: Writes,
  { system, plan, id }: { system: System; plan: ImportPlan; id: string },
) => {
  const event = importedAs(plan, id)
  return published(writes, { after: evolve(system, event), events: [event] })
}

/**
 * A plan landed in a free slot under a Tile of the System, never under a Leaf nor in Help: its root a
 * new Tile there, with everything below it. A Leaf slot takes a plan that is one file alone.
 */
const inSlot = (accountId: string, plan: ImportPlan, place: Placement) =>
  changing(accountId, [place.parent], (rows, writes) =>
    Effect.gen(function* () {
      const system = systemFrom(rows, { owned: true })
      if (system === undefined) return yield* new TileNotFound()
      yield* Effect.fromResult(freeSlot(system, place))
      const { root } = plan
      yield* Effect.fromResult(onlyALeafIn(place.slot, root))
      const nameOf: NameOf = (path) => ({ _tag: 'Batch', key: path })
      const resolve = (target: ReferenceTarget) => targetOf(target, { rows, nameOf })
      const placed = rowOf(root, {
        parent: { _tag: 'Stored', id: place.parent },
        direction: rowDirection(place.slot),
      })
      const below =
        root._tag === 'Tile' ? rowsBelow(root, { parent: nameOf(root.path), resolve }) : []
      const batch = [placed, ...below]
      const ids = yield* writes.insertAll(batch)
      const id = ids.get(root.path)
      if (id === undefined) return yield* Effect.die(new Error('A batch lost its first row'))
      yield* landed(writes, { system, plan, id })
      return reportOf(batch, { id, plan, replaced: false })
    }),
  )

/**
 * A plan landed as the Root of an empty System (`isEmptySystem`): the plan's root gives the Root its
 * Title, Preview, Body, config and Frontmatter, and everything below it lands below the Root. A System
 * holding anything, its Root's own content included, is `DirectionTaken`: the Root's place is taken.
 */
const asRoot = (accountId: string, plan: ImportPlan) =>
  Effect.andThen(
    Tiles.use((tiles) => tiles.root(accountId, untitled)),
    changing(accountId, [], (rows, writes) =>
      Effect.gen(function* () {
        const found = systemFrom(rows, { owned: true })
        if (found === undefined) return yield* Effect.die(new Error('A Root was added, then lost'))
        const stored = systemOf(found)
        if (!isEmptySystem(stored)) return yield* new DirectionTaken()
        const { root } = plan
        const nameOf: NameOf = (path) =>
          path === root.path ? { _tag: 'Stored', id: stored.id } : { _tag: 'Batch', key: path }
        const resolve = (target: ReferenceTarget) => targetOf(target, { rows, nameOf })
        const { title, preview, body, config, frontmatter } = root
        // The Root says what the import gave it now, its Version counted by the import's event: a
        // writer that read it empty is refused.
        yield* writes.update(stored.id, {
          version: evolve(found, importedAs(plan, stored.id)).root.version,
          title,
          preview,
          body,
          ...(config === undefined ? {} : { config }),
          ...(frontmatter === undefined ? {} : { frontmatter }),
        })
        const batch =
          root._tag === 'Tile' ? rowsBelow(root, { parent: nameOf(root.path), resolve }) : []
        yield* writes.insertAll(batch)
        yield* landed(writes, { system: found, plan, id: stored.id })
        return reportOf(batch, { id: stored.id, plan, replaced: true })
      }),
    ),
  )

/**
 * Lands an import plan in the Account's System, all of it or nothing: in a free slot under one of its
 * Tiles, or as the Root of an empty System. Every Tile gets a new id. A Reference to a Tile of the plan
 * points at the new one; one to an app link resolves only to a Tile of this System, and is broken
 * otherwise, as a Reference to nothing is. A slot taken since the plan was made is `DirectionTaken`.
 */
export const importTiles = (
  accountId: string,
  { plan, place }: { plan: ImportPlan; place: ImportPlace },
) => (place._tag === 'Root' ? asRoot(accountId, plan) : inSlot(accountId, plan, place))
