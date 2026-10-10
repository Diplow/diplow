// The breadcrumb above the canvas: the centered Tile's ancestors, from the System's root down to the
// centered Tile, in one line that wraps. A click on an ancestor centers it; like the canvas, the trail
// holds no view and hands the next one to the route, with the gesture that asked for it.
import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { pathTo, type TileNode } from '#/front/ui/hex/view/tiles'
import { centerOn, showView, type CanvasView, type ViewAction } from '#/front/ui/hex/view/view'

interface BreadcrumbProps {
  system: TileNode
  view: CanvasView
  onViewChange: (view: CanvasView, action: ViewAction) => void
  className?: string
}

export function Breadcrumb({ system, view, onViewChange, className }: BreadcrumbProps) {
  const center = showView(system, view).center
  const ancestors = pathTo(system, center.id)
  return (
    <nav aria-label={m.breadcrumb_label()} className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {ancestors.map((tile, index) => {
          const centered = tile.id === center.id
          return (
            <li key={tile.id} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <HexGlyph centered={centered} />
              {centered ? (
                <span aria-current="location" className="min-w-0 text-sm font-semibold">
                  {tile.title}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={m.hex_tile_center({ title: tile.title })}
                  className="min-w-0 rounded-sm text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => {
                    onViewChange(centerOn(system, tile.id), { gesture: 'center', tile: tile.id })
                  }}
                >
                  {tile.title}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** A small pointy-top hex, as on the canvas: the centered Tile filled, its ancestors outlined. */
function HexGlyph({ centered }: { centered: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0">
      <polygon
        points="12,1.5 21.5,7 21.5,17 12,22.5 2.5,17 2.5,7"
        strokeWidth={1.5}
        strokeLinejoin="round"
        className={centered ? 'fill-primary stroke-primary' : 'fill-card stroke-border'}
      />
    </svg>
  )
}
