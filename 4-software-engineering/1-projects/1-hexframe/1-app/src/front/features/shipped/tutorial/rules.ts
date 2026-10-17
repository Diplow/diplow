// The tutorial's own rules: what it has not introduced yet is absent. The one place that says, from
// the view the URL asks for, what the tutorial shows and what it lets through, as the canvas and the
// chat read it: the view, each Tile's menu, what a Tile answers, the composer. No progress is kept:
// the step follows from the view alone. For now the tutorial has one step, its arrival, its center
// alone and large, which lets nothing through; each later step lifts exactly what it introduces
// ("hexframe app: Tutorial" in Linear). Pure.
import type { TileHex, TileLets } from '#/front/ui/canvas/state/useCanvasState'
import type { CanvasView } from '#/front/ui/canvas/view/view'

/** What the tutorial shows and lets through, on a view asked for, as the canvas and the chat take it. */
export interface TutorialRules {
  /** The view the tutorial shows: the one asked for, less what isn't introduced yet. */
  view: CanvasView
  /** Each Tile's menu, the view's lines alone, beside its hover card. */
  looking: boolean
  /** What each Tile answers: the center's click, moving the center. */
  lets: (hex: TileHex) => TileLets
  /** The composer, at the chat's foot: held back meanwhile, as during the onboarding. */
  composer: boolean
}

/** What a step of the tutorial has introduced. */
interface Step {
  /** The center opened by a click, Enter or Space. */
  open: boolean
  /** A Tile's menu, and its hover card beside it. */
  menu: boolean
  /** The center moved to another Tile, going into it or out. */
  recenter: boolean
  composer: boolean
}

/** The arrival: the center alone and large, nothing introduced. */
const arrival: Step = { open: false, menu: false, recenter: false, composer: false }

/**
 * The tutorial's rules on the view the URL asks for: what isn't introduced is left out of it, so a
 * link that names a Tile below the center, a ring or an open Branch shows the center alone, the
 * arrival, as `/tutorial` does. A Context is introduced by no step, so none shows.
 */
export function tutorialRules(asked: CanvasView): TutorialRules {
  const step = arrival
  return {
    view: shownWith(asked, step),
    looking: step.menu,
    lets: (hex) => ({ click: step.open && hex.role === 'center', recenter: step.recenter }),
    composer: step.composer,
  }
}

/** A view less what a step hasn't introduced: no Tile gone into, nothing opened, no Context. */
function shownWith(asked: CanvasView, step: Step): CanvasView {
  const { center, frame, expanded } = asked
  return {
    ...(step.recenter && center !== undefined && { center }),
    ...(step.open && frame !== undefined && { frame }),
    ...(step.open && expanded !== undefined && { expanded }),
  }
}
