// A hex of the canvas as the tile draws it (`tile/Tile.tsx`): what it is, which its light says
// before its words do, its words, what only its kind takes, and where it stands; and what its hover
// card says that the tile cuts short. Pure.
import type { ComponentProps } from 'react'

import { m } from '#/paraglide/messages'

import type { HoverCard } from '../../layouts/HoverCard'
import { directions, type Direction } from '../geometry/geometry'
import type { CanvasHex } from '../geometry/shape'
import type { StandingLook, TileLook, TilePlace, TileWords } from '../tile/Tile'
import type { TileNode } from './tiles'

type Of<Kind extends CanvasHex['kind']> = Extract<CanvasHex, { kind: Kind }>

/** A Tile of the System as the tile draws it: never one standing in a free slot before it is there. */
type SystemLook = Exclude<TileLook, StandingLook>

/** A list names this many of its ring at most, the rest counted after them. */
const listed = 4

/**
 * A Tile's hex as the tile draws it. What it is comes first from the Tile, a broken Reference, a
 * Reference, the user's Root, then from its place: a member of a Context ring, a Leaf, and a Branch
 * otherwise, the center and a Branch opened in place included. While a tile moves, no Branch shows
 * its frame at its foot, where its swap sits.
 */
export function lookOf(hex: Of<'tile'>, { moving = false } = {}): SystemLook {
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
): SystemLook | undefined {
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

/** What a Tile's hover card says beyond its title and place: its preview in full, and its notes. */
export type CardWords = Pick<ComponentProps<typeof HoverCard>, 'description' | 'notes'>

/**
 * What a Tile's hover card says, as its look has it: its preview in full, where the tile cuts it;
 * and a note in the colour of what it says: the Branch a Leaf is numbered as, where a Reference's
 * Tile stands, a Reference whose Tile is gone, the agent drafting.
 */
export function cardOf(look: TileLook): CardWords {
  const { preview } = look.words
  return {
    ...(preview !== undefined && preview !== '' && { description: preview }),
    ...notesOf(look),
  }
}

function notesOf(look: TileLook): Pick<CardWords, 'notes'> {
  switch (look.kind) {
    case 'leaf':
      return look.clash === undefined
        ? {}
        : { notes: [{ text: m.tile_clash({ branch: look.clash }), tone: 'warning' }] }
    case 'reference':
      return { notes: [{ text: m.tile_reference_from({ place: look.from }), tone: 'context' }] }
    case 'broken':
      return { notes: [{ text: m.tile_broken_note() }] }
    case 'draft':
      return { notes: [{ text: m.tile_drafting(), tone: 'agent' }] }
    default:
      return {}
  }
}
