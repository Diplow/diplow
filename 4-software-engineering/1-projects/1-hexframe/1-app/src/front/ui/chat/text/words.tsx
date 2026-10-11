// The chat's text in pieces: plain words, a tile named, and who acted, named. Every piece of the chat
// takes its text this way, so a tile reads the same in a Message, an event, a Proposal's change and a
// receipt, and a sentence keeps its order in each language.
import { Mention, type MentionProps } from './Mention'

/** One piece of a text: words, a tile named, or who acted, by name, in the first ink. */
export type Word = string | { readonly tile: MentionProps } | { readonly name: string }

/** A text, its pieces in order. */
export type Words = readonly Word[]

/** A text drawn in the voice that says it: in the user's words, a tile's hex is amber. */
export function Said({ words, voice }: { words: Words; voice?: 'human' | 'agent' }) {
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
