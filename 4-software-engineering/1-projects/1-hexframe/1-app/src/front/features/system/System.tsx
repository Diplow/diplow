// A System on the canvas, the user's, or one they visit, which they only look at for now (HEX-127),
// and acting on it where it is: each Tile's menu and hover card, each
// free slot's menu, a click on a free slot opening the new Tile's form there, and a Tile moved, dragged
// under a mouse, from its menu's frame or through "Somewhere else…", its free slots offering
// themselves and the Tiles it can trade places with their swap. A write ends its change as it is sent,
// and comes back if it is refused (`state/useRefusalState.ts`). Every Tile a write on its way changes
// shows it, and flares once it is refused (`state/useWritesState.ts`). A delete asks first, in a
// dialog. The agent's lines ask through the chat, and a Tile dragged off the canvas is carried over
// the page, for the composer to name (HEX-110). While a write to the System is on its way, closing or reloading the tab asks first.
// Like the canvas, it holds no state of its own: the view and the change under way are the URL's,
// and it hands the next view, with the gesture that asked for it, and the next search params to the
// route; but a gesture following a pin, a Reference to a Tile of another System, which it visits by
// its link, since it alone holds the pins of the System it draws, own or visited (HEX-133).
import { useRouter } from '@tanstack/react-router'
import { cn } from 'cn'

import type {
  Direction,
  PinnedTiles,
  System as FlatSystem,
  SystemTile,
} from '#/domains/mapping/entities'
import type { Underway } from '#/front/client/mapping/overlay/overlay'
import { useSystemWriting } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { useLeaveGuard } from '#/front/ui/canvas/atoms/useLeaveGuard'
import { Canvas, type CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CarriedTile } from '#/front/ui/canvas/state/move/carry'
import type { Sun, TileNode } from '#/front/ui/canvas/view/tiles'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'
import { Dialog } from '#/front/ui/layouts/Dialog'

import type { Reach } from './acting'
import { viewOf, type SearchChange, type SystemSearch } from './search/search'
import { useActingState } from './state/useActingState'
import { pinFollowed } from './visit/visit'
import { useWritesState } from './state/useWritesState'
import type { Exported } from './widget/state/useTileWidgetsState'

interface SystemProps {
  /** The System as the page shows it, flat, which Mapping's `decide` rules on. */
  system: FlatSystem
  /** Its tree, Mapping's, from the Root. */
  root: SystemTile
  /**
   * The Tiles hung from its star across a gap, each a tree of its own (Mapping's `acrossGaps`): none
   * on the user's own.
   */
  across: ReadonlyArray<SystemTile>
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  /** What the writes on their way change (`useSystem`). */
  underway: Underway
  /**
   * How far the user acts on it: their own, every line; someone else's, visited, looked at and copied
   * from alone, no free slot, move or line that acts offered (`Reach`).
   */
  reach: Reach
  search: SystemSearch
  /**
   * The Tiles of other Systems its References point at that the user may read, by id: a gesture
   * following one visits it by its link rather than changing the view (`pinFollowed`).
   */
  pinned: PinnedTiles
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
  /** Its star's light: the user's, amber, someone's they visit, or an Organization's, rose. */
  sun: Sun
  className?: string
}

export function System({
  system,
  root,
  across,
  tree,
  underway,
  reach,
  search,
  pinned,
  onViewChange,
  onSearchChange,
  exporting,
  marks,
  onAsk,
  onCarry,
  sun,
  className,
}: SystemProps) {
  const router = useRouter()
  const writes = useWritesState(underway)
  useLeaveGuard(useSystemWriting())
  const { acting, emptySlots, move, deleting } = useActingState({
    systems: { root, across, flat: system, tree, reach },
    search,
    onSearchChange,
    exporting,
    onAsk,
  })
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Canvas
        system={tree}
        cycles
        view={viewOf(search)}
        onViewChange={(view, action) => {
          const pin = pinFollowed(pinned, action)
          if (pin === undefined) onViewChange(view, action)
          else void router.navigate({ to: '/t/$id', params: { id: pin } })
        }}
        emptySlots={emptySlots}
        acting={acting}
        move={move}
        writes={writes}
        marks={marks}
        onCarry={onCarry}
        sun={sun}
        runsOn
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
