// What home carries in its URL of the Systems hexframe ships, each in a param of its own, which says
// the System is open on one of its Tiles, by its id, or on `true`, its Root, which a link cannot name
// before it is read. `help`: the help widget open on a topic, Help on the canvas while it is, signed
// in, in the view's fields, the System's otherwise, the widget's page following the Tile centered.
// `tutorial`: the tutorial on the canvas, centered on that Tile, the one field that names where it
// stands, the view's other fields the canvas's. An old link to the Help page, its view and `open`, the
// Tile whose Body was open, lands on home as these. Pure.
import { Schema } from 'effect'

import type { ShippedRoot } from '#/domains/mapping/entities'
import {
  CanvasView,
  orDefault,
  readSearch,
  TileId,
  viewIn,
  withViewIn,
} from '#/front/ui/canvas/view/view'
import type { ToldPart } from '#/front/ui/motion'

import { tutorialRules, type TutorialRules } from './tutorial/rules'

/** Where a System hexframe ships is open: one of its Tiles by its id, or `true`, its Root. */
const ShippedAt = Schema.optionalKey(orDefault(Schema.Union([Schema.Literal(true), TileId])))

const HelpSearch = Schema.Struct({
  /** The help widget's topic; closed when absent. */
  help: ShippedAt,
})

export type HelpSearch = typeof HelpSearch.Type

/** Reads the URL's search param, which falls back on the widget closed. */
export const readHelpSearch = readSearch(HelpSearch)

/** The id of the topic the widget reads: the one the URL names, or Help's Root; none while closed. */
export const topicOf = ({ help }: HelpSearch, root: string): string | undefined =>
  help === true ? root : help

/** The search param with the widget open on this topic, or closed. */
export const withHelp = (topic: string | true | undefined): HelpSearch => ({ help: topic })

/**
 * A page's search params with the widget turned to a topic, the rest kept, and, given `view`, the
 * canvas on that view: centered on the topic, as a topic it reads on and Open in Help do.
 */
export function turnedTo<S extends CanvasView & HelpSearch>(
  search: S,
  id: string,
  view?: CanvasView,
): S {
  return { ...(view === undefined ? search : withViewIn(search, view)), help: id }
}

const TutorialSearch = Schema.Struct({
  /** The Tile the tutorial is centered on, on the canvas; the canvas is the System's when absent. */
  tutorial: ShippedAt,
})

export type TutorialSearch = typeof TutorialSearch.Type

/** Reads the URL's search param, which falls back on the tutorial away from the canvas. */
export const readTutorialSearch = readSearch(TutorialSearch)

/** The search param with the tutorial on the canvas, centered on this Tile or its Root, or gone. */
export const withTutorial = (at: string | true | undefined): TutorialSearch => ({ tutorial: at })

/**
 * The tutorial's view on the canvas: centered on the Tile its param names, its Root for `true`, the
 * view's other fields the URL's, the canvas's while the tutorial has it. The URL's `center` is the
 * System's, never the tutorial's.
 */
export const tutorialViewOf = (search: CanvasView & TutorialSearch): CanvasView => ({
  ...viewIn(search),
  center: search.tutorial === true ? undefined : search.tutorial,
})

/**
 * A page's search params with the tutorial's canvas on `view`, the rest kept: the Tile centered in
 * the tutorial's param, the one field that names it, and none in the view's `center`.
 */
export const tutorialOn = <S extends CanvasView & TutorialSearch>(
  search: S,
  view: CanvasView,
): S => ({
  ...withViewIn(search, { ...view, center: undefined }),
  ...withTutorial(view.center ?? true),
})

/** A System hexframe ships on home's canvas, its view, and what the tutorial lets through. */
interface OnCanvas {
  shipped: ShippedRoot
  view: CanvasView
  /**
   * Another System than the user's, reached by a journey, which the corner's mark leads back from:
   * the tutorial; Help opens over the user's System as a widget's page.
   */
  away: boolean
  /** The tutorial's rules, which the canvas and the chat follow; none for Help, which cuts nothing. */
  rules?: TutorialRules
}

/**
 * The System hexframe ships that has home's canvas, if one does, and its view: Help while its widget
 * is open, on the URL's view, else the tutorial while its param names it, centered by it, by its own
 * rules, what it has not introduced yet left out of the view and of what it lets through, the agent
 * having told `told` of its center's words. None leaves the canvas to the Account's System.
 */
export function shippedOnCanvas(
  search: CanvasView & HelpSearch & TutorialSearch,
  told?: ToldPart,
): OnCanvas | undefined {
  if (search.help !== undefined) return { shipped: 'help', view: viewIn(search), away: false }
  if (search.tutorial !== undefined) {
    const rules = tutorialRules(tutorialViewOf(search), told)
    return { shipped: 'tutorial', view: rules.view, away: true, rules }
  }
  return undefined
}

/** The Help page's search params, which an old link still carries: the view, then the open Body. */
const readHelpPage = readSearch(
  Schema.Struct({ ...CanvasView.fields, open: Schema.optionalKey(orDefault(TileId)) }),
)

/**
 * Where an old link to the Help page lands on home: Help on the canvas in the same view, the widget
 * open on the Body that was, or on Help's Root.
 */
export function fromHelpPage(search: Record<string, unknown>): CanvasView & HelpSearch {
  const { open, ...view } = readHelpPage(search)
  return { ...viewIn(view), help: open ?? true }
}
