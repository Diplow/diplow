// The System as the canvas reads it: each Tile with its Branches, its Leaves and its Context by
// Direction, and the Frame kinds it offers, as the shape offers them for a folder. Pure.
import { directions, type Direction } from '../geometry/geometry'

export interface TileNode {
  id: string
  title: string
  preview: string
  branches?: Partial<Record<Direction, TileNode>>
  leaves?: Partial<Record<Direction, TileNode>>
  context?: Partial<Record<Direction, TileNode>>
  /** A Leaf: one file's worth, with nothing below it and no Context, so no ring to show. */
  leaf?: true
  /** A Leaf that isn't Markdown: its title is its file's name. */
  file?: true
  /**
   * Drawn in place of the Tile of this id, which stands elsewhere, `from` the title of the Tile it
   * stands under: a search for the id skips it.
   */
  reference?: { from: string }
  /** A Reference whose Tile was deleted. */
  broken?: true
  /**
   * The System's Root, the user: named, untitled, or untitled with nothing in it yet, an empty System
   * waiting for a name or a vault.
   */
  root?: 'named' | 'untitled' | 'empty'
  /** The pseudo the user is typing for their untitled Root, which its hex shows as they type. */
  naming?: string
  /**
   * A star's Tiles the reader may read under Tiles kept from them, each with what stands below it,
   * hung from the star across the gap (`across`): drawn in none of its rings, since where each
   * stands is not said, and reached by centering it, its ancestors a "…".
   */
  gaps?: readonly TileNode[]
  /** A Tile hung from its star across a gap, one of the star's `gaps`: a "…" stands above it. */
  across?: true
}

/** The Frame kinds of the ring around the center's hex. */
export const outerKinds = ['children', 'branches', 'leaves'] as const

/** The Frame kinds of the ring inside the center's hex. */
export const innerKinds = ['leaves', 'context'] as const

/**
 * Which ring a Frame shows around its Tile. Children is the Branches and the Leaves together, offered
 * when they are six or fewer in all, in place of a Branches and a Leaves ring.
 */
export const frameKinds = ['children', 'branches', 'leaves', 'context'] as const

export type FrameKind = (typeof frameKinds)[number]
export type OuterKind = (typeof outerKinds)[number]
export type InnerKind = (typeof innerKinds)[number]

/** How many Branches and Leaves a ring of Children holds at most. */
const childrenAtMost = 6

const count = (members: Partial<Record<Direction, TileNode>> | undefined) =>
  Object.keys(members ?? {}).length

/**
 * The Frame kinds a Tile offers, in the order the shape offers them: Children, or Branches and
 * Leaves past six of them in all, then Context. A Leaf offers none.
 */
export function kindsOf(tile: TileNode): FrameKind[] {
  if (tile.leaf === true) return []
  return count(tile.branches) + count(tile.leaves) > childrenAtMost
    ? ['branches', 'leaves', 'context']
    : ['children', 'context']
}

/** The ring a Tile shows around it unless asked otherwise: Children, or Branches past six. */
export function firstKindOf(tile: TileNode): OuterKind | undefined {
  const kinds = kindsOf(tile)
  if (kinds.includes('children')) return 'children'
  return kinds.includes('branches') ? 'branches' : undefined
}

/**
 * The Tiles from the System's root down to the one with this id, both included, Leaves and Context
 * Tiles included, and a Tile hung from the star across a gap, which comes right below the star: the
 * ancestors a breadcrumb shows. A Reference drawn under the id is not the Tile, which stands
 * elsewhere. Empty when no Tile has the id.
 */
export function pathTo(system: TileNode, id: string): TileNode[] {
  if (system.id === id && system.reference === undefined) return [system]
  const below = [
    ...directions.flatMap((direction) => [
      system.branches?.[direction],
      system.leaves?.[direction],
      system.context?.[direction],
    ]),
    ...(system.gaps ?? []),
  ]
  for (const tile of below) {
    const path = tile ? pathTo(tile, id) : []
    if (path.length > 0) return [system, ...path]
  }
  return []
}

/** The Tile with this id, anywhere in the System, Leaves and Context Tiles included. */
export function findTile(system: TileNode, id: string): TileNode | undefined {
  return pathTo(system, id).at(-1)
}
