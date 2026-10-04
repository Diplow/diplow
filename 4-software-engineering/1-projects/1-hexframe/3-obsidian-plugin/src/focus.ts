// Which hex of the view, or name of a list, holds the keyboard's focus, and where Tab and the digits
// move it. The focus is the path of a Tile the view shows, so it survives a drawing: every hex that
// holds a Tile, the opened ones aside, holds another one, and so does every name of a list. Pure,
// so it is tested without Obsidian.
import type { CollapsedView, FrameView, Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  directions,
  membersOf,
  type Direction,
  type Frame,
  type FrameKind,
} from '../../2-claude-mod/hooks/shape/node.ts'
import { fitsIn, isListed, itemsOf, type Clickable, type FullList } from './list.ts'

/**
 * What the focus moves among, in the order the view draws it: every hex holding a Tile but an
 * opened one, whose Tile its hub holds again, and right after a hex whose list fits in it, as the
 * drawing draws it, the names of that list. The center comes first.
 */
export function focusable(placements: readonly Placement[]): Clickable[] {
  return placements.flatMap((placement): Clickable[] => {
    if (placement.kind === 'empty' || placement.opened === true) return []
    return isListed(placement) && fitsIn(placement)
      ? [placement, ...itemsOf(placement)]
      : [placement]
  })
}

/** What the focus moves among when `full` fills the view: its hex, then its names. */
export function focusableInList({ holder }: FullList): Clickable[] {
  return [holder, ...itemsOf(holder)]
}

/** The hex `focus` names among `hexes`, or the center when it names none of them. */
export function focusedHex(
  focus: string | undefined,
  hexes: readonly Clickable[],
): Clickable | undefined {
  return (
    hexes.find(({ tile }) => tile.path === focus) ?? hexes.find(({ kind }) => kind === 'center')
  )
}

/** The focus Tab moves to, `step` 1, or shift-Tab, -1, going round. */
export function stepFocus(
  focus: string | undefined,
  hexes: readonly Clickable[],
  step: 1 | -1,
): string | undefined {
  const current = focusedHex(focus, hexes)
  if (current === undefined) return hexes[0]?.tile.path
  const at = hexes.indexOf(current)
  return hexes[(at + step + hexes.length) % hexes.length]?.tile.path
}

/**
 * The focus a digit moves to: from the center, the hex in `direction` of the ring around it, or
 * inside it when it has none; from any other hex, of the ring it sits in, an opened Branch being
 * its own ring's neighbor. Undefined when that direction holds no Tile, or none `hexes` holds: a
 * list filling the view leaves out the rings around it.
 */
export function focusToward(
  focus: string | undefined,
  view: FrameView | CollapsedView,
  hexes: readonly Clickable[],
  direction: Direction,
): string | undefined {
  const from = focusedHex(focus, hexes)
  if (from === undefined) return undefined
  const { around, inside, opened } = ringsOf(view)
  const sitsIn =
    from.kind === 'center'
      ? (around ?? inside)
      : [around, inside, ...opened].find((ring) =>
          Object.values(ring?.members ?? {}).includes(from.tile.path),
        )
  const to = sitsIn?.members[direction]
  return hexes.some(({ tile }) => tile.path === to) ? to : undefined
}

/** A ring the view draws: its members' paths by direction. */
interface DrawnRing {
  members: Partial<Record<Direction, string>>
}

/** The rings `view` draws: around the center, inside it, and in each opened Branch. */
function ringsOf(view: FrameView | CollapsedView): {
  around?: DrawnRing
  inside?: DrawnRing
  opened: DrawnRing[]
} {
  const inside = view.inner === undefined ? undefined : ringOf(view.frame, view.inner)
  if (!('frameKind' in view)) return { inside, opened: [] }
  const opened = Object.values(view.expanded ?? {}).map((branch) =>
    ringOf(branch.frame, branch.frameKind),
  )
  return { around: ringOf(view.frame, view.frameKind), inside, opened }
}

function ringOf(frame: Frame, kind: FrameKind): DrawnRing {
  const members = membersOf(frame.rings[kind])
  const paths: DrawnRing['members'] = {}
  for (const direction of directions) {
    const member = members[direction]
    if (member !== undefined) paths[direction] = member.tile.path
  }
  return { members: paths }
}
