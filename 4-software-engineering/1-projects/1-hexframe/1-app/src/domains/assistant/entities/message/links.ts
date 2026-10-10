// A Message's links to Tiles: the user `@`s a Tile, and the Message keeps it by its id alone, inside
// its text, since a Tile's Title and folder change whenever it is renamed or moved. A link opening the
// Message moves the Turn answering it into that Tile; any other points the agent at it. Assistant knows
// no Tile: an id is kept as it came, and whoever reads the Message joins in the Title the System holds
// then, none for a Tile deleted since. Pure.

/** A link to a Tile, as a Message's text holds it: `@[<id>]`. */
export const linkTo = (tile: string) => `@[${tile}]`

/** A link in a text, its id the letters, digits, `-` and `_` an id is made of, 100 at most. */
const link = /@\[([\w-]{1,100})\]/g

/** The most links a Message holds: past them, a link's text is read as it is written. */
export const mostLinks = 50

/** A piece of a Message's text: words as written, or a link to a Tile, by its id. */
export type MessagePart =
  | { readonly _tag: 'Text'; readonly text: string }
  | { readonly _tag: 'Link'; readonly tile: string }

/** A Message's text in pieces, in order: its words, and its first `mostLinks` links. */
export function partsOf(text: string): ReadonlyArray<MessagePart> {
  const parts: MessagePart[] = []
  const words = (until: number, from: number) => {
    if (until > from) parts.push({ _tag: 'Text', text: text.slice(from, until) })
  }
  let from = 0
  let links = 0
  for (const found of text.matchAll(link)) {
    if (links === mostLinks) break
    const [whole, tile = ''] = found
    words(found.index, from)
    parts.push({ _tag: 'Link', tile })
    from = found.index + whole.length
    links += 1
  }
  words(text.length, from)
  return parts
}

/** The Tiles a Message links, by id, each once, in the order it first links them. */
export const linksOf = (text: string): ReadonlyArray<string> => [
  ...new Set(partsOf(text).flatMap((part) => (part._tag === 'Link' ? [part.tile] : []))),
]

/** The Tile a Message opens with a link to, by its id: where the Turn answering it starts. */
export function leadingLink(text: string): string | undefined {
  const [first] = partsOf(text)
  return first?._tag === 'Link' ? first.tile : undefined
}
