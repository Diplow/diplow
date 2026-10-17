// Someone else's System on home's canvas while the URL visits it (HEX-127), the canvas side: read by
// its star as the Account may see it, from its card, the Tiles it may read below Tiles kept from it
// hung from the star across a gap, and each Tile offering only what the visitor's rights there let
// through.
import { useSystem } from '#/front/client/mapping/queries'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import type { CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'

import type { SearchChange, SystemSearch } from '../search/search'
import { System } from '../System'
import { visiting, visitTree } from './visit'

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
