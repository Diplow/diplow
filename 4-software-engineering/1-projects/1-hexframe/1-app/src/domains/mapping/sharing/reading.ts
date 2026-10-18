// What an actor may read of a System, read for every request from the Grants its Tiles carry, its
// owner reading it whole; and the Tiles of other Systems a reader's References point at that they may
// read there, a pin's (HEX-133), each resolved for that reader on every read. Mapping's service reads
// by it (`../mapping.ts`), and so does `./sharing.ts`. It reads the tiles repository alone, below the
// service, so the service imports it as it imports its entities.
import { Effect } from 'effect'

import { Tiles } from '#/repositories/database/tiles/tiles'

import {
  type Actor,
  grantOf,
  lineageFrom,
  owns,
  type PinnedTiles,
  sharingOf,
  sightOf,
  type System,
  tileAt,
} from '../entities'
import { TileNotFound } from '../errors'
import type { Operation } from '../operations'

/** Who acts, and on which System, named by its star, the id of its Root. */
export interface Acting {
  readonly actor: Actor
  readonly system: string
}

/**
 * The owner of the System a star names, `TileNotFound` for a star that names none: what every read
 * and change of it first finds, and `sharing.ts` before it reads or changes a Tile's Grants there.
 */
export const ownerOf = (system: string) =>
  Tiles.use((tiles) =>
    Effect.flatMap(tiles.ownerOf(system), (owner) =>
      owner === undefined ? Effect.fail(new TileNotFound()) : Effect.succeed(owner),
    ),
  )

/** The Grants the Tiles of the owner's System carry, a row that is no Grant left out. */
export const grantsIn = (owner: string) =>
  Tiles.use((tiles) =>
    Effect.map(tiles.grants(owner), (rows) =>
      rows.flatMap((row) => {
        const found = grantOf(row)
        return found === undefined ? [] : [found]
      }),
    ),
  )

/**
 * What the actor may read of the System it acts on, by id, with its owner: every Tile, for its owner;
 * else what `may` says, from where its Tiles stand and the Grants they carry, read for this request.
 * And what they are shown (`shows`): what they may read, and the star, whose card, its Title and
 * Preview, anyone sees.
 */
export const reading = ({ actor, system }: Acting) =>
  Effect.gen(function* () {
    const owner = yield* ownerOf(system)
    if (owns(actor, owner)) return { owner, reads: (): boolean => true, shows: (): boolean => true }
    const [places, grants] = yield* Effect.all(
      [Tiles.use((tiles) => tiles.places(owner)), grantsIn(owner)],
      { concurrency: 'unbounded' },
    )
    return { owner, ...sightOf(actor, sharingOf(owner, lineageFrom(places), grants), system) }
  })

/**
 * Whether a read resolves a Reference to a Tile of another System, a pin, for the actor there: by
 * default; a Turn's Key, which reads the System its Turn started in alone, resolves none, its pins
 * unavailable, which the API layer, where that binding lives, says.
 */
export interface Across {
  readonly across?: boolean | undefined
}

/** The ids a System's References point at that it holds no Tile of: another System's, or none. */
export const outside = (held: System) =>
  Object.values(held.tiles).flatMap((placed) =>
    placed._tag === 'Reference' && tileAt(held, placed.target) === undefined ? [placed.target] : [],
  )

/**
 * The Tiles of the System the actor acts on among these ids that they may read, each with the Title
 * of its star, whose card anyone sees: the pins a reader of another System is shown from it.
 */
const pinnedIn = (acting: Acting, ids: ReadonlyArray<string>) =>
  Effect.flatMap(reading(acting), ({ owner, reads }) =>
    Tiles.use((tiles) =>
      Effect.map(
        tiles.ofIds(owner, [acting.system, ...ids.filter(reads)], ['title', 'preview']),
        (rows) => {
          const starTitle = rows.find(({ id }) => id === acting.system)?.title ?? ''
          return rows.flatMap(({ id, target, title, preview }) =>
            target === null && ids.includes(id) && reads(id)
              ? [[id, { id, title, preview, starTitle }] as const]
              : [],
          )
        },
      ),
    ),
  )

/**
 * The Tiles of other Systems than `here` among these ids that the actor may read there, by id, each
 * with the Title of the star holding it: what a Reference to one of them, a pin, shows its reader,
 * read for this request, so one they lose *read* on shows unavailable from the next. An id no System
 * holds, a deleted Tile's, a Reference's, or one kept from the actor, has none, alike. The Systems
 * holding them are found in one lookup, each then read as the service's `titles` reads it.
 */
export const pinnedFor = (actor: Actor, ids: ReadonlyArray<string>, here: string) =>
  Effect.gen(function* () {
    const stars = yield* Tiles.use((tiles) => tiles.starsHolding([...new Set(ids)]))
    const elsewhere = new Map<string, string[]>()
    for (const [id, star] of stars) {
      if (star !== here) elsewhere.set(star, [...(elsewhere.get(star) ?? []), id])
    }
    const found = yield* Effect.forEach(
      [...elsewhere],
      ([star, named]) => pinnedIn({ actor, system: star }, named),
      { concurrency: 'unbounded' },
    )
    const pinned: PinnedTiles = Object.fromEntries(found.flat())
    return pinned
  })

/**
 * The star of the System holding the Tile of this id, `undefined` for an id no Tile nor Reference
 * of any System has: what the API layer names the System a read from one Tile reaches by. It tells
 * nothing that a read then shows: the read asks `may`, so a Tile the actor may not read is
 * `TileNotFound` there, as an id that names nothing is.
 */
export const holding = (id: string) => Tiles.use((tiles) => tiles.starHolding(id))

/**
 * The Titles of the Tiles of the System the actor acts on among these ids that pass `kept`, by id: a
 * deleted one's, a Reference's or an id it holds no Tile of has none.
 */
export const titledIn = (
  owner: string,
  ids: ReadonlyArray<string>,
  kept: (id: string) => boolean,
) =>
  Tiles.use((tiles) =>
    Effect.map(tiles.ofIds(owner, ids.filter(kept), ['title']), (rows) =>
      Object.fromEntries(
        rows.flatMap(({ id, target, title }) => (target === null ? [[id, title] as const] : [])),
      ),
    ),
  )

/** Nothing when the id is a Tile of the System the actor acts on that `kept` lets through. */
const tileKept = (acting: Acting, id: string, kept: 'reads' | 'shows') =>
  Effect.flatMap(reading(acting), (sight) =>
    Effect.flatMap(titledIn(sight.owner, [id], sight[kept]), (titled) =>
      id in titled ? Effect.void : Effect.fail(new TileNotFound()),
    ),
  )

/**
 * Nothing when the id is a Tile of the System the actor acts on that they may read, else
 * `TileNotFound`: a star they may not read too, whose card is no Tile they read.
 */
export const ownTile = (acting: Acting, id: string) => tileKept(acting, id, 'reads')

/**
 * Nothing when the actor is shown the Tile of this id in the System they act on: one they may read,
 * or its star, whose card anyone sees; `TileNotFound` otherwise, a Tile kept from them answered as
 * one that isn't there. Where a link to a Tile may lead them.
 */
export const shownTile = (acting: Acting, id: string) => tileKept(acting, id, 'shows')

/**
 * Whether an Operation pins a Tile of another System, a Reference's create whose target another
 * System holds: once the actor may read it there (`ownTile`), before the System it is made in is
 * locked, so `decide` takes a target that System does not hold; `TileNotFound` when they may not, as
 * for no Tile at all. Any other Operation, a target of the System acted on or of none, is ruled on by
 * `decide` there.
 */
export const pinning = (acting: Acting, operation: Operation) =>
  operation._tag === 'CreateReference'
    ? Effect.flatMap(holding(operation.target), (star) =>
        star === undefined || star === acting.system
          ? Effect.succeed(false)
          : Effect.as(ownTile({ ...acting, system: star }, operation.target), true),
      )
    : Effect.succeed(false)
