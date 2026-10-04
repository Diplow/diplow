// What the view shows in place of an overflowing ring's hexes: a list of its candidates' names,
// inside the hex opened into it when they fit there, or filling the view when that is the center's
// outer ring or the user opens it. Each name holds a Tile made from it, so a click, a
// shift-click and a right click on it do what they would on its hex. Pure, so it is tested
// without Obsidian.
import { patternOf } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import type { Listed, Placement, TileHex } from '../../2-claude-mod/hooks/shape/layout.ts'
import type { FrameKind, MemberKind, Tile } from '../../2-claude-mod/hooks/shape/node.ts'
import { listRows } from './text.ts'
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

/** Whether `hex`'s list fits inside it; when not, the hex says so and opens the list on a click. */
export function fitsIn(hex: ListedHex): boolean {
  return hex.list.ring.candidates.length <= listRows(hex.radius)
}

/** A list the user opened to fill the view: the path of its hex's Tile, and the center around it. */
export interface OpenedList {
  center: string
  path: string
}

/** A list filling the view: the hex it is of, and whether the user opened it from that hex. */
export interface FullList {
  holder: ListedHex
  /** True when the user opened it, and may go back to the hexes; false for the view's own ring. */
  openedFromHex: boolean
}

/**
 * The list that fills the view drawn as `placements` around `center`, if any: the view's own ring
 * when it overflows, whatever the user opened; or else the one `opened`, while the view keeps the
 * center it was opened around and the drawing still holds it in that hex.
 */
export function fullListOf(
  placements: readonly Placement[],
  opened: OpenedList | undefined,
  center: string,
): FullList | undefined {
  const listed = placements.filter(isListed)
  const own = listed.find(({ list }) => list.fillsView === true)
  if (own !== undefined) return { holder: own, openedFromHex: false }
  if (opened?.center !== center) return undefined
  const holder = listed.find(({ tile }) => tile.path === opened.path)
  return holder && { holder, openedFromHex: true }
}
