// A hex of the canvas as the tile draws it (`tile/Tile.tsx`): what it is, which its light says
// before its words do, its words, what only its kind takes, and where it stands. Pure.
import { m } from '#/paraglide/messages'

import { directions, type Direction } from '../geometry/geometry'
import type { CanvasHex } from '../geometry/shape'
import type { TileLook, TilePlace, TileWords } from '../tile/Tile'
import type { TileNode } from './tiles'

type Of<Kind extends CanvasHex['kind']> = Extract<CanvasHex, { kind: Kind }>

/** A list names this many of its ring at most, the rest counted after them. */
const listed = 4

/**
 * A Tile's hex as the tile draws it. What it is comes first from the Tile, a broken Reference, a
 * Reference, the user's Root, then from its place: a member of a Context ring, a Leaf, and a Branch
 * otherwise, the center and a Branch opened in place included. While a tile moves, no Branch shows
 * its frame at its foot, where its swap sits.
 */
export function lookOf(hex: Of<'tile'>, { moving = false } = {}): TileLook {
  const { tile, role, clash } = hex
  const words = { title: tile.title, preview: tile.preview }
  const foot = moving ? {} : { foot: footOf(tile) }
  const own = ownLook(tile, words, foot)
  if (own !== undefined) return own
  if (role === 'context') return { kind: 'context', words }
  if (tile.leaf !== true) return { kind: 'branch', words, ...foot }
  return {
    kind: 'leaf',
    words,
    ...(tile.file === true && { file: true }),
    ...(clash && { clash: clash.title }),
  }
}

/**
 * What a Tile says it is, wherever it stands: a broken Reference, a Reference, the user's Root, named
 * or not; none for the others.
 */
function ownLook(
  tile: TileNode,
  words: TileWords,
  foot: { foot?: readonly Direction[] },
): TileLook | undefined {
  if (tile.broken === true) return { kind: 'broken', words }
  if (tile.reference !== undefined) return { kind: 'reference', words, from: tile.reference.from }
  switch (tile.root) {
    case 'named':
      return { kind: 'root', words, ...foot }
    case 'untitled':
      return { kind: 'untitled', words }
    case 'empty':
      return { kind: 'untitled', words: { title: tile.title, preview: m.tile_untitled_preview() } }
    case undefined:
      return undefined
  }
}

/** The Directions a Branch's children hold, Branches or Leaves, which its foot draws in small. */
const footOf = (tile: TileNode) =>
  directions.filter((direction) => tile.branches?.[direction] ?? tile.leaves?.[direction])

/**
 * A ring too full to place, as a list: how many it holds, and their names, the first few then how
 * many more.
 */
export function listOf(hex: Of<'list'>): Extract<TileLook, { kind: 'list' }> {
  const { names } = hex
  const shown =
    names.length <= listed
      ? names
      : [...names.slice(0, listed - 1), m.tile_list_more({ count: names.length - listed + 1 })]
  return {
    kind: 'list',
    words: { title: m.tile_list_title({ count: names.length }) },
    names: shown,
  }
}

/** Where a Tile's hex stands: the center, at the heart of the Branch it opened in place, or in a ring. */
export function placeOf(hex: Of<'tile'>): TilePlace {
  switch (hex.role) {
    case 'center':
      return 'center'
    case 'hub':
      return 'heart'
    default:
      return 'ring'
  }
}
