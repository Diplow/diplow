// Turns a centered Tile and the view state into a flat list of placed hexes, frames first, so any
// renderer paints them in order without knowing the hierarchy.
import { directions, frameSlots, insetHex, type Direction, type Hex } from './geometry'

export interface TileNode {
  id: string
  title: string
  preview: string
  children?: Partial<Record<Direction, TileNode>>
  context?: Partial<Record<Direction, TileNode>>
}

export interface CanvasView {
  /** The Tiles shown as Frames. The centered Tile is always one. */
  expanded: ReadonlySet<string>
  /** Whether the centered Tile shows its Context, inside its own slot. */
  showContext: boolean
}

/** What a hex stands for: a Tile's Children around it, or its Context inside it. */
type Ring = 'children' | 'context'

export type Placement =
  | { kind: 'frame'; ring: Ring; hex: Hex; depth: number; tile: TileNode }
  | { kind: 'tile'; role: 'hub' | Ring; hex: Hex; depth: number; tile: TileNode }
  | { kind: 'empty'; ring: Ring; hex: Hex; depth: number; direction: Direction }

/** The gap between neighbors, as a share of a hex's radius. */
const gap = 0.05

/** The margin inside a Frame, between its edge and its ring, as a share of its radius. */
const padding = 0.08

function inset(hex: Hex): Hex {
  return insetHex(hex, hex.radius * gap)
}

export function layoutCanvas(center: TileNode, view: CanvasView, hex: Hex): Placement[] {
  return placeFrame(center, 'children', inset(hex), 0, view)
}

function placeFrame(
  tile: TileNode,
  ring: Ring,
  hex: Hex,
  depth: number,
  view: CanvasView,
): Placement[] {
  const slots = frameSlots(insetHex(hex, hex.radius * padding))
  const members = ring === 'children' ? tile.children : tile.context
  const hub = placeHub(tile, ring, slots.center, depth + 1, view)
  const around = directions.flatMap((direction): Placement[] => {
    const member = members?.[direction]
    const slot = slots.ring[direction]
    if (!member) return [{ kind: 'empty', ring, hex: inset(slot), depth: depth + 1, direction }]
    return placeMember(member, ring, slot, depth + 1, view)
  })
  return [{ kind: 'frame', ring, hex, depth, tile } as const, ...hub, ...around]
}

function placeHub(
  tile: TileNode,
  ring: Ring,
  slot: Hex,
  depth: number,
  view: CanvasView,
): Placement[] {
  // Only the centered Tile, at the top level, can open its Context.
  if (ring === 'children' && depth === 1 && view.showContext) {
    return placeFrame(tile, 'context', inset(slot), depth, view)
  }
  return [{ kind: 'tile', role: 'hub', hex: inset(slot), depth, tile } as const]
}

function placeMember(
  tile: TileNode,
  ring: Ring,
  slot: Hex,
  depth: number,
  view: CanvasView,
): Placement[] {
  if (ring === 'children' && view.expanded.has(tile.id)) {
    return placeFrame(tile, 'children', inset(slot), depth, view)
  }
  return [{ kind: 'tile', role: ring, hex: inset(slot), depth, tile } as const]
}
