// A visit (HEX-127): someone else's System on home's canvas, reached by a link to one of its Tiles
// (`/t/<id>`, `visitLinkOf`), as the Account may see it, from its star: the param home carries it in,
// its Tiles as the canvas and the corner draw them, each Tile they may read below Tiles kept from
// them hung from the star across a gap, and where a Tile the chat names is centered. Pure.
import { Schema } from 'effect'

import { systemOf } from '#/domains/mapping/entities'
import type { SystemShown } from '#/front/client/mapping/queries'
import { localizeUrl } from '#/paraglide/runtime'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'
import { orDefault, readSearch, TileId } from '#/front/ui/canvas/view/view'

import { canvasTree } from '../tree'

const VisitSearch = Schema.Struct({
  /**
   * The star of the System on the canvas, someone else's, the view's fields its own while it is;
   * absent, the Account's.
   */
  system: Schema.optionalKey(orDefault(TileId)),
})

export type VisitSearch = typeof VisitSearch.Type

/** Reads the URL's search param, which falls back on the Account's own System. */
export const readVisitSearch = readSearch(VisitSearch)

/** The search param with someone else's System on the canvas, by its star, or the Account's. */
export const withVisit = (star: string | undefined): VisitSearch => ({ system: star })

/**
 * The link a Tile is visited by, on the site the page is on, in its language: what Copy link copies
 * and the Share widget will (HEX-128), which leads whoever may read the Tile to it, in its System.
 */
export const visitLinkOf = (id: string, page: string) =>
  localizeUrl(new URL(`/t/${encodeURIComponent(id)}`, page)).href

/**
 * Someone else's System as the canvas and the corner draw it: from its star, its card unless the
 * visitor may read it, with its gaps hung from it, each with everything they may read below it.
 */
export function visitTree({ system, root, gaps }: Pick<SystemShown, 'system' | 'root' | 'gaps'>) {
  const across = Object.values(gaps).map((gap): TileNode => ({
    ...canvasTree(systemOf({ ...system, root: gap })),
    across: true,
  }))
  const tree: TileNode = { ...canvasTree(root), ...(across.length > 0 && { gaps: across }) }
  return tree
}

/**
 * Where a Tile the chat names is centered: on the System visited when it holds it, else on the
 * Account's own when it does, else nowhere on the page, the Tile visited by its link instead
 * (`/t/<id>`), which leads wherever the Account may read it; none before the Account's System is
 * read.
 */
export function centeringOf(
  tile: string,
  { own, visited }: { own: TileNode | undefined; visited: TileNode | undefined },
):
  | { readonly on: 'visited' | 'own'; readonly tree: TileNode }
  | { readonly on: 'link' }
  | undefined {
  if (visited !== undefined && findTile(visited, tile) !== undefined) {
    return { on: 'visited', tree: visited }
  }
  if (own === undefined) return undefined
  return findTile(own, tile) === undefined ? { on: 'link' } : { on: 'own', tree: own }
}

/**
 * The Titles of the Tiles of someone else's System a visitor sees, by id, its gaps' and its star's
 * card's included: what the chat names them by, as it names the Account's own.
 */
export function titlesIn({ system, gaps }: Pick<SystemShown, 'system' | 'gaps'>) {
  const tiles = [system.root, ...Object.values(gaps), ...Object.values(system.tiles)]
  return new Map(tiles.flatMap((held) => (held._tag === 'Tile' ? [[held.id, held.title]] : [])))
}
