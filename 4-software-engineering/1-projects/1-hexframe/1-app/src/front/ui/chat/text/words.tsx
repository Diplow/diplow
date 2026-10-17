// The chat's text in pieces: plain words, a tile named, and who acted, named. Every piece of the chat
// takes its text this way, so a tile reads the same in a Message, an event, a Proposal's change and a
// receipt. A sentence keeps its order in each language: its message is read with a mark in each
// tile's place, then cut at the marks and woven with the tiles (`weave`).
import { Mention, type MentionProps, type Voice } from './Mention'

/** One piece of a text: words, a tile named, or who acted, by name, in the first ink. */
export type Word = string | { readonly tile: MentionProps } | { readonly name: string }

/** A text, its pieces in order. */
export type Words = readonly Word[]

/** A text drawn in the voice that says it: in the user's words, a tile's hex is amber. */
export function Said({ words, voice }: { words: Words; voice?: Voice }) {
  return words.map((word, index) => {
    // The pieces of one text, never reordered: their place is their key.
    if (typeof word === 'string') return word
    if ('tile' in word) return <Mention key={index} {...word.tile} voice={voice} />
    return (
      <span key={index} className="text-foreground">
        {word.name}
      </span>
    )
  })
}

/** A text as plain words, each tile by its title: what a copy takes. */
export const plainOf = (words: Words): string =>
  words
    .map((word) => (typeof word === 'string' ? word : 'tile' in word ? word.tile.title : word.name))
    .join('')

/**
 * A text cut at its line breaks, each line its own pieces, a tile never cut: the lines a reader sees
 * start where the text starts one, a blank line kept, a last line break left as a reader sees it, with
 * no line after it.
 */
export function linesOf(words: Words): Words[] {
  const lines: Words[] = []
  let line: Word[] = []
  for (const word of words) {
    if (typeof word !== 'string') {
      line.push(word)
      continue
    }
    const [first = '', ...rest] = word.split('\n')
    if (first !== '') line.push(first)
    for (const next of rest) {
      lines.push(line)
      line = next === '' ? [] : [next]
    }
  }
  if (line.length > 0 || lines.length === 0) lines.push(line)
  return lines
}

/** Where the marks a sentence is read with begin: Unicode's private use area, which no message holds. */
const firstMark = 0xe000
const marks = /([\uE000-\uF8FF])/

/**
 * A message about tiles as `Words`: `weave(m.x, { tile })` reads the message with a mark in place of
 * `{tile}`, then weaves the tile in where the mark landed, wherever the language put it.
 */
export function weave<Names extends string>(
  sentence: (inputs: Record<Names, string>) => string,
  pieces: Record<Names, Word>,
): Words {
  const names = Object.keys(pieces) as Names[]
  const inputs = Object.fromEntries(
    names.map((name, index) => [name, String.fromCharCode(firstMark + index)]),
  ) as Record<Names, string>
  return sentence(inputs)
    .split(marks)
    .filter((part) => part !== '')
    .map((part) => {
      if (!marks.test(part)) return part
      const name = names[part.charCodeAt(0) - firstMark]
      return name === undefined ? part : pieces[name]
    })
}
