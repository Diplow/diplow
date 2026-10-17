// A System hexframe ships on the canvas, Help or the tutorial, read-only: no empty slot takes a click
// and no Tile offers a swap, so a reader only looks around, as on home, the Root alone and large, its
// preview whole, until a click opens it, a Tile centered landing with its own around it; the tutorial
// by its own rules, what it has not introduced yet absent (`tutorial/rules.ts`), the part of its
// center's words the agent tells of lit, its center inviting the click that opens it once they are
// told, its six arriving one by one, their hover cards alone. In the chat,
// under the agent's lines, its offer to read the centered topic of Help's page in full, in the help
// widget. Like the canvas, it holds no state: the view is the URL's, and the route navigates.
import { m } from '#/paraglide/messages'
import { Act, voiceOf } from '#/front/ui/atoms/controls/act'
import { Canvas } from '#/front/ui/canvas/Canvas'
import type { ToldPart } from '#/front/ui/motion'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { showView, type CanvasView } from '#/front/ui/canvas/view/view'

import type { TutorialRules } from './tutorial/rules'

interface ShippedCanvasProps {
  /** The shipped System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  /**
   * The tutorial's rules, what its menus and Tiles let through. Without them, Help's, every way of
   * looking.
   */
  rules?: TutorialRules | undefined
  /** The part of the center's words the agent tells of, lit: the tutorial's, as its rules tell them. */
  told?: ToldPart | undefined
  className?: string
}

/**
 * A System hexframe ships on the canvas, which only changes the view: each Tile's menu holds the lines
 * that go somewhere, its Context among them, beside its hover card (`looking`, never `acting`); the
 * tutorial's only where it lets them through, its hover card alone where it lets that through, its
 * center opening only once it lets a click through, which it then invites, its six arriving one by
 * one (HEX-121), the part of its words the agent tells of lit (HEX-120).
 */
export function ShippedCanvas(props: ShippedCanvasProps) {
  const { tree, view, onViewChange, rules, told, className } = props
  return (
    <Canvas
      system={tree}
      view={view}
      onViewChange={onViewChange}
      looking={rules?.looking ?? true}
      {...(rules && { lets: rules.lets, introduces: rules.introduces })}
      marks={{ told }}
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
