// The names IAM keeps, a Key's and a Group's, and their one rule: trimmed, then counted as a reader
// counts them, between the bounds each holds, so a widget's count and IAM's refusal agree. And when
// two names of Groups are one. Pure, part of IAM's door: the front reads the bounds here.

/** The fewest and the most characters a Key's name holds, so the user can tell their Keys apart. */
export const keyNameBounds = { min: 1, max: 32 } as const

/** The fewest and the most characters a Group's name holds, so its members tell their Groups apart. */
export const groupNameBounds = { min: 1, max: 40 } as const

const graphemes = new Intl.Segmenter()

/** Characters as a reader counts them: an emoji of several code points is one. */
const charactersIn = (text: string) => Array.from(graphemes.segment(text)).length

/**
 * A name trimmed, or `undefined` when it holds fewer or more characters than its bounds, counted as a
 * reader counts them.
 */
function within(name: string, bounds: { readonly min: number; readonly max: number }) {
  const trimmed = name.trim()
  const characters = charactersIn(trimmed)
  return characters >= bounds.min && characters <= bounds.max ? trimmed : undefined
}

/** The name a Key is given, trimmed, or `undefined` outside `keyNameBounds`. */
export const keyNameOf = (name: string): string | undefined => within(name, keyNameBounds)

/** The name a Group is given, trimmed, or `undefined` outside `groupNameBounds`. */
export const groupNameOf = (name: string): string | undefined => within(name, groupNameBounds)

/**
 * Whether two names of Groups are one, as an Organization holds them apart: whatever their case, so
 * `Design` and `design` never stand side by side, folded the same way whatever the locale of the
 * machine comparing them, the server's and the browser's alike.
 */
export const sameGroupName = (one: string, other: string) =>
  one.toLowerCase() === other.toLowerCase()
