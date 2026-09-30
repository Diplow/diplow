// The user's System on the canvas. A click on an empty slot opens the new Tile's form there, or, while
// a Tile is being moved, moves it there. Like the canvas, it holds no state: the view and the change
// under way are the URL's, and it hands the next search params to the route.
import { cn } from 'cn'

import { useMoveTile } from '#/api/domains/mapping/queries'
import { m } from '#/paraglide/messages'
import { Canvas, type EmptySlotTarget } from '#/ui/hex/Canvas'
import type { TileNode } from '#/ui/hex/geometry/layout'
import { findTile } from '#/ui/hex/view/view'
import { Button } from '#/ui/inputs/controls/button'

import { changeOf, viewOf, withChange, withView, type SystemSearch } from './search'
import { slotOf } from './tree'

interface SystemProps {
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (search: SystemSearch) => void
  className?: string
}

export function System({ tree, search, onSearchChange, className }: SystemProps) {
  const move = useMoveTile()
  const change = changeOf(search)
  const moving = change.kind === 'move' ? findTile(tree, change.id) : undefined

  const place = (slot: EmptySlotTarget) => ({
    parent: slot.parent.id,
    slot: slotOf(slot.ring, slot.direction),
  })

  const addHere = {
    label: ({ parent, ring }: EmptySlotTarget) =>
      ring === 'children'
        ? m.system_add_child({ title: parent.title })
        : m.system_add_context({ title: parent.title }),
    onSelect: (slot: EmptySlotTarget) => {
      onSearchChange(withChange(search, { kind: 'add', ...place(slot) }))
    },
  }

  const moveHere = (tile: TileNode) => ({
    label: ({ parent, ring }: EmptySlotTarget) =>
      ring === 'children'
        ? m.system_move_child({ tile: tile.title, title: parent.title })
        : m.system_move_context({ tile: tile.title, title: parent.title }),
    onSelect: (slot: EmptySlotTarget) => {
      // A refusal (a slot under the Tile itself, one taken meanwhile) shows in a toast, and the move
      // stays under way, so another slot can be picked.
      move.mutate(
        { id: tile.id, ...place(slot) },
        {
          onSuccess: () => {
            onSearchChange(withChange(search, { kind: 'none' }))
          },
        },
      )
    },
  })

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
        className="min-h-0 w-full flex-1"
      />
    </div>
  )
}
