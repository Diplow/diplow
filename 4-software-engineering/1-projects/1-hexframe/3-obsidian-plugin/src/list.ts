// What the view shows in place of an overflowing ring's hexes: a list of its candidates' names,
// inside the hex opened into it, or filling the view when that is the center's outer ring or the
// user opens a list too long for its hex. Each name holds a Tile made from it, so a click, a
// shift-click and a right click on it do what they would on its hex. Pure, so it is tested
// without Obsidian.
import { patternOf } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import type {
  CollapsedView,
  FrameView,
  Listed,
  Placement,
  TileHex,
} from '../../2-claude-mod/hooks/shape/layout.ts'
import type { FrameKind, MemberKind, Tile } from '../../2-claude-mod/hooks/shape/node.ts'
import { inFolder } from './vault/frame.ts'

/**
 * A name of an overflowing ring's list. Its Tile is made from the name, folders with a trailing
 * `/`, since a list reads no file: what an exclusion would match.
 */
export interface ListItem {
  kind: 'item'
  memberKind: MemberKind
  tile: Tile
}

/** What the view shows holding a Tile, which a click, a right click and the focus land on. */
export type Clickable = TileHex | ListItem

/** A hex opened into a ring that overflows, which holds that ring's list. */
export type ListedHex = TileHex & { list: Listed }

/** Whether `placement` holds a list. */
export function isListed(placement: Placement): placement is ListedHex {
  return placement.kind !== 'empty' && placement.list !== undefined
}

/** The names of `hex`'s list, in the ring's order, each in the folder whose ring it is. */
export function itemsOf({ tile, list }: ListedHex): ListItem[] {
  return list.ring.candidates.map((slot) => ({
    kind: 'item',
    memberKind: slot.kind,
    tile: { path: inFolder(tile.path, slot.name), title: patternOf(slot), preview: '' },
  }))
}

/** How the view names the kind of a ring, in a list and in the lines under the drawing. */
export const ringNames: Record<FrameKind, string> = {
  children: 'Children',
  branches: 'Branches',
  leaves: 'Leaves',
  context: 'Context folders',
}

/** What a hex says when its list doesn't fit in it, and what a list filling the view is of. */
export function tooMany({ frameKind, ring }: Listed): string {
  return `${String(ring.candidates.length)} ${ringNames[frameKind]}, too many to draw`
}

/** A list filling the view: the hex it is of, and whether the view can go back to the hexes. */
export interface FullList {
  holder: ListedHex
  /** True when the user opened it from a hex; false when it is the center's outer ring. */
  back: boolean
}

/**
 * The list that fills the view, if any: the center's outer ring when it overflows, whatever the
 * user opened, or else the one of the hex at `opened`, the path of its Tile, when the drawing
 * still holds it there.
 */
export function fullListOf(
  view: FrameView | CollapsedView,
  placements: readonly Placement[],
  opened: string | undefined,
): FullList | undefined {
  if ('frameKind' in view) {
    const ring = view.frame.rings[view.frameKind]
    if (ring?.overflowing === true) {
      const { center, radius } = placements[0] ?? { center: { x: 0, y: 0 }, radius: 1 }
      const list = { frameKind: view.frameKind, ring }
      const { tile } = view.frame
      const holder: ListedHex = { kind: 'center', tile, center, radius, generation: 0, list }
      return { holder, back: false }
    }
  }
  const holder = placements.filter(isListed).find(({ tile }) => tile.path === opened)
  return holder && { holder, back: true }
}
