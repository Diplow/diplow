// The chat's text in pieces: plain words, a tile named, who acted, named, and a command named, which a
// click runs (HEX-118). Every piece of the chat takes its text this way, so a tile reads the same in a
// Message, an event, a Proposal's change and a receipt. A sentence keeps its order in each language:
// its message is read with a mark in each tile's place, then cut at the marks and woven with the
// tiles (`weave`).
import { Mention, type MentionProps, type Voice } from './Mention'

/** A command named in the chat: as it is typed, its `/` first, in the reader's language. */
interface CommandNamed {
  readonly name: string
  /** Runs it, as typing it would. */
  readonly onRun: () => void
}

/**
 * One piece of a text: words, a tile named, who acted, by name, in the first ink, or a command named,
 * which a click runs.
 */
export type Word =
  | string
  | { readonly tile: MentionProps }
  | { readonly name: string }
  | { readonly command: CommandNamed }

/** A text, its pieces in order. */
export type Words = readonly Word[]

/** A text drawn in the voice that says it: in the user's words, a tile's hex is amber. */
export function Said({ words, voice }: { words: Words; voice?: Voice }) {
  return words.map((word, index) => {
    // The pieces of one text, never reordered: their place is their key.
    if (typeof word === 'string') return word
    if ('tile' in word) return <Mention key={index} {...word.tile} voice={voice} />
    if ('command' in word) return <Command key={index} {...word.command} />
    return (
      <span key={index} className="text-foreground">
        {word.name}
      </span>
    )
  })
}

/**
 * A command named, in the user's amber, as the composer marks it typed, since it is theirs to run, a
 * faint underline under it: a click runs it. Inline, it cannot grow to a finger's 44px; its hit area
 * does, beyond its line.
 */
function Command({ name, onRun }: CommandNamed) {
  return (
    <button
      type="button"
      className="relative cursor-pointer text-human underline decoration-human/35 decoration-1 underline-offset-3 outline-offset-2 transition-[text-decoration-color] hover:decoration-current focus-visible:outline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3"
      onClick={onRun}
    >
      {name}
    </button>
  )
}

/** A piece as plain words: a tile by its title, a command as it is typed. */
function plainWord(word: Word): string {
  if (typeof word === 'string') return word
  if ('tile' in word) return word.tile.title
  if ('command' in word) return word.command.name
  return word.name
}

/** A text as plain words, each tile by its title: what a copy takes. */
export const plainOf = (words: Words): string => words.map(plainWord).join('')

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
