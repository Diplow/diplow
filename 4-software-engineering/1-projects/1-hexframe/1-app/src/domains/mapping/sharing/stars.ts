// A star found, for whoever is about to share with someone, or to name an Organization's member: by
// its Title, or by a link to any Tile of its System. Nobody types a UUID (HEX-130). A star is found by
// its card alone, its Title and Preview, which anyone sees, a private System's too: nothing below a
// star is ever searched, and a link leads to a star only through a Tile its reader is shown. And a
// star made with the System of a new owner, named from its birth, as an Organization's is (HEX-136),
// and the stars of some owners by their cards. The API layer calls it as directly as the service,
// whose folder is full, as it calls `sharing.ts`.
import { Effect } from 'effect'

import { Tiles } from '#/repositories/database/tiles/tiles'

import { checked, type LinkedStar, nowhere, type StarCard, starsFoundAtMost } from '../entities'
import type { TileNotFound } from '../errors'
import { type Acting, glimpses, shownTile } from '../mapping'

/**
 * The stars whose Title holds the query, whatever its case, by their cards, those it starts first,
 * at most `starsFoundAtMost`, the star of the System the actor acts on, their own, left out: stars
 * alone, never a Tile below one, whichever System they name, a private one's included, since anyone
 * sees a star's card. The query is Mapping's `StarQuery`, which the API layer decodes.
 */
export const starsTitled = (acting: Acting, query: string) =>
  Tiles.use((tiles): Effect.Effect<ReadonlyArray<StarCard>> =>
    tiles.starsTitled({ query, except: acting.system, atMost: starsFoundAtMost }),
  )

/**
 * The star of the System the actor acts on, by its card, once Mapping found they are shown the Tile
 * of this id there (`shownTile`): one they may read, or the star itself; `TileNotFound` otherwise, a
 * Tile kept from them answered as one that isn't there. Where a link to that Tile leads them.
 */
export const starShowing = (acting: Acting, tile: string) =>
  Effect.andThen(shownTile(acting, tile), () =>
    Effect.flatMap(glimpses(acting, [acting.system]), ([card]): Effect.Effect<StarCard> =>
      card === undefined
        ? Effect.die(new Error('A star was shown, then not found'))
        : Effect.succeed(card),
    ),
  )

/** Where a link to a Tile of the reader's own System leads: their own star, which they never pick. */
const theirOwn: LinkedStar = { _tag: 'Own' }

/**
 * Where a link to the Tile of this id leads the actor, on the System holding it, which they act on:
 * to its star, by its card, once they are shown the Tile (`starShowing`); to their own star, which
 * `ownStar` names, which they never pick; nowhere for a Tile kept from them, as for one that isn't there.
 * An answer, never a refusal, so whoever asked says it where the link was given, and it says nothing
 * of a Tile the actor may not read.
 */
export const linkedStar = (acting: Acting, ownStar: string, tile: string) => {
  const led: Effect.Effect<LinkedStar, TileNotFound, Tiles> =
    acting.system === ownStar
      ? Effect.as(shownTile(acting, tile), theirOwn)
      : Effect.map(starShowing(acting, tile), (star): LinkedStar => ({ _tag: 'Star', star }))
  return Effect.catchTag(led, 'TileNotFound', () => Effect.succeed(nowhere))
}

/**
 * The star of a new owner's System, made with it, its Title the name it is given, trimmed, and
 * answered by its id, its Handle: `TitleMissing` for a blank one. The owner is opaque, as every
 * owner is to Mapping; an Organization's System is made so, its first admin naming it (HEX-136). An
 * owner who has a star already keeps it as it was. No event tells of it, as none tells of the star an
 * Account's first read adds (`starOf`).
 */
export const starNamed = (owner: string, title: string) =>
  Effect.flatMap(Effect.fromResult(checked({ title })), (named) =>
    Tiles.use((tiles) => tiles.root(owner, { title: named.title, preview: '', body: '' })),
  )

/**
 * The star of each of these owners, by its card, which anyone sees, by the owner: one with no
 * System yet is left out. What names an Organization's members.
 */
export const starsOf = (owners: ReadonlyArray<string>) =>
  Tiles.use((tiles): Effect.Effect<ReadonlyMap<string, StarCard>> => tiles.starsOwnedBy(owners))
