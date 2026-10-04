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
  const outer = offered.includes(wanted.outer) ? wanted.outer : fallbackOuter(offered)
  const inner = offered.includes(wanted.inner) ? wanted.inner : 'context'
  return { ...(centerExpansion(outer, inner) ?? { outer, inner: 'context' }), branches }
}

/** The kind a folder offering `offered` shows a ring of when the one asked for is missing. */
function fallbackOuter(offered: readonly FrameKind[]): 'children' | 'branches' {
  return offered.includes('children') ? 'children' : 'branches'
}

/** The kind a Branch opened into `wanted` shows, among the kinds its folder offers. */
export function shownKind(wanted: FrameKind, offered: readonly FrameKind[]): FrameKind {
  return offered.includes(wanted) ? wanted : fallbackOuter(offered)
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
  if (expansions.inner === null) return { outer: null, inner: 'context', branches: {} }
  if (expansions.inner === 'leaves') return { outer: 'branches', inner: 'leaves', branches: {} }
  return { outer: fallbackOuter(offered), inner: 'context', branches: {} }
}

/**
 * The outer ring's next kind, among those the folder offers that can sit beside the inner one;
 * the Branches opened in the ring close. A peeled center has no outer ring to switch.
 */
export function switchOuter(expansions: Expansions, offered: readonly FrameKind[]): Expansions {
  if (expansions.outer === null) return expansions
  const { inner } = expansions
  const next = nextOf(outerKinds, expansions.outer, (outer) => {
    return offered.includes(outer) && centerExpansion(outer, inner) !== undefined
  })
  const center = centerExpansion(next, inner)
  return center === undefined || next === expansions.outer
    ? expansions
    : { ...center, branches: {} }
}

/** The inner ring's next kind, among those the folder offers that can sit beside the outer one. */
export function switchInner(expansions: Expansions, offered: readonly FrameKind[]): Expansions {
  if (expansions.inner === null) return expansions
  const { outer } = expansions
  const next = nextOf(innerKinds, expansions.inner, (inner) => {
    return offered.includes(inner) && centerExpansion(outer, inner) !== undefined
  })
  const center = centerExpansion(outer, next)
  return center === undefined ? expansions : { ...center, branches: expansions.branches }
}

/**
 * The Branch in `direction` of the outer ring opened into its next kind, among those its folder
 * offers, `offered`, and closed after the last one.
 */
export function switchBranch(
  expansions: Expansions,
  direction: Direction,
  offered: readonly FrameKind[],
): Expansions {
  const kinds = frameKinds.filter((kind) => offered.includes(kind))
  const current = expansions.branches[direction]
  const next = current === undefined ? kinds[0] : kinds[kinds.indexOf(current) + 1]
  const others = directions.filter((other) => other !== direction)
  const branches: Expansions['branches'] = {}
  for (const other of others) {
    const kind = expansions.branches[other]
    if (kind !== undefined) branches[other] = kind
  }
  if (next !== undefined) branches[direction] = next
  return { ...expansions, branches }
}

/** The item after `current` in `items` that `fits`, going round; `current` when none does. */
function nextOf<T>(items: readonly T[], current: T, fits: (item: T) => boolean): T {
  const start = items.indexOf(current)
  for (let step = 1; step < items.length; step++) {
    const item = items[(start + step) % items.length]
    if (item !== undefined && fits(item)) return item
  }
  return current
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
