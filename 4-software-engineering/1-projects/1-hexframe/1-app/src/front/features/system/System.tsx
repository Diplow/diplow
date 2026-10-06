// The user's System on the canvas. A click on an empty slot opens the new Tile's form there, a Leaf's
// in a ring of Leaves, or, while a Tile is being moved, moves it there; meanwhile every other Tile
// offers to swap places with it.
// Like the canvas, it holds no state: the view and the change under way are the URL's, and it hands
// the next search params to the route.
import { cn } from 'cn'

import { useMoveTile, useSwapTiles } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { Canvas } from '#/front/ui/hex/Canvas'
import type { EmptySlotTarget } from '#/front/ui/hex/geometry/shape'
import { findTile, type TileNode } from '#/front/ui/hex/view/tiles'
import { Button } from '#/front/ui/inputs/controls/button'

import {
  changeOf,
  viewOf,
  withChange,
  withView,
  type SearchChange,
  type SystemSearch,
} from './search'
import type { System as FlatSystem } from '#/domains/mapping/entities'

import { slotOf, swapsWith } from './tree'

interface SystemProps {
  /** The System as the server read it, flat, which Mapping's `decide` rules on. */
  system: FlatSystem
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  className?: string
}

export function System({ system, tree, search, onSearchChange, className }: SystemProps) {
  const move = useMoveTile()
  const swap = useSwapTiles()
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

  // One write at a time: a slot clicked while the Tile is on its way does nothing. A refusal (a slot
  // under the Tile itself, one taken meanwhile, a swap along one line) shows in a toast, and the move
  // stays under way, so another slot can be picked. Done, it ends in the URL as it is by then,
  // whatever view the user opened meanwhile.
  const pending = move.isPending || swap.isPending
  const done = {
    onSuccess: () => {
      onSearchChange((current) => withChange(current, { kind: 'none' }))
    },
  }

  const moveHere = (tile: TileNode) => (target: EmptySlotTarget) => {
    const place = placeOf(target, tile)
    if (place === undefined) return undefined
    const names = { tile: tile.title, title: target.parent.title }
    return {
      label: target.ring === 'context' ? m.system_move_context(names) : m.system_move_child(names),
      onSelect: () => {
        if (!pending) move.mutate({ id: tile.id, ...place }, done)
      },
    }
  }

  const swapWith = (moving: TileNode) => (held: TileNode) =>
    swapsWith(system, moving, held)
      ? {
          label: m.system_swap_with({ title: held.title }),
          onSelect: () => {
            if (!pending) swap.mutate({ a: moving.id, b: held.id }, done)
          },
        }
      : undefined

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
        onViewChange={(view) => {
          onSearchChange(withView(search, view))
        }}
        emptySlots={moving === undefined ? addHere : moveHere(moving)}
        swapTargets={moving === undefined ? undefined : swapWith(moving)}
        className="min-h-0 w-full flex-1"
      />
    </div>
  )
}
