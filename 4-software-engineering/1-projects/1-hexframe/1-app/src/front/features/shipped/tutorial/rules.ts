// The tutorial's own rules: what it has not introduced yet is absent. The one place that says, from
// the view the URL asks for, what the tutorial shows and what it lets through, as the canvas and the
// chat read it: the view, each Tile's menu and hover card, what a Tile answers, the composer. No
// progress is kept: the step follows from the view alone, and within its arrival from what the agent
// has told so far, a clock that plays again from the start whenever the tutorial arrives anew. Two
// steps for now. Its arrival, its center alone and large, tells the center's words in turn, its
// title, its preview, then its body in the chat (HEX-120), and lets nothing through until the body is
// told; then the center invites a click, which opens it (HEX-121). Opened, its six around it, each
// shows its hover card and answers nothing, the center folding back on a click. Each later step lifts
// exactly what it introduces ("hexframe app: Tutorial" in Linear). Pure.
import type { CanvasRules, Looking } from '#/front/ui/canvas/state/useCanvasState'
import type { CanvasView } from '#/front/ui/canvas/view/view'
import type { ToldPart } from '#/front/ui/motion'

/**
 * What the tutorial shows and lets through, on a view asked for, as the canvas and the chat take it:
 * the canvas's rules, the view it shows the one asked for less what isn't introduced yet, and the
 * composer.
 */
export interface TutorialRules extends CanvasRules {
  /** The composer, at the chat's foot: held back meanwhile, as during the onboarding. */
  composer: boolean
  /**
   * The agent tells the center's words in turn, as the canvas lights each: its title, its preview,
   * then its body in the chat (HEX-120), which stays told once the center opens.
   */
  tells: boolean
}

/** What a step of the tutorial has introduced. */
interface Step {
  /** The center opened, or folded back, by a click, Enter or Space; and its ring shown. */
  open: boolean
  /** A Tile's hover card, its title and its preview (`card`), and its menu beside it (`true`). */
  looking: Looking
  /** The center moved to another Tile, going into it or out. */
  recenter: boolean
  composer: boolean
  /** The center's words told in turn. */
  tells: boolean
}

/**
 * The arrival: the center alone and large, its words told in turn, and, once its body is told,
 * opening it, the one thing that answers.
 */
const arrival = (told: ToldPart | undefined): Step => ({
  open: told === 'body',
  looking: false,
  recenter: false,
  composer: false,
  tells: true,
})

/**
 * The center opened, its six around it, each with its hover card, its title and its preview, both
 * told already; its body stays told in the chat.
 */
const opened: Step = {
  open: true,
  looking: 'card',
  recenter: false,
  composer: false,
  tells: true,
}

/**
 * The tutorial's rules on the view the URL asks for, the agent having told `told` of its center's
 * words: what isn't introduced is left out of it, so a link that names a Tile below the center, an
 * open Branch or a Context shows the center as `/tutorial` does. The center's ring asked for is the
 * opened step, whatever was told: a link may land there. A Context is introduced by no step, so none
 * shows, nor does a Branch opened in place.
 */
export function tutorialRules(asked: CanvasView, told?: ToldPart): TutorialRules {
  const step = stepOf(asked, told)
  return {
    view: shownWith(asked, step),
    looking: step.looking,
    lets: (hex) => ({ click: step.open && hex.role === 'center', recenter: step.recenter }),
    introducesOpening: step.open,
    composer: step.composer,
    tells: step.tells,
  }
}

/** The step a view asked for is: the center's ring asked for, opened; else the arrival. */
const stepOf = (asked: CanvasView, told?: ToldPart) =>
  asked.frame === undefined ? arrival(told) : opened

/**
 * Whether the agent tells the center's words in turn on the view asked for, whatever it has told so
 * far: what starts the clock that `tutorialRules` then reads (`useTold`).
 */
export const tutorialTells = (asked: CanvasView): boolean => stepOf(asked).tells

/**
 * A view less what a step hasn't introduced: no Tile gone into, no Branch open, no Context, and of
 * the rings around the center, its six Children alone, the ring its tile tells of, whichever was
 * asked for.
 */
function shownWith(asked: CanvasView, step: Step): CanvasView {
  const { center, frame } = asked
  return {
    ...(step.recenter && center !== undefined && { center }),
    ...(step.open && frame !== undefined && { frame: 'children' as const }),
  }
}
