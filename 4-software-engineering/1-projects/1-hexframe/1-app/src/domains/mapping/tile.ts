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

/**
 * A Leaf's slot: one of its parent's six Leaf Directions, which are their own beside the six Branch
 * Directions, so a Leaf and a Branch may share a Direction.
 */
interface LeafSlot {
  readonly leaf: Direction
}

/** Where a Tile stands under its parent: a Branch's Direction, a Leaf's, or a Context slot. */
export type Slot = Direction | LeafSlot | ContextDirection

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

/** A guard for one of these values, so the guards and the lists above never drift apart. */
const among =
  <T extends number>(values: ReadonlyArray<T>) =>
  (value: number): value is T =>
    (values as ReadonlyArray<number>).includes(value)

export const isDirection = among(directions)

export const isContextDirection = among(contextDirections)

/** How far past its Direction a row stores a Leaf: beyond the six Branch slots, 7 to 12. */
const leafOffset = directions.length

/** The direction a row stands in for this slot: a Leaf's stored past the six Branch slots. */
export const rowDirection = (slot: Slot): number =>
  typeof slot === 'number' ? slot : slot.leaf + leafOffset

/** The Direction of the Leaf a row's direction stands for; `undefined` for any other slot. */
export function leafOf(direction: number | null): Direction | undefined {
  if (direction === null) return undefined
  const leaf = direction - leafOffset
  return isDirection(leaf) ? leaf : undefined
}

/** The most characters a Preview holds, as a reader counts them. */
export const previewLimit = 350

const graphemes = new Intl.Segmenter()

/** Characters as a reader counts them: an emoji of several code points is one. */
const length = (text: string) => Array.from(graphemes.segment(text)).length

/** Whether a Preview holds in its 350 characters, counted as a reader counts them. */
export const fitsPreview = (preview: string) => length(preview) <= previewLimit

/**
 * The content as Mapping keeps it, its Title trimmed, or the error on the field at fault. Only the
 * fields given are checked, so an edit of the Body alone never trips on a Title nobody wrote yet.
 */
export function checked<C extends Partial<Content>>(
  content: C,
): Effect.Effect<C, TitleMissing | PreviewTooLong> {
  const title = content.title?.trim()
  if (title === '') return Effect.fail(new TitleMissing({ fields: ['title'] }))
  if (content.preview !== undefined && !fitsPreview(content.preview)) {
    return Effect.fail(new PreviewTooLong({ fields: ['preview'] }))
  }
  return Effect.succeed(title === undefined ? content : { ...content, title })
}
