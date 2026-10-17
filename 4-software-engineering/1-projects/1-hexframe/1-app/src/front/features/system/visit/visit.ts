// A visit (HEX-127): someone else's System on home's canvas, reached by a link to one of its Tiles
// (`/t/<id>`, `visitLinkOf`), as the Account may see it, from its star: the param home carries it in,
// its Tiles as the canvas and the corner draw them, each Tile they may read below Tiles kept from
// them hung from the star across a gap, and what the visitor may do there. Pure.
import { Schema } from 'effect'

import { type Right, systemOf } from '#/domains/mapping/entities'
import type { SystemShown } from '#/front/client/mapping/queries'
import { localizeUrl } from '#/paraglide/runtime'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { orDefault, readSearch, TileId } from '#/front/ui/canvas/view/view'

import { type Reach, reachOf } from '../acting'
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
 * What a visitor may do on someone else's System: read what Mapping lets them read, and no more for
 * now, whatever else its Grants give them. A write the page sends acts on the Account's own System
 * until a write reaches the System it names (HEX-132), and a Turn starts in its own System alone
 * until one may start in another (HEX-134): offering either would be offering a refusal.
 */
export function visiting({ system, rights }: Pick<SystemShown, 'system' | 'rights'>): Reach {
  const reach = reachOf(rights, system, false)
  const reads = new Set<Right>(['read'])
  return { rights: (id) => (reach.rights(id).has('read') ? reads : new Set()), yours: false }
}
