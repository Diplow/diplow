// The breadcrumb rail beside the canvas: the centered Tile's ancestors, from the System's root down
// to the centered Tile. A click on an ancestor centers it; like the canvas, the rail holds no view
// and hands the next one to the route.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'
import type { TileNode } from '#/front/ui/hex/geometry/layout'
import { centerOn, pathTo, showView, type CanvasView } from '#/front/ui/hex/view/view'

interface BreadcrumbProps {
  system: TileNode
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  className?: string
}

export function Breadcrumb({ system, view, onViewChange, className }: BreadcrumbProps) {
  const center = showView(system, view).center
  const ancestors = pathTo(system, center.id)
  return (
    <nav aria-label={m.breadcrumb_label()} className={cn('min-h-0 overflow-y-auto', className)}>
      <ol className="grid">
        {ancestors.map((tile, index) => {
          const centered = tile.id === center.id
          return (
            <li key={tile.id} className="relative flex items-start gap-2 py-1.5">
              {/* The rail: a line from this hex's center to the next one's, however tall a
                  wrapped title makes either row: each hex sits at the top of its row. */}
              {index < ancestors.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-[1.125rem] -bottom-[1.125rem] left-3 w-px -translate-x-1/2 bg-border"
                />
              )}
              <HexGlyph centered={centered} />
              {centered ? (
                <span aria-current="location" className="min-w-0 pt-0.5 text-sm font-semibold">
                  {tile.title}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={m.hex_tile_center({ title: tile.title })}
                  className="mt-0.5 min-w-0 rounded-sm text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => {
                    onViewChange(centerOn(system, view, tile.id))
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
    <svg aria-hidden viewBox="0 0 24 24" className="relative size-6 shrink-0">
      <polygon
        points="12,1.5 21.5,7 21.5,17 12,22.5 2.5,17 2.5,7"
        strokeWidth={1.5}
        strokeLinejoin="round"
        className={centered ? 'fill-primary stroke-primary' : 'fill-card stroke-border'}
      />
    </svg>
  )
}
