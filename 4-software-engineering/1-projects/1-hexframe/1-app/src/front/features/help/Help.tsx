// Help on the canvas, read-only: no empty slot takes a click and no Tile offers a swap, so a reader
// only looks around, as on home. At the canvas's foot, the centered Tile's card, whose button opens
// its page in the help widget, in the chat. Like the canvas, it holds no state: the view is the URL's,
// and the route navigates.
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/atoms/controls/button'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { Card } from '#/front/ui/canvas/layouts/Card'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { showView, type CanvasView } from '#/front/ui/canvas/view/view'

interface HelpCanvasProps {
  /** Help's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  className?: string
}

/** Help on the canvas, which only changes the view. */
export function HelpCanvas({ tree, view, onViewChange, className }: HelpCanvasProps) {
  return <Canvas system={tree} view={view} onViewChange={onViewChange} className={className} />
}

interface HelpTileProps {
  tree: TileNode
  view: CanvasView
  /** Opens this Tile's page in the help widget. */
  onRead: (id: string) => void
}

/** The centered Tile's card: its Title, its Preview, and Read, which opens its page in the chat. */
export function HelpTile({ tree, view, onRead }: HelpTileProps) {
  const center = showView(tree, view).center
  return (
    <Card
      title={center.title}
      description={center.preview === '' ? undefined : center.preview}
      footer={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onRead(center.id)
          }}
        >
          {m.help_read()}
        </Button>
      }
    />
  )
}
