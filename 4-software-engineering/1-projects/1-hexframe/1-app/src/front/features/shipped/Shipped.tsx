// A System hexframe ships on the canvas, Help or the tutorial, read-only: no empty slot takes a click
// and no Tile offers a swap, so a reader only looks around, as on home, the Root alone and large, its
// preview whole, until a click opens it, a Tile centered landing with its own around it; the tutorial
// by its own rules, what it has not introduced yet absent (`tutorial/rules.ts`). In the chat,
// under the agent's lines, its offer to read the centered topic of Help's page in full, in the help
// widget. Like the canvas, it holds no state: the view is the URL's, and the route navigates.
import { m } from '#/paraglide/messages'
import { Act, voiceOf } from '#/front/ui/atoms/controls/act'
import { Canvas } from '#/front/ui/canvas/Canvas'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { showView, type CanvasView } from '#/front/ui/canvas/view/view'

import type { TutorialLets } from './tutorial/rules'

interface ShippedCanvasProps {
  /** The shipped System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  /**
   * What the tutorial lets through, by its rules: the center's click, the menus, going in. Without
   * it, Help's, every way of looking.
   */
  lets?: TutorialLets | undefined
  className?: string
}

/**
 * A System hexframe ships on the canvas, which only changes the view: each Tile's menu holds the lines
 * that go somewhere, its Context among them, beside its hover card (`looking`, never `acting`); the
 * tutorial's only where it lets them through, its center opening only once it lets a click through.
 */
export function ShippedCanvas({ tree, view, onViewChange, lets, className }: ShippedCanvasProps) {
  return (
    <Canvas
      system={tree}
      view={view}
      onViewChange={onViewChange}
      looking={lets?.menu ?? true}
      {...(lets && {
        lets: (hex) => ({ click: lets.open && hex.role === 'center', goIn: lets.goIn }),
      })}
      className={className}
    />
  )
}

interface HelpReadProps {
  tree: TileNode
  view: CanvasView
  /** Opens this Tile's page in the help widget. */
  onRead: (id: string) => void
}

/**
 * The agent's offer to read the centered topic's page in full, whose preview alone the canvas shows:
 * a quiet act in its voice, following the canvas, where the centered Tile's card and its Read were.
 */
export function HelpRead({ tree, view, onRead }: HelpReadProps) {
  const center = showView(tree, view).center
  return (
    <Act
      tone="voice"
      className={voiceOf('agent')}
      onClick={() => {
        onRead(center.id)
      }}
    >
      {m.help_read_in_full({ title: center.title })}
    </Act>
  )
}
