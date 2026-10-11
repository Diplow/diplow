// The user's System on the canvas. A click on an empty slot opens the new Tile's form there, a Leaf's
// in a ring of Leaves, or, while a Tile is being moved, moves it there; meanwhile every other Tile
// offers to swap places with it. A move or a swap ends the moment it is sent, and comes back if its
// write is refused (`state/useRefusalState.ts`). While a write to the System is on its way, closing or
// reloading the tab asks first.
// Like the canvas, it holds no state: the view and the change under way are the URL's, and it hands
// the next view, with the gesture that asked for it, and the next search params to the route.
import { cn } from 'cn'

import { useMoveTile, useSwapTiles, useSystemWriting } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { useLeaveGuard } from '#/front/ui/feedback/useLeaveGuard'
import { Canvas } from '#/front/ui/hex/Canvas'
import type { EmptySlotTarget } from '#/front/ui/hex/geometry/shape'
import { findTile, type TileNode } from '#/front/ui/hex/view/tiles'
import type { CanvasView, ViewAction } from '#/front/ui/hex/view/view'
import { Button } from '#/front/ui/inputs/controls/button'

import { changeOf, viewOf, withChange, type SearchChange, type SystemSearch } from './search/search'
import type { System as FlatSystem } from '#/domains/mapping/entities'

import { moveOf, slotOf, swapOf, swapsWith } from './tree'

interface SystemProps {
  /** The System as the page shows it, flat, which Mapping's `decide` rules on. */
  system: FlatSystem
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  /** The next view, after a gesture on the canvas, and the gesture, on which Tile. */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  onSearchChange: (change: SearchChange) => void
  className?: string
}

export function System({
  system,
  tree,
  search,
  onViewChange,
  onSearchChange,
  className,
}: SystemProps) {
  const move = useMoveTile()
  const swap = useSwapTiles()
  useLeaveGuard(useSystemWriting())
  const change = changeOf(search)
  // A move whose Tile is gone (deleted from another tab, an old link) is no move: no banner, and the
  // empty slots add a Tile, the first of which replaces the move in the URL.
  const moving = change.kind === 'move' ? findTile(tree, change.id) : undefined

  /** The slot an empty Direction stands for, for a new Tile or the moving one; none takes no click. */
  const placeOf = (target: EmptySlotTarget, going?: TileNode) => {
    const slot = slotOf(target.ring, target.direction, going)
    return slot === undefined ? undefined : { parent: target.parent.id, slot }
  }

  const addHere = (target: EmptySlotTarget) => {
    const place = placeOf(target)
    if (place === undefined) return undefined
    const { title } = target.parent
    const labels = {
      children: m.system_add_child,
      branches: m.system_add_child,
      leaves: m.system_add_leaf,
      context: m.system_add_context,
    }
    return {
      label: labels[target.ring]({ title }),
      onSelect: () => {
        onSearchChange(withChange(search, { kind: 'add', ...place }))
      },
    }
  }

  // The canvas shows the Tile where it goes at once, the writes run in the order they were made, and
  // the move ends as it is sent. A refusal (a slot under the Tile itself, one taken meanwhile, a swap
  // along one line) shows in a toast, and the move is under way again, so another slot can be picked.
  const sent = () => {
    onSearchChange((current) => withChange(current, { kind: 'none' }))
  }

  // Each write names the Version of every Tile it changes as the canvas drew it, so a change made
  // meanwhile elsewhere refuses it rather than being overwritten.
  const moveHere = (tile: TileNode) => (target: EmptySlotTarget) => {
    const place = placeOf(target, tile)
    const moved = place === undefined ? undefined : moveOf(system, tile.id, place)
    if (moved === undefined) return undefined
    const names = { tile: tile.title, title: target.parent.title }
    return {
      label: target.ring === 'context' ? m.system_move_context(names) : m.system_move_child(names),
      onSelect: () => {
        move.mutate(moved)
        sent()
      },
    }
  }

  const swapWith = (moving: TileNode) => (held: TileNode) => {
    const swapped = swapOf(system, moving.id, held.id)
    return swapped !== undefined && swapsWith(system, moving, held)
      ? {
          label: m.system_swap_with({ title: held.title }),
          onSelect: () => {
            swap.mutate(swapped)
            sent()
          },
        }
      : undefined
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {moving !== undefined && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-lg border border-brand bg-card px-4 py-2 text-sm"
        >
          <span>{m.system_moving({ title: moving.title })}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSearchChange(withChange(search, { kind: 'none' }))
            }}
          >
            {m.ui_cancel()}
          </Button>
        </div>
      )}
      <Canvas
        system={tree}
        view={viewOf(search)}
        onViewChange={onViewChange}
        emptySlots={moving === undefined ? addHere : moveHere(moving)}
        swapTargets={moving === undefined ? undefined : swapWith(moving)}
        className="min-h-0 w-full flex-1"
      />
    </div>
  )
}
