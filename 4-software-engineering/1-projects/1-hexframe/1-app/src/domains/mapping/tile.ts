// A Tile, the unit of a System, and where one stands under its parent. Pure: what a Tile's content
// must be is decided here, before anything is written.
import { Effect } from 'effect'

import { PreviewTooLong, TitleMissing } from './errors'

/** Where a Child stands in its parent's Frame: 1 NW, 2 NE, 3 E, 4 SE, 5 SW, 6 W. */
export const directions = [1, 2, 3, 4, 5, 6] as const
export type Direction = (typeof directions)[number]

/** A Context slot, -1 to -6, in the same Directions as the Children. */
export const contextDirections = [-1, -2, -3, -4, -5, -6] as const
export type ContextDirection = (typeof contextDirections)[number]

/** Where a Tile stands under its parent: a Child's Direction, or a Context slot. */
export type Slot = Direction | ContextDirection

/** What a reader finds in a Tile. */
export interface Content {
  readonly title: string
  /** At most 350 characters: what a reader needs to decide whether to open the Tile. */
  readonly preview: string
  /** Markdown. */
  readonly body: string
}

export interface Tile extends Content {
  readonly id: string
}

export const isDirection = (value: number): value is Direction =>
  Number.isInteger(value) && value >= 1 && value <= 6

export const isContextDirection = (value: number): value is ContextDirection => isDirection(-value)

const previewLimit = 350

const graphemes = new Intl.Segmenter()

/** Characters as a reader counts them: an emoji of several code points is one. */
const length = (text: string) => Array.from(graphemes.segment(text)).length

/**
 * The content as Mapping keeps it, its Title trimmed, or the error on the field at fault. Only the
 * fields given are checked, so an edit of the Body alone never trips on a Title nobody wrote yet.
 */
export function checked<C extends Partial<Content>>(
  content: C,
): Effect.Effect<C, TitleMissing | PreviewTooLong> {
  const title = content.title?.trim()
  if (title === '') return Effect.fail(new TitleMissing({ fields: ['title'] }))
  if (content.preview !== undefined && length(content.preview) > previewLimit) {
    return Effect.fail(new PreviewTooLong({ fields: ['preview'] }))
  }
  return Effect.succeed(title === undefined ? content : { ...content, title })
}
