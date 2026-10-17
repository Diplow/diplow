// The tutorial's own rules: what it has not introduced yet is absent. The one place that says, from
// the view the URL asks for, what the tutorial shows and what it lets through, which the canvas and
// the chat both read: a Tile's click, its menu, a Context, going in, the composer. No progress is
// kept: the step follows from the view alone. For now the tutorial has one step, its arrival, its
// center alone and large, which lets nothing through; each later step lifts exactly what it
// introduces ("hexframe app: Tutorial" in Linear). Pure.
import type { CanvasView } from '#/front/ui/canvas/view/view'

/** What the tutorial lets through, each thing once it has introduced it. */
export interface TutorialLets {
  /** The center opened by a click, Enter or Space. */
  open: boolean
  /** A Tile's menu, and its hover card beside it. */
  menu: boolean
  /** A Tile's Context, shown inside it. */
  context: boolean
  /** Going into a Tile, centering it. */
  goIn: boolean
  /** The composer, at the chat's foot: held back meanwhile, as during the onboarding. */
  composer: boolean
}

/** What the tutorial shows and lets through, on a view asked for. */
export interface TutorialRules {
  /** The view the tutorial shows: the one asked for, less what isn't introduced yet. */
  view: CanvasView
  lets: TutorialLets
}

/** The arrival: the center alone and large, nothing let through. */
const arrival: TutorialLets = {
  open: false,
  menu: false,
  context: false,
  goIn: false,
  composer: false,
}

/**
 * The tutorial's rules on the view the URL asks for: what isn't introduced is left out of it, so a
 * link that names a Tile below the center, a ring, an open Branch or a Context shows the center
 * alone, the arrival, as `/tutorial` does.
 */
export function tutorialRules(asked: CanvasView): TutorialRules {
  const lets = arrival
  return { view: shownWith(asked, lets), lets }
}

/** A view less what isn't let through: no Tile gone into, nothing opened, no Context shown. */
function shownWith(asked: CanvasView, lets: TutorialLets): CanvasView {
  const { center, frame, inner, expanded } = asked
  return {
    ...(lets.goIn && center !== undefined && { center }),
    ...(lets.open && frame !== undefined && { frame }),
    ...(lets.open && expanded !== undefined && { expanded }),
    ...(lets.context && inner !== undefined && { inner }),
  }
}
