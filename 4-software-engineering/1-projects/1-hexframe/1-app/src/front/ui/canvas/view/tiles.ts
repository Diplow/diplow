// The System as the canvas reads it: each Tile with its Branches, its Leaves and its Context by
// Direction, and the Frame kinds it offers, as the shape offers them for a folder. Pure.
import { directions, neighbor, type Direction, type Point } from '../geometry/geometry'

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

/** A star's light: a person's, amber, or an Organization's, rose. */
export type SunLight = 'human' | 'organization'

/**
 * A System's star, the sun its light comes from (`SunLight`); and, where the root drawn hangs below
 * that star rather than being it, the Directions from the star down to it (`rootAt`): the tutorial
 * stands in the Hexframe Organization's Direction 2, so `[2]`.
 */
export interface Sun {
  light: SunLight
  rootAt?: readonly Direction[]
}

/**
 * How much smaller each generation stands inside the one above it, for where a Tile stands from its
 * star: the first step from the star says the most of the way back to it, as on the canvas, where a
 * Tile's six stand around it and theirs around each of them, smaller.
 */
const generation = 1 / 3

/**
 * Which way the star lies from the centered Tile, a unit vector on the canvas (y grows downwards):
 * back along every step from the star down to it, the nearer the star the more it weighs. None at the
 * star itself, nor for a Tile the System doesn't hold.
 */
export function sunward(system: TileNode, center: string, rootAt: readonly Direction[] = []) {
  const path = pathTo(system, center)
  if (path.length === 0) return undefined
  const steps = [...rootAt, ...stepsAlong(path)]
  const at = steps.reduce<Point>(
    (sum, direction, depth) => {
      const { x, y } = neighbor({ center: { x: 0, y: 0 }, radius: 1 }, direction).center
      const weight = generation ** depth
      return { x: sum.x + x * weight, y: sum.y + y * weight }
    },
    { x: 0, y: 0 },
  )
  const length = Math.hypot(at.x, at.y)
  return length < 1e-9 ? undefined : { x: -at.x / length, y: -at.y / length }
}

/**
 * The Direction of each step down a path, a Branch's, a Leaf's or a Context Tile's; a Tile hung across
 * a gap, whose place is not said, takes none.
 */
function stepsAlong(path: readonly TileNode[]): Direction[] {
  return path.slice(1).flatMap((tile, index) => {
    const direction = directionIn(path[index], tile)
    return direction === undefined ? [] : [direction]
  })
}

/**
 * The Direction a Tile stands in under `above`, as a Branch, a Leaf or a Context Tile; none for one
 * hung across a gap, nor for a Tile `above` doesn't hold.
 */
export const directionIn = (above: TileNode | undefined, tile: TileNode) =>
  directions.find((one) =>
    [above?.branches?.[one], above?.leaves?.[one], above?.context?.[one]].some(
      (under) => under?.id === tile.id,
    ),
  )
