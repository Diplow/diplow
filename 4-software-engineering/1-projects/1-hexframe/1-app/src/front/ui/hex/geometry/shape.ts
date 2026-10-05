// The one module of the app that calls the shape's layout (2-claude-mod/hooks/shape/layout.ts), so
// the canvas lays a System out as claude-mod and the Obsidian plugin lay a vault out. It turns the
// System and the view into the shape's Frames, a Tile's id standing in for a folder's path, hands
// them to `layoutView`, and answers in the canvas's own words, scaled into its coordinates: the
// shape's Tile, Frame and Placement go no further than this file. Pure.
import {
  layoutView,
  viewHeight,
  viewWidth,
  type CollapsedView,
  type FrameView,
  type Placement,
} from '../../../../../../2-claude-mod/hooks/shape/layout'
import type {
  Clash,
  Frame,
  Member,
  MemberKind,
  Rings,
  SeatedChildren,
  SeatedRing,
  Tile,
} from '../../../../../../2-claude-mod/hooks/shape/node'
import type { ShownView } from '../view/view'
import { kindsOf, type FrameKind, type TileNode } from '../view/tiles'

import { directions, insetHex, neighbor, opposite, type Direction, type Hex } from './geometry'

/** A Direction of a ring that holds no Tile yet: the Tile at its heart, the ring's kind, the Direction. */
export interface EmptySlotTarget {
  parent: TileNode
  ring: FrameKind
  direction: Direction
}

/**
 * What a hex holding a Tile stands for: the center, a member of a ring by kind, or `hub`, a Branch of
 * the ring around the center drawn at the heart of the Frame it opens into.
 */
type TileRole = 'center' | 'hub' | MemberKind

interface Drawn {
  /** Unique on the canvas and stable across views, for React: a Tile keeps it when it opens. */
  key: string
  hex: Hex
  /** 0 the center, 1 its rings' members, 2 the members of a Branch it opens. */
  generation: number
}

/**
 * A hex of the canvas: a Tile; the `ground` of a hex opened into a ring, drawn under that ring; a
 * Direction with no Tile; or a Tile whose ring overflows, shown as the `list` of its names.
 */
export type CanvasHex =
  | (Drawn & {
      kind: 'tile'
      tile: TileNode
      role: TileRole
      /** A member's Direction in its ring; the center has none. */
      direction?: Direction
      /** The Branch a Leaf of a Children ring is numbered as, whose Direction it found taken. */
      clash?: TileNode
    })
  | (Drawn & { kind: 'ground'; ring: FrameKind })
  | (Drawn & { kind: 'empty'; slot: EmptySlotTarget })
  | (Drawn & { kind: 'list'; tile: TileNode; ring: FrameKind; names: string[] })

/** The canvas's units per unit of the shape's layout, where a ring's hex has a radius of 1. */
const scale = 100

/** The canvas's size, in its own coordinates. */
export const canvasSize = { width: viewWidth * scale, height: viewHeight * scale }

/** The gap a hex leaves to its neighbors, as a share of its radius: the layout's hexes touch. */
const gap = 0.05

/** The Tiles the shape's Frames name, by the path each stands under, and the clashes found. */
interface Named {
  tiles: Map<string, TileNode>
  clashes: Map<string, TileNode>
}

/**
 * The hexes of the shown view, in the order to paint them: the center and its rings, every hex the
 * view opens followed by what it holds.
 */
export function layoutCanvas(shown: ShownView): CanvasHex[] {
  const named: Named = { tiles: new Map(), clashes: new Map() }
  const placements = layoutView(viewOf(shown, named))
  return placements.flatMap((placement) => hexOf(placement, placements, shown, named))
}

/** The shape's view of `shown`: a Frame of the center, and one of each Branch it opens. */
function viewOf(shown: ShownView, named: Named): FrameView | CollapsedView {
  const frame = frameOf(shown.center, named)
  if (shown.frame === undefined) return { frame }
  const expanded: Partial<Record<Direction, FrameView>> = {}
  for (const direction of directions) {
    const kind = shown.expanded[direction]
    const branch = shown.center.branches?.[direction]
    if (kind !== undefined && branch !== undefined) {
      expanded[direction] = { frame: frameOf(branch, named), frameKind: kind }
    }
  }
  return { frame, frameKind: shown.frame, ...(shown.inner && { inner: shown.inner }), expanded }
}

/**
 * A Tile as the shape's Frame, its rings those the Tile offers (`kindsOf`): Children, or Branches and
 * Leaves past six, then Context. A Leaf offers none.
 */
function frameOf(tile: TileNode, named: Named): Frame {
  const own = shapeTile(tile, tile.id, named)
  const kinds = kindsOf(tile)
  if (kinds.length === 0) return { tile: own, rings: {} }
  // A Context Tile may be a Reference to a Tile drawn elsewhere, so it stands under its slot.
  const context = ringOf('context', tile.context, named, (d) => `${tile.id}:context:${String(d)}`)
  const rings: Rings<Member> = kinds.includes('children')
    ? { children: childrenOf(tile, named), context }
    : {
        branches: ringOf('branch', tile.branches, named),
        leaves: ringOf('leaf', tile.leaves, named),
        context,
      }
  return { tile: own, rings }
}

/**
 * The shape's Tile for one of the System's, standing under `path`, which it is found by again: a
 * Branch's or a Leaf's id, unique in a System, or a Context Tile's slot.
 */
function shapeTile(tile: TileNode, path: string, named: Named): Tile {
  named.tiles.set(path, tile)
  return { path, title: tile.title, preview: tile.preview }
}

/** A ring whose members sit in their own Direction, as a System keeps them. */
function ringOf(
  kind: MemberKind,
  held: Partial<Record<Direction, TileNode>> | undefined,
  named: Named,
  pathOf: (direction: Direction, tile: TileNode) => string = (_, tile) => tile.id,
): SeatedRing<Member> {
  const members: SeatedRing<Member>['members'] = {}
  for (const direction of directions) {
    const tile = held?.[direction]
    if (tile !== undefined) {
      members[direction] = { kind, tile: shapeTile(tile, pathOf(direction, tile), named) }
    }
  }
  return { overflowing: false, members }
}

/**
 * The Children ring as the shape lays it (`shape/CLAUDE.md`, "The Children ring"): the Branches where
 * they sit, each Leaf in its own Direction when that is free, then the Leaves left over in the free
 * Directions in order. A Leaf whose Direction a Branch holds is a clash.
 */
function childrenOf(tile: TileNode, named: Named): SeatedChildren<Member> {
  const { members } = ringOf('branch', tile.branches, named)
  const clashes: Clash[] = []
  const leftOver: TileNode[] = []
  for (const direction of directions) {
    const leaf = tile.leaves?.[direction]
    const branch = tile.branches?.[direction]
    if (leaf === undefined) continue
    if (branch === undefined) {
      members[direction] = { kind: 'leaf', tile: shapeTile(leaf, leaf.id, named) }
      continue
    }
    clashes.push({ direction, leaf: leaf.id, branch: branch.id })
    named.clashes.set(leaf.id, branch)
    leftOver.push(leaf)
  }
  for (const leaf of leftOver) {
    const free = directions.find((direction) => members[direction] === undefined)
    if (free !== undefined) members[free] = { kind: 'leaf', tile: shapeTile(leaf, leaf.id, named) }
  }
  return { overflowing: false, members, clashes }
}

/** The canvas's hex for one of the shape's placements, scaled, with what it stands for. */
function hexOf(
  placement: Placement,
  placements: readonly Placement[],
  shown: ShownView,
  named: Named,
): CanvasHex[] {
  const drawn = { hex: scaled(placement), generation: placement.generation }
  if (placement.kind === 'empty') {
    const hub = hubOf(placement, placements)
    const parent = hub && named.tiles.get(hub.tile.path)
    if (hub === undefined || parent === undefined) return []
    const ring = ringAround(hub, shown)
    const key = `empty:${hub.tile.path}:${ring}:${String(placement.direction)}`
    return [
      { ...drawn, kind: 'empty', key, slot: { parent, ring, direction: placement.direction } },
    ]
  }
  const { path } = placement.tile
  const tile = named.tiles.get(path)
  if (tile === undefined) return []
  if (placement.opened === true) {
    return [{ ...drawn, kind: 'ground', key: `ground:${path}`, ring: openedInto(placement, shown) }]
  }
  if (placement.list !== undefined) {
    const names = placement.list.ring.candidates.map(
      ({ name }) => named.tiles.get(name)?.title ?? name,
    )
    return [
      { ...drawn, kind: 'list', key: `list:${path}`, tile, ring: placement.list.frameKind, names },
    ]
  }
  const key = `tile:${path}`
  if (placement.kind === 'center') return [{ ...drawn, kind: 'tile', key, tile, role: 'center' }]
  const { direction, memberKind } = placement
  const role = isOpenBranch(placement, shown) ? 'hub' : memberKind
  const clash = memberKind === 'leaf' ? named.clashes.get(tile.id) : undefined
  return [{ ...drawn, kind: 'tile', key, tile, role, direction, ...(clash && { clash }) }]
}

type TileHex = Exclude<Placement, { kind: 'empty' }>

/** A Branch of the ring around the center, which the view opens: generation 1, a Direction open. */
function isOpenBranch(placement: TileHex, shown: ShownView): boolean {
  return (
    placement.kind === 'member' &&
    placement.memberKind === 'branch' &&
    placement.generation === 1 &&
    shown.expanded[placement.direction] !== undefined
  )
}

/** The kind of ring an opened hex holds: the center's inner ring, or the kind its Branch opens into. */
function openedInto(placement: TileHex, shown: ShownView): FrameKind {
  if (placement.kind === 'center') return shown.inner ?? 'context'
  return shown.expanded[placement.direction] ?? 'children'
}

/**
 * The kind of ring a hex at the heart of one shows: the center's inner ring when it is the center
 * drawn inside its own hex, its outer ring otherwise; a Branch's, the kind it opens into.
 */
function ringAround(hub: TileHex, shown: ShownView): FrameKind {
  if (hub.kind === 'member') return shown.expanded[hub.direction] ?? 'children'
  const inside = shown.inner !== undefined && hub.opened !== true
  return (inside ? shown.inner : shown.frame) ?? 'children'
}

/**
 * The hex an empty one sits around: one generation up, the same size, a neighbor away, as the shape
 * lays a ring around its Tile. The shape's placement of an empty hex names its Direction only.
 */
function hubOf(
  empty: Extract<Placement, { kind: 'empty' }>,
  placements: readonly Placement[],
): TileHex | undefined {
  const at = neighbor(empty, opposite(empty.direction)).center
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
  return placements.find(
    (placement): placement is TileHex =>
      placement.kind !== 'empty' &&
      placement.generation === empty.generation - 1 &&
      near(placement.radius, empty.radius) &&
      near(placement.center.x, at.x) &&
      near(placement.center.y, at.y),
  )
}

/** A placement in the canvas's coordinates, a gap short of its neighbors. */
function scaled({ center, radius }: Placement): Hex {
  const hex = { center: { x: center.x * scale, y: center.y * scale }, radius: radius * scale }
  return insetHex(hex, hex.radius * gap)
}
