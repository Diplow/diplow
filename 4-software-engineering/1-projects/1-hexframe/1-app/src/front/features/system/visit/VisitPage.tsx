// Someone else's System on home's canvas while the URL visits it (HEX-127): read by its star as the
// Account may see it, from its card, the Tiles it may read below Tiles kept from it hung from the
// star across a gap, and each Tile offering only what the visitor's rights there let through.
import { useMemo, useState } from 'react'

import { type SystemShown, useSystem } from '#/front/client/mapping/queries'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import type { CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'

import type { SearchChange, SystemSearch } from '../search/search'
import { System } from '../System'
import { titlesIn, visiting, visitTree } from './visit'

/**
 * The System visited, by its star, as the canvas draws it, none on the Account's own; and the Titles
 * of the Tiles of every System visited since the page opened, by id, which the chat names them by,
 * a gesture made there and not yet recorded included, once the canvas went home.
 */
export interface Visited {
  readonly star: string | undefined
  readonly tree: TileNode | undefined
  readonly titles: ReadonlyMap<string, string>
}

/**
 * The System the URL visits, read outside every boundary without throwing, for the corner and for a
 * Tile the chat names; none on the Account's own, its star named included, so a link to it is no
 * visit. Not visiting, it reads the Account's own Query, which the page reads already.
 */
export function useVisited(star: string | undefined, own: string | undefined): Visited {
  const visited = star !== undefined && star !== own ? star : undefined
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
  return { star: visited, tree, titles: kept.titles }
}

export interface VisitPageProps {
  /** The star of the System visited, someone else's. */
  star: string
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /** Who touches what the canvas draws, as the page holds it (`marks/`). */
  marks: CanvasMarks
}

/** Nothing to export from a System visited, whose export is its owner's alone. */
const noExport = { start: () => undefined, pending: false }

/** Neither the agent nor a carry is offered on a System visited, whose Tiles none lets move. */
const none = () => undefined

/**
 * The canvas side, someone else's System, thrown to the nearest boundary should its read fail: from
 * its star, its gaps hung from it, each Tile offering only what the visitor's rights there let
 * through (`visiting`); a skeleton while it is read.
 */
export function VisitPage({ star, search, onSearchChange, onViewChange, marks }: VisitPageProps) {
  const { data } = useSystem({ star })
  if (data === undefined) return <Skeleton className="min-h-0 flex-1" />
  return (
    <System
      system={data.system}
      root={data.root}
      tree={visitTree(data)}
      underway={data.underway}
      reach={visiting(data)}
      search={search}
      onViewChange={onViewChange}
      onSearchChange={onSearchChange}
      exporting={noExport}
      marks={marks}
      onAsk={none}
      onCarry={none}
      className="min-h-0 flex-1"
    />
  )
}
