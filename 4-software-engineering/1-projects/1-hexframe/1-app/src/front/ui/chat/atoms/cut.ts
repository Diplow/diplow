// What was typed, found in a text as a reader finds it: case and accents aside. The composer's list
// marks it in each row and finds a command by it, and Help's search cuts a sentence around it. Pure.

/** A text compared as a reader would: lower case, accents aside, one character for one. */
export const folded = (text: string) =>
  Array.from(text, (character) => {
    const plain = character
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .charAt(0)
    // A mark already apart from its letter, in decomposed text, keeps its place.
    return plain === '' ? character : plain
  }).join('')

/** A text cut around what was typed. */
export interface Cut {
  readonly before: string
  readonly match: string
  readonly after: string
}

/** Where `typed` first shows in `text`; none when it does not, or nothing was typed. */
export function cutAround(text: string, typed: string): Cut | undefined {
  if (typed === '') return undefined
  const at = folded(text).indexOf(folded(typed))
  if (at === -1) return undefined
  const characters = Array.from(text)
  const end = at + Array.from(typed).length
  return {
    before: characters.slice(0, at).join(''),
    match: characters.slice(at, end).join(''),
    after: characters.slice(end).join(''),
  }
}
