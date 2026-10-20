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
 * the ring around the center drawn at the heart of the Frame it opens into; or, around the drawing,
 * the Tile the center stands in (`above`) and a Tile of its ring beside the center (`beside`).
 */
type TileRole = 'center' | 'hub' | MemberKind | 'above' | 'beside'

interface Drawn {
  /** Unique on the canvas and stable across views, for React: a Tile keeps it when it opens. */
  key: string
  hex: Hex
  /**
   * 0 the center, 1 its rings' members, 2 the members of a Branch it opens; around them, -1 the Tile
   * the center stands in, 0 those beside it.
   */
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
      /**
       * The Tile whose ring it stands in: the center, or the Branch opened in place it stands in;
       * the center stands in none. A Reference's is where it stands, not where its Tile does.
       */
      parent?: TileNode
      /** The Branch a Leaf of a Children ring is numbered as, whose Direction it found taken. */
      clash?: TileNode
      /** The center folded, no ring around it: the canvas's one tile, filling it. */
      alone?: true
      /**
       * The center's heart, as one world draws it: where its tile stands in its whole hex, its ring
       * inside that hex once opened, its tile filling it a heart's share larger while folded; the
       * Tiles beside it stand around that whole hex.
       */
      heart?: Hex
    })
  | (Drawn & { kind: 'ground'; ring: FrameKind })
  | (Drawn & { kind: 'empty'; slot: EmptySlotTarget })
  | (Drawn & { kind: 'list'; tile: TileNode; ring: FrameKind; names: string[] })

type Of<Kind extends CanvasHex['kind']> = Extract<CanvasHex, { kind: Kind }>

/** The canvas's units per unit of the shape's layout, where a ring's hex has a radius of 1. */
const scale = 100

/** The canvas's size, in its own coordinates. */
export const canvasSize = { width: viewWidth * scale, height: viewHeight * scale }

/** The gap a hex leaves to its neighbors, as a share of its radius: the layout's hexes touch. */
const gap = 0.05

/**
 * A Tile's tile at the heart of its hex opened in place, as a share of that hex: the shape's Frame
 * inside a hex takes its radius less a margin, its Tile a third of that (`layout.ts`).
 */
export const heartShare = 0.92 / 3

/** The radius the center is drawn at once its ring shows around it, as is each hex of that ring. */
const openedRadius = insetHex({ center: { x: 0, y: 0 }, radius: scale }, scale * gap).radius

/**
 * The share of the canvas a folded center takes, alone: the shape fills the canvas with it, and the
 * app leaves the ground around it, space being the luxury.
 */
const aloneShare = 0.82

/**
 * What building the shape's Frames writes down, so the placements read back as the System's own:
 * each Tile by the path it stands under, and each clashing Leaf with the Branch it clashes with.
 */
interface Ledger {
  tiles: Map<string, TileNode>
  clashes: Map<string, TileNode>
}

/**
 * The hexes of the shown view, in the order to paint them: the center and its rings, every hex the
 * view opens followed by what it holds.
 */
export function layoutCanvas(shown: ShownView): CanvasHex[] {
  const ledger: Ledger = { tiles: new Map(), clashes: new Map() }
  const placements = layoutView(viewOf(shown, ledger))
  return placements.flatMap((placement) => hexOf(placement, placements, shown, ledger))
}

/**
 * The Tiles around the center, as one world lays them: the Tile it stands in (`above`), and the
 * other members of that Tile's ring (`beside`), each where it stands around the center's whole hex
 * (`heart`), the center's hex in the ring around that Tile scaled to it, as the camera leaves them
 * going into the center from there (`useCamera`), so they run on past the canvas. `above` is the view
 * of the Tile the center stands in, opened as centering it opens it; none where the center is not
 * in the ring around it, a Leaf inside it.
 */
export function surroundingsOf(above: ShownView, center: Of<'tile'>): Of<'tile'>[] {
  const hexes = layoutCanvas(above)
  const heart = framed(hexes, above.center.id)
  if (heart === undefined || center.heart === undefined) return []
  const whole = { center: center.heart.center, radius: center.heart.radius / heartShare }
  const around = hexes.filter(
    (hex): hex is Of<'tile'> =>
      hex.kind === 'tile' &&
      hex.generation === 1 &&
      Math.hypot(hex.hex.center.x - heart.center.x, hex.hex.center.y - heart.center.y) >=
        heart.radius,
  )
  const at = around.find(
    (hex) => hex.tile.id === center.tile.id && hex.tile.reference === undefined,
  )
  if (at === undefined) return []
  const share = whole.radius / at.hex.radius
  const placed = ({ center: point, radius }: Hex): Hex => ({
    center: {
      x: whole.center.x + (point.x - at.hex.center.x) * share,
      y: whole.center.y + (point.y - at.hex.center.y) * share,
    },
    radius: radius * share,
  })
  const parent = { kind: 'tile', tile: above.center, role: 'above', generation: -1 } as const
  return [
    { ...parent, key: `above:${above.center.id}`, hex: placed(heart) },
    ...around
      .filter((hex) => hex !== at)
      .map((hex): Of<'tile'> => ({
        ...hex,
        key: `beside:${hex.key}`,
        hex: placed(hex.hex),
        role: 'beside',
        generation: 0,
      })),
  ]
}

/** Where a Tile is framed: the hex it opens into while a ring shows inside it, else its own. */
function framed(hexes: readonly CanvasHex[], id: string): Hex | undefined {
  return (
    hexes.find((hex) => hex.kind === 'ground' && hex.key === `ground:${id}`)?.hex ??
    hexes.find((hex) => hex.kind === 'tile' && hex.role === 'center')?.hex
  )
}

/** The shape's view of `shown`: a Frame of the center, and one of each Branch it opens. */
function viewOf(shown: ShownView, ledger: Ledger): FrameView | CollapsedView {
  const frame = frameOf(shown.center, ledger)
  if (shown.frame === undefined) return { frame }
  const expanded: Partial<Record<Direction, FrameView>> = {}
  for (const direction of directions) {
    const kind = shown.expanded[direction]
    const branch = shown.center.branches?.[direction]
    if (kind !== undefined && branch !== undefined) {
      expanded[direction] = { frame: frameOf(branch, ledger), frameKind: kind }
    }
  }
  return { frame, frameKind: shown.frame, ...(shown.inner && { inner: shown.inner }), expanded }
}

/**
 * A Tile as the shape's Frame, its rings those the Tile offers (`kindsOf`): Children, or Branches and
 * Leaves past six, then Context. A Leaf offers none.
 */
function frameOf(tile: TileNode, ledger: Ledger): Frame {
  const own = enter(ledger, tile, tile.id)
  const kinds = kindsOf(tile)
  if (kinds.length === 0) return { tile: own, rings: {} }
  // A Context Tile may be a Reference to a Tile drawn elsewhere, so it stands under its slot.
  const context = ringOf('context', tile.context, ledger, (d) => `${tile.id}:context:${String(d)}`)
  const rings: Rings<Member> = kinds.includes('children')
    ? { children: childrenOf(tile, ledger), context }
    : {
        branches: ringOf('branch', tile.branches, ledger),
        leaves: ringOf('leaf', tile.leaves, ledger),
        context,
      }
  return { tile: own, rings }
}

/**
 * Writes one of the System's Tiles in the ledger under `path`, and returns the shape's Tile for it,
 * which the placements name by that path: a Branch's or a Leaf's id, unique in a System, or a Context
 * Tile's slot.
 */
function enter(ledger: Ledger, tile: TileNode, path: string): Tile {
  ledger.tiles.set(path, tile)
  return { path, title: tile.title, preview: tile.preview }
}

/** A ring whose members sit in their own Direction, as a System keeps them. */
function ringOf(
  kind: MemberKind,
  held: Partial<Record<Direction, TileNode>> | undefined,
  ledger: Ledger,
  pathOf: (direction: Direction, tile: TileNode) => string = (_, tile) => tile.id,
): SeatedRing<Member> {
  const members: SeatedRing<Member>['members'] = {}
  for (const direction of directions) {
    const tile = held?.[direction]
    if (tile !== undefined) {
      members[direction] = { kind, tile: enter(ledger, tile, pathOf(direction, tile)) }
    }
  }
  return { overflowing: false, members }
}

/**
 * The Children ring as the shape lays it (`shape/CLAUDE.md`, "The Children ring"): the Branches where
 * they sit, each Leaf in its own Direction when that is free, then the Leaves left over in the free
 * Directions in order. A Leaf whose Direction a Branch holds is a clash.
 */
function childrenOf(tile: TileNode, ledger: Ledger): SeatedChildren<Member> {
  const { members } = ringOf('branch', tile.branches, ledger)
  const clashes: Clash[] = []
  const leftOver: TileNode[] = []
  for (const direction of directions) {
    const leaf = tile.leaves?.[direction]
    const branch = tile.branches?.[direction]
    if (leaf === undefined) continue
    if (branch === undefined) {
      members[direction] = { kind: 'leaf', tile: enter(ledger, leaf, leaf.id) }
      continue
    }
    clashes.push({ direction, leaf: leaf.id, branch: branch.id })
    ledger.clashes.set(leaf.id, branch)
    leftOver.push(leaf)
  }
  for (const leaf of leftOver) {
    const free = directions.find((direction) => members[direction] === undefined)
    if (free !== undefined) members[free] = { kind: 'leaf', tile: enter(ledger, leaf, leaf.id) }
  }
  return { overflowing: false, members, clashes }
}

/** The canvas's hex for one of the shape's placements, scaled, with what it stands for. */
function hexOf(
  placement: Placement,
  placements: readonly Placement[],
  shown: ShownView,
  ledger: Ledger,
): CanvasHex[] {
  const drawn = { hex: scaled(placement), generation: placement.generation }
  if (placement.kind === 'empty') {
    const hub = hubOf(placement, placements)
    const parent = hub && ledger.tiles.get(hub.tile.path)
    if (hub === undefined || parent === undefined) return []
    const ring = ringAround(hub, shown)
    const key = `empty:${hub.tile.path}:${ring}:${String(placement.direction)}`
    return [
      { ...drawn, kind: 'empty', key, slot: { parent, ring, direction: placement.direction } },
    ]
  }
  const { path } = placement.tile
  const tile = ledger.tiles.get(path)
  if (tile === undefined) return []
  if (placement.opened === true) {
    return [{ ...drawn, kind: 'ground', key: `ground:${path}`, ring: openedInto(placement, shown) }]
  }
  if (placement.list !== undefined) {
    const names = placement.list.ring.candidates.map(
      ({ name }) => ledger.tiles.get(name)?.title ?? name,
    )
    return [
      { ...drawn, kind: 'list', key: `list:${path}`, tile, ring: placement.list.frameKind, names },
    ]
  }
  const key = `tile:${path}`
  if (placement.kind === 'center') return [centerOf({ ...drawn, key, tile }, shown)]
  const { direction, memberKind } = placement
  const role = isOpenBranch(placement, shown) ? 'hub' : memberKind
  const clash = memberKind === 'leaf' ? ledger.clashes.get(tile.id) : undefined
  // The center's rings, around it and inside it, stand in the center; a Branch's, opened in place,
  // a generation further, in the Branch at their heart.
  const hub = placement.generation === 1 ? undefined : hubOf(placement, placements)
  const parent = hub === undefined ? shown.center : ledger.tiles.get(hub.tile.path)
  return [
    {
      ...drawn,
      kind: 'tile',
      key,
      tile,
      role,
      direction,
      ...(parent && { parent }),
      ...(clash && { clash }),
    },
  ]
}

/**
 * The center's hex: alone and folded, the ground left around it, while no ring shows around it or
 * inside it; else as the shape places it.
 */
function centerOf(drawn: Drawn & { tile: TileNode }, shown: ShownView): CanvasHex {
  const center = { ...drawn, kind: 'tile', role: 'center' } as const
  const { hex } = drawn
  if (shown.frame !== undefined || shown.inner !== undefined) {
    // Its ring around it, the center's tile stands at its heart, as large as the ring's; a ring
    // inside it alone, the hex that ring opens into is its heart.
    const radius = shown.frame === undefined ? hex.radius : openedRadius
    return { ...center, heart: { center: hex.center, radius } }
  }
  const alone = { center: hex.center, radius: hex.radius * aloneShare }
  return {
    ...center,
    hex: alone,
    alone: true,
    heart: { center: hex.center, radius: alone.radius * heartShare },
  }
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
 * The hex a member or an empty one sits around: one generation up, the same size, a neighbor away, as
 * the shape lays a ring around its Tile. The shape's placement of a hex in a ring names its Direction
 * only.
 */
function hubOf(
  empty: Extract<Placement, { kind: 'empty' | 'member' }>,
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
