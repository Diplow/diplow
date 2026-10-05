// Turns a centered Tile and the view state into a flat list of placed hexes, frames first, so any
// renderer paints them in order without knowing the hierarchy.
import { directions, frameSlots, insetHex, type Direction, type Hex } from './geometry'

export interface TileNode {
  id: string
  title: string
  preview: string
  children?: Partial<Record<Direction, TileNode>>
  context?: Partial<Record<Direction, TileNode>>
  /** Drawn in place of the Tile of this id, which stands elsewhere: a search for the id skips it. */
  reference?: true
  /** Drawn in place of a Tile that no longer exists: it stands for no Tile, and its id is no Tile's. */
  broken?: true
}

/** What is open around the centered Tile, which is always shown as a Frame. */
export interface Unfolding {
  /** The Children shown as Frames. */
  expanded: ReadonlySet<string>
  /** Whether the centered Tile shows its Context, inside its own slot. */
  context: boolean
}

/** What a hex stands for: a Tile's Children around it, or its Context inside it. */
export type Ring = 'children' | 'context'

/**
 * Every placement has a `key`, unique in the list and stable across views, for React. A Child keeps
 * its key when it expands into the hub of its Frame, so it keeps the focus too. Children form a tree,
 * so a Child's id is unique on the canvas; a Context Tile, which may be a Reference, is keyed by slot.
 */
export type Placement =
  | { kind: 'frame'; key: string; ring: Ring; hex: Hex; depth: number; tile: TileNode }
  | { kind: 'tile'; key: string; role: 'hub' | Ring; hex: Hex; depth: number; tile: TileNode }
  | {
      kind: 'empty'
      key: string
      ring: Ring
      hex: Hex
      depth: number
      /** The Tile whose Frame, or whose Context, the slot belongs to. */
      parent: TileNode
      direction: Direction
    }

/** The gap between neighbors, as a share of a hex's radius. */
const gap = 0.05

/** The margin inside a Frame, between its edge and its ring, as a share of its radius. */
const padding = 0.08

function inset(hex: Hex): Hex {
  return insetHex(hex, hex.radius * gap)
}

export function layoutCanvas(center: TileNode, view: Unfolding, hex: Hex): Placement[] {
  return placeFrame(center, 'children', inset(hex), 0, view)
}

function placeFrame(
  tile: TileNode,
  ring: Ring,
  hex: Hex,
  depth: number,
  view: Unfolding,
): Placement[] {
  const slots = frameSlots(insetHex(hex, hex.radius * padding))
  const members = ring === 'children' ? tile.children : tile.context
  const hub = placeHub(tile, ring, slots.center, depth + 1, view)
  const around = directions.flatMap((direction): Placement[] => {
    const member = members?.[direction]
    const slot = slots.ring[direction]
    if (!member) {
      const key = `empty:${ring}:${tile.id}:${String(direction)}`
      const hex = inset(slot)
      return [{ kind: 'empty', key, ring, hex, depth: depth + 1, parent: tile, direction }]
    }
    if (ring === 'context') {
      // A Context slot may hold a Reference to a Tile drawn elsewhere, so its key is the slot's.
      const key = `tile:context:${String(direction)}`
      return [
        { kind: 'tile', key, role: 'context', hex: inset(slot), depth: depth + 1, tile: member },
      ]
    }
    return placeChild(member, slot, depth + 1, view)
  })
  return [
    { kind: 'frame', key: `frame:${ring}:${tile.id}`, ring, hex, depth, tile },
    ...hub,
    ...around,
  ]
}

function placeHub(
  tile: TileNode,
  ring: Ring,
  slot: Hex,
  depth: number,
  view: Unfolding,
): Placement[] {
  // Only the centered Tile, at the top level, can open its Context.
  if (ring === 'children' && depth === 1 && view.context) {
    return placeFrame(tile, 'context', inset(slot), depth, view)
  }
  return [{ kind: 'tile', key: `tile:${tile.id}`, role: 'hub', hex: inset(slot), depth, tile }]
}

function placeChild(tile: TileNode, slot: Hex, depth: number, view: Unfolding): Placement[] {
  if (view.expanded.has(tile.id)) return placeFrame(tile, 'children', inset(slot), depth, view)
  return [{ kind: 'tile', key: `tile:${tile.id}`, role: 'children', hex: inset(slot), depth, tile }]
}
