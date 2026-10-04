// How the view opens what it shows, depth 2: the center twice, a ring around its hex and one
// inside it, and each Branch of the outer ring once more, the third scale. The combinations a view
// may show, the moves between them, and what a folder makes of them. Pure, so it is tested without
// Obsidian.
import type { CollapsedView, FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  directions,
  frameKinds,
  kindsOf,
  membersOf,
  type Direction,
  type Frame,
  type FrameKind,
} from '../../2-claude-mod/hooks/shape/node.ts'

/** The Frame kinds of the ring around the center's hex, full size. */
export type OuterKind = 'children' | 'branches' | 'leaves'

/** The Frame kinds of the ring inside the center's hex. */
export type InnerKind = 'leaves' | 'context'

export const outerKinds: readonly OuterKind[] = ['children', 'branches', 'leaves']
export const innerKinds: readonly InnerKind[] = ['leaves', 'context']

/**
 * How the center opens: an outer ring and an inner one, never of the same kind, and Children,
 * which hold the Leaves, only beside Context; the inner one alone once the outer is peeled; or
 * neither, the center collapsed.
 */
export type CenterExpansion =
  | { outer: 'branches'; inner: InnerKind }
  | { outer: 'children' | 'leaves'; inner: 'context' }
  | { outer: null; inner: InnerKind | null }

/** The view's expansions: the center's, and the kind each Branch of its outer ring opens into. */
export type Expansions = CenterExpansion & { branches: Partial<Record<Direction, FrameKind>> }

/** The expansions of a new hexframe file: Children (or Branches) around, Context inside. */
export const defaultExpansions: Expansions = { outer: 'children', inner: 'context', branches: {} }

/** The center's expansion with `outer` and `inner`, or undefined when a view can't show the pair. */
export function centerExpansion(
  outer: OuterKind | null,
  inner: InnerKind | null,
): CenterExpansion | undefined {
  if (outer === null) return { outer, inner }
  if (outer === 'branches' && inner !== null) return { outer, inner }
  if (inner === 'context') return { outer, inner }
  return undefined
}

/** The center's expansion with `outer` around and Context inside: every outer kind sits beside it. */
export function beside(outer: OuterKind): CenterExpansion {
  return { outer, inner: 'context' }
}

/**
 * The center's expansion that opens around `inner` in a folder offering `offered`: Branches
 * beside Leaves, the only kind that sits beside them; beside Context, Children, or Branches past
 * six.
 */
export function around(inner: InnerKind, offered: readonly FrameKind[]): CenterExpansion {
  return inner === 'leaves' ? { outer: 'branches', inner } : beside(defaultRing(offered))
}

/**
 * The expansions a folder offering `offered` shows for `wanted`. An outer kind it doesn't offer
 * gives Children, or Branches past six Branches and Leaves; an inner kind it doesn't offer, or
 * that can't sit beside the outer one, gives Context, which every folder offers.
 */
export function shownExpansions(wanted: Expansions, offered: readonly FrameKind[]): Expansions {
  const { branches } = wanted
  if (wanted.outer === null) {
    const inner =
      wanted.inner !== null && !offered.includes(wanted.inner) ? 'context' : wanted.inner
    return { outer: null, inner, branches }
  }
  const outer = offered.includes(wanted.outer) ? wanted.outer : defaultRing(offered)
  const inner = offered.includes(wanted.inner) ? wanted.inner : 'context'
  return { ...(centerExpansion(outer, inner) ?? beside(outer)), branches }
}

/**
 * The kind of ring a folder offering `offered` shows when the one asked for is missing, around
 * the center or in an opened Branch: Children, or Branches past six Branches and Leaves.
 */
function defaultRing(offered: readonly FrameKind[]): 'children' | 'branches' {
  return offered.includes('children') ? 'children' : 'branches'
}

/** The kind a Branch opened into `wanted` shows, among the kinds its folder offers. */
export function shownKind(wanted: FrameKind, offered: readonly FrameKind[]): FrameKind {
  return offered.includes(wanted) ? wanted : defaultRing(offered)
}

/** Collapsing peels the outer ring first, then the inner one; a collapsed center stays so. */
export function collapse(expansions: Expansions): Expansions {
  if (expansions.outer !== null) return { outer: null, inner: expansions.inner, branches: {} }
  return { outer: null, inner: null, branches: {} }
}

/**
 * Expanding undoes a collapse: Context inside a collapsed center, then the outer ring around it,
 * Children or Branches beside Context, Branches beside Leaves. An open center stays so.
 */
export function expand(expansions: Expansions, offered: readonly FrameKind[]): Expansions {
  if (expansions.outer !== null) return expansions
  const { inner } = expansions
  if (inner === null) return { outer: null, inner: 'context', branches: {} }
  return { ...around(inner, offered), branches: {} }
}

/** A new center opens none of the Branches around the old one: they were the old center's. */
export function recenter(expansions: Expansions): Expansions {
  return { ...expansions, branches: {} }
}

/**
 * The outer ring's next kind, among those the folder offers that can sit beside the inner one;
 * the Branches opened in the ring close. A peeled center has no outer ring to switch.
 */
export function switchOuter(expansions: Expansions, offered: readonly FrameKind[]): Expansions {
  if (expansions.outer === null) return expansions
  const { inner } = expansions
  const pairs = outerKinds
    .filter((outer) => offered.includes(outer))
    .flatMap((outer) => pairOf(outer, inner))
  const next = following(pairs, ({ outer }) => outer === expansions.outer)
  return next === undefined ? expansions : { ...next, branches: {} }
}

/** The inner ring's next kind, among those the folder offers that can sit beside the outer one. */
export function switchInner(expansions: Expansions, offered: readonly FrameKind[]): Expansions {
  if (expansions.inner === null) return expansions
  const { outer } = expansions
  const pairs = innerKinds
    .filter((inner) => offered.includes(inner))
    .flatMap((inner) => pairOf(outer, inner))
  const next = following(pairs, ({ inner }) => inner === expansions.inner)
  return next === undefined ? expansions : { ...next, branches: expansions.branches }
}

/** The pair of `outer` and `inner` when a view shows it, as a list of one, or none. */
function pairOf(outer: OuterKind | null, inner: InnerKind): CenterExpansion[] {
  const pair = centerExpansion(outer, inner)
  return pair === undefined ? [] : [pair]
}

/** The item after the current one in `items`, going round; undefined when no other is there. */
function following<T>(items: readonly T[], isCurrent: (item: T) => boolean): T | undefined {
  const at = items.findIndex(isCurrent)
  if (items.length < 2) return at === -1 ? items[0] : undefined
  return items[(at + 1) % items.length]
}

/**
 * The Branch in `direction` of the outer ring opened into the kind after the one it shows, among
 * those its folder offers, `offered`, and closed after the last one. A peeled center has no
 * outer ring, so no Branch to open.
 */
export function switchBranch(
  expansions: Expansions,
  direction: Direction,
  offered: readonly FrameKind[],
): Expansions {
  if (expansions.outer === null) return expansions
  const kinds = frameKinds.filter((kind) => offered.includes(kind))
  const wanted = expansions.branches[direction]
  const current = wanted === undefined ? undefined : shownKind(wanted, offered)
  const next = current === undefined ? kinds[0] : kinds[kinds.indexOf(current) + 1]
  const branches: Expansions['branches'] = {}
  for (const other of directions.filter((one) => one !== direction)) {
    const kind = expansions.branches[other]
    if (kind !== undefined) branches[other] = kind
  }
  if (next !== undefined) branches[direction] = next
  return { ...expansions, branches }
}

/** Whether `one` and `other` open the same: what the file would hold for each. */
export function sameExpansions(one: Expansions, other: Expansions): boolean {
  const key = ({ outer, inner, branches }: Expansions) =>
    JSON.stringify([outer, inner, directions.map((direction) => branches[direction] ?? null)])
  return key(one) === key(other)
}

/**
 * The Branches of `frame`'s outer ring that `shown` opens, by direction, with their path: the
 * folders the view reads as Frames beside the center's.
 */
export function branchesToOpen(
  frame: Frame,
  shown: Expansions,
): { direction: Direction; path: string }[] {
  if (shown.outer === null) return []
  const members = membersOf(frame.rings[shown.outer])
  return directions.flatMap((direction) => {
    const member = members[direction]
    const isOpened = shown.branches[direction] !== undefined && member?.kind === 'branch'
    return isOpened ? [{ direction, path: member.tile.path }] : []
  })
}

/**
 * What the shape lays out for `frame` with `shown`, its Branches in `opened` drawn as their own
 * Frames, each of the kind it opens into, among those its folder offers.
 */
export function viewOf(
  frame: Frame,
  shown: Expansions,
  opened: Partial<Record<Direction, Frame>>,
): FrameView | CollapsedView {
  const inner = shown.inner ?? undefined
  if (shown.outer === null) return inner === undefined ? { frame } : { frame, inner }
  const expanded: Partial<Record<Direction, FrameView>> = {}
  for (const direction of directions) {
    const branch = opened[direction]
    const wanted = shown.branches[direction]
    if (branch === undefined || wanted === undefined) continue
    expanded[direction] = { frame: branch, frameKind: shownKind(wanted, kindsOf(branch.rings)) }
  }
  return { frame, frameKind: shown.outer, ...(inner && { inner }), expanded }
}
