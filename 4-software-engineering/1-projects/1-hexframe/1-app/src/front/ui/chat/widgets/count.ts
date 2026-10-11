// What a field with a limit shows of its length: nothing while it is far from the limit, then its
// count, quiet, ember near the end, destructive past it. Counted as a reader counts: an emoji is one.

const graphemes = new Intl.Segmenter()

/** Characters as a reader counts them: an emoji of several code points is one. */
export const lengthOf = (text: string) => Array.from(graphemes.segment(text)).length

/** How the count reads: `quiet`, `near` the end, or `over` it. */
export type CountTone = 'quiet' | 'near' | 'over'

/** The count a field shows, or `undefined` while it is far from its limit. */
export interface Count {
  readonly length: number
  readonly limit: number
  readonly tone: CountTone
}

/** It shows from four fifths of the limit, so a short text is never counted at. */
const showsFrom = 0.8
/** Ember for the last tenth or so: 330 of 350, 29 of 32. */
const nearFrom = 0.9

/** The count of `text` against `limit`, from four fifths of it on; `undefined` before. */
export function countOf(text: string, limit: number): Count | undefined {
  const length = lengthOf(text)
  if (length < limit * showsFrom) return undefined
  const tone = length > limit ? 'over' : length > limit * nearFrom ? 'near' : 'quiet'
  return { length, limit, tone }
}
