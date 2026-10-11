// What `/help` and a few words find in Help: the topics they show in, a title first, each with the
// sentence they show in, cut around them. Help's Bodies are Markdown, read here as plain sentences.
import { cutAround, type Cut } from '../../composer/commands'

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

/** The most topics a search shows: a few to choose among, not an index. */
const most = 6

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
 * others, each in Help's order, six at most. None for nothing typed.
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
  return [...titled, ...told].slice(0, most)
}
