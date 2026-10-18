// The System home's URL visits (HEX-127), for what shows beside the canvas: the corner, which draws
// it from its star, and the chat, which names its Tiles, and keeps naming them once the canvas went
// home, a gesture made there not yet recorded included.
import { useMemo, useState } from 'react'

import type { System } from '#/domains/mapping/entities'
import { type SystemShown, useSystem } from '#/front/client/mapping/queries'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { titlesIn, visitTree } from './visit'

/**
 * The System visited, by its star, as the canvas draws it, its tree and flat, none on the Account's
 * own; and the Titles of the Tiles of every System visited since the page opened, by id, which the
 * chat names them by, a gesture made there and not yet recorded included, once the canvas went home.
 */
export interface Visited {
  readonly star: string | undefined
  readonly tree: TileNode | undefined
  readonly system: System | undefined
  readonly titles: ReadonlyMap<string, string>
}

/**
 * The System the URL visits, read outside every boundary without throwing, for the corner and for a
 * Tile the chat names; none on the Account's own, its star named included, so a link to it is no
 * visit, nor before the Account's own is read, which tells. Not visiting, it reads the Account's own Query, which the page reads already.
 */
export function useVisitedState(star: string | undefined, own: string | undefined): Visited {
  // Whose star it names is known once the Account's own is read: no visit before.
  const visited = star !== undefined && own !== undefined && star !== own ? star : undefined
  const { data } = useSystem({ throwing: false, ...(visited !== undefined && { star: visited }) })
  const shown = visited === undefined ? undefined : data
  const tree = useMemo(() => (shown === undefined ? undefined : visitTree(shown)), [shown])
  // The Titles kept from each read as it renders, against the last one kept.
  const [kept, keep] = useState<{ from?: SystemShown; titles: ReadonlyMap<string, string> }>({
    titles: new Map(),
  })
  if (shown !== undefined && shown !== kept.from) {
    keep({ from: shown, titles: new Map([...kept.titles, ...titlesIn(shown)]) })
  }
  return { star: visited, tree, system: shown?.system, titles: kept.titles }
}
