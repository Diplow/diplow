// Help's topics as the help widget goes through them: the way around, a topic's place among its six,
// where it leads, and what `/help` and a few words find, a title first, each with the sentence it shows
// in, cut around it (Help's Bodies are Markdown, read here as plain sentences). HEX-103 moves them
// beside Help's reads.
import { cutAround, type Cut } from '../../composer/commands'
import { places, type Place } from '../Places'

/** A topic of Help, as the widget reads it. */
export interface HelpTopic {
  readonly id: string
  readonly title: string
  readonly preview: string
  readonly body: string
}

/** A topic found, and where what was typed shows in it. */
export interface Found {
  readonly id: string
  readonly title: string
  /** The sentence it shows in, cut around it; the preview whole when it shows in the title alone. */
  readonly excerpt: Cut
}

/** Markdown's marks dropped, so a sentence reads as it is read. */
const plain = (markdown: string) =>
  markdown
    .replace(/^\s*(#+|\d+\.|[-*])\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

/** A text's sentences, a line break ending one too. */
const sentencesOf = (text: string) =>
  plain(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')

/** Where `typed` shows first in a topic: its preview's or its Body's first sentence holding it. */
function excerptOf(topic: HelpTopic, typed: string): Cut | undefined {
  for (const sentence of [...sentencesOf(topic.preview), ...sentencesOf(topic.body)]) {
    const cut = cutAround(sentence, typed)
    if (cut !== undefined) return cut
  }
  return undefined
}

/**
 * The topics `typed` shows in, case and accents aside: those whose title holds it first, then the
 * others, each in Help's order. None for nothing typed.
 */
export function topicsFor(topics: readonly HelpTopic[], typed: string): Found[] {
  const text = typed.trim()
  if (text === '') return []
  const titled: Found[] = []
  const told: Found[] = []
  for (const topic of topics) {
    const excerpt = excerptOf(topic, text)
    if (cutAround(topic.title, text) !== undefined) {
      titled.push({
        id: topic.id,
        title: topic.title,
        excerpt: excerpt ?? { before: plain(topic.preview), match: '', after: '' },
      })
    } else if (excerpt !== undefined) told.push({ id: topic.id, title: topic.title, excerpt })
  }
  return [...titled, ...told]
}

/** A topic of Help and the six below it, as the route hands Help over. */
export interface HelpNode extends HelpTopic {
  readonly children: Partial<Readonly<Record<Place, HelpNode>>>
}

/** The topics a path of places leads through from Help's Root, the Root first; it stops at a gap. */
export function follow(help: HelpNode, path: readonly Place[]): HelpNode[] {
  const trail = [help]
  for (const place of path) {
    const next = trail.at(-1)?.children[place]
    if (next === undefined) break
    trail.push(next)
  }
  return trail
}

/** Every topic of Help, the Root first, then each topic's six in their order. */
export function topicsOf(node: HelpNode): HelpNode[] {
  return [
    node,
    ...places.flatMap((place) => {
      const child = node.children[place]
      return child === undefined ? [] : topicsOf(child)
    }),
  ]
}

/** The places that lead from the Root to a topic, by its id; none when Help holds no such topic. */
export function placesTo(node: HelpNode, id: string): Place[] | undefined {
  if (node.id === id) return []
  for (const place of places) {
    const child = node.children[place]
    const below = child === undefined ? undefined : placesTo(child, id)
    if (below !== undefined) return [place, ...below]
  }
  return undefined
}

/** The place `steps` further clockwise round a frame: after 6 west comes 1 north-west. */
export const around = (place: Place, steps: number): Place =>
  places[(places.indexOf(place) + steps) % places.length] ?? place

/**
 * Where a topic leads, as the specimen reads on: the topics below it, or, with none, the next two
 * round its own frame. A real page reads on along what the topic names, Help's or the agent's links.
 */
export function readOnOf(help: HelpNode, path: readonly Place[]): HelpNode[] {
  const trail = follow(help, path)
  const topic = trail.at(-1) ?? help
  const below = places.flatMap((place) => topic.children[place] ?? [])
  const parent = trail.at(-2)
  const here = path.at(-1)
  if (below.length > 0 || parent === undefined || here === undefined) return below
  return [1, 2].flatMap((steps) => parent.children[around(here, steps)] ?? [])
}
