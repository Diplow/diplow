// Help as the help widget goes through it: each Tile and the six below it (`HelpNode`, ui's), read from
// Help as Mapping hands it over, what the widget shows of a topic, where it stands among its six,
// its parent's titles and where it reads on, and the topic a few words after `/help` find. Pure.
import type { SystemTile } from '#/domains/mapping/entities'
import { places, type Place } from '#/front/ui/chat/widgets/Places'
import {
  follow,
  placesTo,
  readOnOf,
  topicsFor,
  topicsOf,
  type HelpNode,
} from '#/front/ui/chat/widgets/help/topics'

/** A Tile of Help and its Branches, as the help widget reads them. */
export function helpNodeOf(tile: SystemTile): HelpNode {
  return {
    id: tile.id,
    title: tile.title,
    preview: tile.preview,
    body: tile.body,
    children: Object.fromEntries(
      Object.entries(tile.branches).map(([place, child]) => [place, helpNodeOf(child)]),
    ),
  }
}

/** A topic as the help widget reads it, and the topics its map and its links lead to, by their ids. */
export interface Reading {
  readonly topic: HelpNode
  /** Its parent's titles, from Help's Root. */
  readonly path: readonly string[]
  /** Its parent's six, by place, the topic's own lit; the Root's own six for the Root. */
  readonly frame: {
    readonly titles: Partial<Readonly<Record<Place, string>>>
    readonly ids: Partial<Readonly<Record<Place, string>>>
    readonly lit: Place | undefined
  }
  readonly readOn: ReadonlyArray<{ readonly id: string; readonly title: string }>
}

/** What the widget shows of a topic, by its id; Help's Root when Help holds no such topic. */
export function readingOf(help: HelpNode, id: string): Reading {
  const path = placesTo(help, id) ?? []
  const trail = follow(help, path)
  const topic = trail.at(-1) ?? help
  const parent = trail.at(-2)
  const frame = parent ?? topic
  const around = places.flatMap((place) => {
    const child = frame.children[place]
    return child === undefined ? [] : [{ place, child }]
  })
  return {
    topic,
    path: trail.slice(0, -1).map(({ title }) => title),
    frame: {
      titles: Object.fromEntries(around.map(({ place, child }) => [place, child.title])),
      ids: Object.fromEntries(around.map(({ place, child }) => [place, child.id])),
      lit: parent === undefined ? undefined : path.at(-1),
    },
    readOn: readOnOf(help, path).map(({ id: on, title }) => ({ id: on, title })),
  }
}

/**
 * The topic a few words find, by its id, as `/help` and those words open it: the first of Help's
 * topics they show in, a title first (`topicsFor`); none for no words, or words no topic holds.
 */
export function topicFound(help: HelpNode, words: string): string | undefined {
  return topicsFor(topicsOf(help), words)[0]?.id
}
