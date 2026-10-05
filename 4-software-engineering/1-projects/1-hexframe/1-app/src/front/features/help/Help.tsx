// Help on the canvas, read-only: no empty slot takes a click and no Tile offers a swap, so a reader
// only looks around, as on home. Beside it, the centered Tile's card, whose button opens its Body in a
// drawer. Like the canvas, it holds no state: the view and the open Body are the URL's, and it hands
// the next search params to the route.
import { m } from '#/paraglide/messages'
import { Canvas } from '#/front/ui/hex/Canvas'
import type { TileNode } from '#/front/ui/hex/geometry/layout'
import { showView } from '#/front/ui/hex/view/view'
import { Button } from '#/front/ui/inputs/controls/button'
import { Drawer } from '#/front/ui/overlays/Drawer'
import { Card } from '#/front/ui/surfaces/Card'

import { viewOf, withOpen, withView, type HelpSearch } from './search'

interface HelpProps {
  /** Help's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: HelpSearch
  onSearchChange: (search: HelpSearch) => void
  className?: string
}

/** Help on the canvas, which only changes the view. */
export function HelpCanvas({ tree, search, onSearchChange, className }: HelpProps) {
  return (
    <Canvas
      system={tree}
      view={viewOf(search)}
      onViewChange={(view) => {
        onSearchChange(withView(search, view))
      }}
      className={className}
    />
  )
}

/** A Tile of Help as its drawer shows it: what it says, its Body as written, in Markdown. */
interface OpenedTile {
  readonly title: string
  readonly preview: string
  readonly body: string
}

interface HelpTileProps extends Omit<HelpProps, 'className'> {
  /** The Tile whose Body is open, `undefined` when none is or the URL names no Tile of Help. */
  opened: OpenedTile | undefined
}

/** The centered Tile's card, whose button opens its Body, and the drawer that shows it. */
export function HelpTile({ tree, search, onSearchChange, opened }: HelpTileProps) {
  const center = showView(tree, viewOf(search)).center
  return (
    <>
      <Card
        title={center.title}
        description={center.preview === '' ? undefined : center.preview}
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSearchChange(withOpen(search, center.id))
            }}
          >
            {m.help_read()}
          </Button>
        }
      />
      <Drawer
        open={opened !== undefined}
        onOpenChange={(open) => {
          if (!open) onSearchChange(withOpen(search, undefined))
        }}
        title={opened?.title}
        description={opened?.preview}
      >
        <p className="pb-4 text-sm whitespace-pre-wrap">{opened?.body}</p>
      </Drawer>
    </>
  )
}
