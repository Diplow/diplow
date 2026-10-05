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
  /** Drawn in place of the Tile of this id, which stands elsewhere: a search for the id skips it. */
  reference?: true
}

/**
 * Which ring a Frame shows around its Tile. Children is the Branches and the Leaves together, offered
 * when they are six or fewer in all, in place of a Branches and a Leaves ring.
 */
export type FrameKind = 'children' | 'branches' | 'leaves' | 'context'

/** The Frame kinds of the ring around the center's hex. */
export type OuterKind = Exclude<FrameKind, 'context'>

/** The Frame kinds of the ring inside the center's hex. */
export type InnerKind = Extract<FrameKind, 'leaves' | 'context'>

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
 * Tiles included: the ancestors a breadcrumb shows. A Reference drawn under the id is not the Tile,
 * which stands elsewhere. Empty when no Tile has the id.
 */
export function pathTo(system: TileNode, id: string): TileNode[] {
  if (system.id === id && system.reference !== true) return [system]
  const below = directions.flatMap((direction) => [
    system.branches?.[direction],
    system.leaves?.[direction],
    system.context?.[direction],
  ])
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
