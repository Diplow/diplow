// Someone else's System on home's canvas while the URL visits it (HEX-127), the canvas side: read by
// its star as the Account may see it, from its card, the Tiles it may read below Tiles kept from it
// hung from the star across a gap, each Tile's menu holding the lines that look, Copy, and those that
// write where the Account's rights there let it (HEX-132).
import { useSystem } from '#/front/client/mapping/queries'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import type { CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'

import type { SearchChange, SystemSearch } from '../search/search'
import { System } from '../System'
import { visitTree } from './visit'

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

/**
 * Neither the agent nor a carry to the composer is offered on a System visited: a Turn starts at
 * home alone (HEX-134).
 */
const none = () => undefined

/**
 * The canvas side, someone else's System, thrown to the nearest boundary should its read fail: from
 * its star, its gaps hung from it, acted on as far as the Account's rights there let it (`Reach`); a
 * skeleton while it is read.
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
      // As far as the rights Mapping showed the visitor there let them: `Reach`, DEC-9.
      reach={{ visiting: data.rights }}
      search={search}
      pinned={data.pinned}
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
