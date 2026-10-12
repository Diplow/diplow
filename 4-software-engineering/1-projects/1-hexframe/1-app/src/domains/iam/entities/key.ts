// A Key's name, IAM's rule: trimmed, then counted as a reader counts it, so the key widget's count and
// IAM's refusal agree. Pure, part of IAM's door: the front reads the bounds here.

/** The fewest and the most characters a Key's name holds, so the user can tell their Keys apart. */
export const keyNameBounds = { min: 1, max: 32 } as const

const graphemes = new Intl.Segmenter()

/** Characters as a reader counts them: an emoji of several code points is one. */
const length = (text: string) => Array.from(graphemes.segment(text)).length

/**
 * The name a Key is given, trimmed, or `undefined` when it holds fewer or more characters than
 * `keyNameBounds`, counted as a reader counts them.
 */
export function keyNameOf(name: string): string | undefined {
  const trimmed = name.trim()
  const characters = length(trimmed)
  return characters >= keyNameBounds.min && characters <= keyNameBounds.max ? trimmed : undefined
}
