// A System on the canvas, the user's or one they visit, and acting on it where their rights on each
// Tile let them (HEX-127): each Tile's menu and hover card, each
// free slot's menu, a click on a free slot opening the new Tile's form there, and a Tile moved, dragged
// under a mouse, from its menu's frame or through "Somewhere else…", its free slots offering
// themselves and the Tiles it can trade places with their swap. A write ends its change as it is sent,
// and comes back if it is refused (`state/useRefusalState.ts`). Every Tile a write on its way changes
// shows it, and flares once it is refused (`state/useWritesState.ts`). A delete asks first, in a
// dialog. The agent's lines ask through the chat, and a Tile dragged off the canvas is carried over
// the page, for the composer to name (HEX-110). While a write to the System is on its way, closing or reloading the tab asks first.
// Like the canvas, it holds no state of its own: the view and the change under way are the URL's,
// and it hands the next view, with the gesture that asked for it, and the next search params to the
// route.
import { cn } from 'cn'

import type { Direction, System as FlatSystem, SystemTile } from '#/domains/mapping/entities'
import type { Underway } from '#/front/client/mapping/overlay/overlay'
import { useSystemWriting } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { useLeaveGuard } from '#/front/ui/canvas/atoms/useLeaveGuard'
import { Canvas, type CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CarriedTile } from '#/front/ui/canvas/state/move/carry'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'
import { Dialog } from '#/front/ui/layouts/Dialog'

import type { Reach } from './acting'
import { viewOf, type SearchChange, type SystemSearch } from './search/search'
import { useActingState } from './state/useActingState'
import { useWritesState } from './state/useWritesState'
import type { Exported } from './widget/state/useTileWidgetsState'

interface SystemProps {
  /** The System as the page shows it, flat, which Mapping's `decide` rules on. */
  system: FlatSystem
  /** Its tree, Mapping's, from the Root. */
  root: SystemTile
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  /** What the writes on their way change (`useSystem`). */
  underway: Underway
  /**
   * What the user may do on it, Tile by Tile: a line, a free slot or a move their rights don't let
   * through is not offered.
   */
  reach: Reach
  search: SystemSearch
  /** The next view, after a gesture on the canvas, and the gesture, on which Tile. */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  onSearchChange: (change: SearchChange) => void
  /** Exports a Tile, which the chat shows. */
  exporting: { start: (exported: Exported) => void; pending: boolean }
  /** Who touches what the canvas draws, as the page holds it (`marks/`). */
  marks: CanvasMarks
  /** The agent asked through the chat, from a menu: about a Tile, or for one under it at a place. */
  onAsk: (tile: string, place?: Direction) => void
  /** A Tile carried off the canvas, which the composer names where it is let go; none once let go. */
  onCarry: (tile: CarriedTile | undefined) => void
  className?: string
}

export function System({
  system,
  root,
  tree,
  underway,
  reach,
  search,
  onViewChange,
  onSearchChange,
  exporting,
  marks,
  onAsk,
  onCarry,
  className,
}: SystemProps) {
  const writes = useWritesState(underway)
  useLeaveGuard(useSystemWriting())
  const { acting, emptySlots, move, deleting } = useActingState({
    systems: { root, flat: system, tree, reach },
    search,
    onSearchChange,
    exporting,
    onAsk,
  })
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Canvas
        system={tree}
        view={viewOf(search)}
        onViewChange={onViewChange}
        emptySlots={emptySlots}
        acting={acting}
        move={move}
        writes={writes}
        marks={marks}
        onCarry={onCarry}
        className="min-h-0 w-full flex-1"
      />
      <Dialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) deleting?.cancel()
        }}
        kicker={m.widget_tile_delete_kicker()}
        title={m.system_delete_title({ title: deleting?.title ?? '' })}
        confirmLabel={
          deleting === undefined || deleting.below === 0
            ? m.system_delete()
            : m.widget_tile_delete_count({ count: String(deleting.below + 1) })
        }
        onConfirm={() => deleting?.confirm()}
      >
        {m.system_delete_description({ title: deleting?.title ?? '' })}
      </Dialog>
    </div>
  )
}
