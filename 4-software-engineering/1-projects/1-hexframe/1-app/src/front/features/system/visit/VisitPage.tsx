// Someone else's System on home's canvas while the URL visits it (HEX-127), the canvas side: read by
// its star as the Account may see it, from its card, the Tiles it may read below Tiles kept from it
// hung from the star across a gap, each Tile's menu holding the lines that look, Copy, those that
// write where the Account's rights there let it (HEX-132), and the agent's where it holds *@* there,
// the Turn then starting in that Tile, of their System (HEX-134); an Organization's, its owner's
// lines to its admins, its star's Members and Groups widgets to its members (HEX-136), and Ask to
// join to anyone outside it (HEX-138).
import { acrossGaps, type Direction } from '#/domains/mapping/entities'
import { useStandingIn } from '#/front/client/iam/organizations'
import { useSystem } from '#/front/client/mapping/queries'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import type { CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'

import type { SearchChange, SystemSearch } from '../search/search'
import { System } from '../System'
import { lightOf, visitTree } from './visit'

export interface VisitPageProps {
  /** The star of the System visited, someone else's. */
  star: string
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /** Who touches what the canvas draws, as the page holds it (`marks/`). */
  marks: CanvasMarks
  /**
   * Asks the agent through the chat about a Tile visited, or for a new one under it, where the
   * Account holds *@*: the chat names it first, so the Turn starts there.
   */
  onAsk: (tile: string, place?: Direction) => void
}

/** Nothing to export from a System visited, whose export is its owner's alone. */
const noExport = { start: () => undefined, pending: false }

/** No carry to the composer is offered on a System visited: the agent's line names a Tile there. */
const none = () => undefined

/**
 * The canvas side, someone else's System, thrown to the nearest boundary should its read fail: from
 * its star, its gaps hung from it, acted on as far as the Account's rights there let it (`Reach`); a
 * skeleton while it is read.
 */
export function VisitPage(props: VisitPageProps) {
  const { star, search, onSearchChange, onViewChange, marks, onAsk } = props
  const { data } = useSystem({ star })
  // Where the Account stands in the Organization the star names, if any, read without throwing: a menu line.
  const { data: standing } = useStandingIn(star)
  if (data === undefined) return <Skeleton className="min-h-0 flex-1" />
  return (
    <System
      system={data.system}
      root={data.root}
      across={acrossGaps(data.system, data.gaps, data.pinned)}
      tree={visitTree(data)}
      underway={data.underway}
      // As far as the rights Mapping showed the visitor there let them, its owner's lines to an
      // Organization's admin: `Reach`, DEC-9, DEC-13.
      reach={{
        visiting: data.rights,
        asOwner: data.asOwner,
        standing,
      }}
      search={search}
      pinned={data.pinned}
      onViewChange={onViewChange}
      onSearchChange={onSearchChange}
      exporting={noExport}
      marks={marks}
      onAsk={onAsk}
      onCarry={none}
      sun={{ light: lightOf(star, standing) }}
      className="min-h-0 flex-1"
    />
  )
}
