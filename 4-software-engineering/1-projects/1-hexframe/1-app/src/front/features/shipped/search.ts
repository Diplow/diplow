// What home carries in its URL of the Systems hexframe ships, each in a param of its own, which says
// the System is open on one of its Tiles, by its id, or on `true`, its Root, which a link cannot name
// before it is read: `help`, the help widget open on a topic, Help on the canvas while it is, signed
// in; `tutorial`, the tutorial on the canvas. While one is on the canvas, its view is the canvas's, in
// the same fields as the System's, and its param follows the Tile centered. An old link to the Help
// page, its view and `open`, the Tile whose Body was open, lands on home as these. Pure.
import { Schema } from 'effect'

import {
  CanvasView,
  orDefault,
  readSearch,
  TileId,
  viewIn,
  withViewIn,
} from '#/front/ui/canvas/view/view'

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
  /** The Tile the tutorial is on, on the canvas; the canvas is the System's when absent. */
  tutorial: ShippedAt,
})

export type TutorialSearch = typeof TutorialSearch.Type

/** Reads the URL's search param, which falls back on the tutorial away from the canvas. */
export const readTutorialSearch = readSearch(TutorialSearch)

/** The search param with the tutorial on the canvas, on this Tile or its Root, or gone from it. */
export const withTutorial = (at: string | true | undefined): TutorialSearch => ({ tutorial: at })

/**
 * The tutorial's view on the canvas: the URL's, the canvas's while the tutorial has it, centered on the
 * Tile the param names when the URL names no center, so a link to one of its Tiles opens there.
 */
export function tutorialViewOf(search: CanvasView & TutorialSearch): CanvasView {
  const view = viewIn(search)
  const at = search.tutorial
  return view.center === undefined && typeof at === 'string' ? { ...view, center: at } : view
}

/**
 * A page's search params with the tutorial's canvas on `view`, the rest kept, the param following
 * the Tile centered, as the help widget's page follows Help's canvas.
 */
export const tutorialOn = <S extends CanvasView & TutorialSearch>(
  search: S,
  view: CanvasView,
): S => ({
  ...withViewIn(search, view),
  ...withTutorial(view.center ?? true),
})

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
