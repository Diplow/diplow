// What home carries in its URL of Help: whether the help widget is open, and on which topic, `true`
// for Help's Root, which a link cannot name before Help is read. While it is open signed in, Help is
// on the canvas, its view the canvas's, in the same fields as the System's. An old link to the Help
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

/** The topic the help widget is open on: one of Help's Tiles by its id, or `true`, Help's Root. */
const HelpTopic = Schema.Union([Schema.Literal(true), TileId])

const HelpSearch = Schema.Struct({
  /** The help widget's topic; closed when absent. */
  help: Schema.optionalKey(orDefault(HelpTopic)),
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
