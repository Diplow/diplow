// Which hex of the view holds the keyboard's focus, and where Tab and the digits move it. The focus
// is the path of a Tile the view shows, so it survives a drawing: every hex that holds a Tile, the
// opened ones aside, holds another one. Pure, so it is tested without Obsidian.
import type { CollapsedView, FrameView, Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  directions,
  membersOf,
  type Direction,
  type Frame,
  type FrameKind,
} from '../../2-claude-mod/hooks/shape/node.ts'

/** A hex holding a Tile, which a click, the menu and the shortcuts act on. */
export type TileHex = Exclude<Placement, { kind: 'empty' }>

/**
 * The hexes the focus moves among, in the order the view draws them: every hex holding a Tile but
 * an opened one, whose Tile its hub holds again. The center comes first.
 */
export function focusable(placements: readonly Placement[]): TileHex[] {
  return placements.filter(
    (placement): placement is TileHex => placement.kind !== 'empty' && placement.opened !== true,
  )
}

/** The hex `focus` names among `hexes`, or the center when it names none of them. */
export function focusedHex(
  focus: string | undefined,
  hexes: readonly TileHex[],
): TileHex | undefined {
  return (
    hexes.find(({ tile }) => tile.path === focus) ?? hexes.find(({ kind }) => kind === 'center')
  )
}

/** The focus Tab moves to, `step` 1, or shift-Tab, -1, going round. */
export function stepFocus(
  focus: string | undefined,
  hexes: readonly TileHex[],
  step: 1 | -1,
): string | undefined {
  const current = focusedHex(focus, hexes)
  if (current === undefined) return hexes[0]?.tile.path
  const at = hexes.indexOf(current)
  return hexes[(at + step + hexes.length) % hexes.length]?.tile.path
}

/**
 * The focus a digit moves to: the hex in `direction` of the ring the focused hex sits in, or, for
 * the center, of the ring around it, the one inside when it has none. Undefined when that
 * direction holds no Tile.
 */
export function focusToward(
  focus: string | undefined,
  view: FrameView | CollapsedView,
  hexes: readonly TileHex[],
  direction: Direction,
): string | undefined {
  const from = focusedHex(focus, hexes)?.tile.path
  if (from === undefined) return undefined
  const rings = ringsOf(view)
  const ring =
    rings.find(({ members }) => Object.values(members).includes(from)) ??
    rings.find(({ hub }) => hub === from)
  return ring?.members[direction]
}

/** A ring the view draws: the path of the Tile it surrounds, and its members' by direction. */
interface DrawnRing {
  hub: string
  members: Partial<Record<Direction, string>>
}

/**
 * The rings `view` draws, the one around the center first, then the opened Branches', then the one
 * inside the center, so a Branch's own ring comes after the ring it sits in.
 */
function ringsOf(view: FrameView | CollapsedView): DrawnRing[] {
  const rings: DrawnRing[] = []
  if ('frameKind' in view) {
    rings.push(ringOf(view.frame, view.frameKind))
    for (const branch of Object.values(view.expanded ?? {})) {
      rings.push(ringOf(branch.frame, branch.frameKind))
    }
  }
  if (view.inner !== undefined) rings.push(ringOf(view.frame, view.inner))
  return rings
}

function ringOf(frame: Frame, kind: FrameKind): DrawnRing {
  const members = membersOf(frame.rings[kind])
  const paths: DrawnRing['members'] = {}
  for (const direction of directions) {
    const member = members[direction]
    if (member !== undefined) paths[direction] = member.tile.path
  }
  return { hub: frame.tile.path, members: paths }
}
