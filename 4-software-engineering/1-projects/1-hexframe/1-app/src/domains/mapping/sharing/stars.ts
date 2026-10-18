// A star found, for whoever is about to share with someone, or to name an Organization's member: by
// its Title, or by a link to any Tile of its System. Nobody types a UUID (HEX-130). A star is found by
// its card alone, its Title and Preview, which anyone sees, a private System's too: nothing below a
// star is ever searched, and a link leads to a star only through a Tile its reader is shown. The API
// layer calls it as directly as the service, whose folder is full, as it calls `sharing.ts`.
import { Effect } from 'effect'

import { Tiles } from '#/repositories/database/tiles/tiles'

import { type StarCard, starsFoundAtMost } from '../entities'
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
