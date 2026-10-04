// How the view opens what it shows, depth 2: the center twice, a ring around its hex and one
// inside it, and each Branch of the outer ring once more, the third scale. The combinations a view
// may show, the moves between them, and what a folder makes of them. Pure, so it is tested without
// Obsidian.
import type { CollapsedView, FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  directions,
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

/** A new center opens none of the Branches around the old one: they were the old center's. */
export function recenter(expansions: Expansions): Expansions {
  return { ...expansions, branches: {} }
}

/**
 * The center opened into `kind`, among the kinds its folder offers, `offered`, as "Expand as" asks
 * it; undefined when the rings forbid it, the folder doesn't offer it, or it shows already.
 *
 * - A collapsed center opens its inner ring, Leaves or Context.
 * - A peeled center opens its outer ring around the inner one when `kind` can sit beside it, or
 *   else switches its inner ring.
 * - An open center switches the ring that can take `kind`, the inner one first, so Leaves go
 *   inside Branches; switching the outer ring closes the Branches opened in it.
 */
export function expandCenter(
  expansions: Expansions,
  kind: FrameKind,
  offered: readonly FrameKind[],
): Expansions | undefined {
  const { outer, inner, branches } = expansions
  if (!offered.includes(kind) || kind === outer || kind === inner) return undefined
  const asInner = isInnerKind(kind) ? centerExpansion(outer, kind) : undefined
  const asOuter = isOuterKind(kind) && inner !== null ? centerExpansion(kind, inner) : undefined
  if (outer === null && inner !== null && asOuter !== undefined) return { ...asOuter, branches: {} }
  if (asInner !== undefined) return { ...asInner, branches: outer === null ? {} : branches }
  return asOuter === undefined ? undefined : { ...asOuter, branches: {} }
}

function isInnerKind(kind: FrameKind): kind is InnerKind {
  return (innerKinds as readonly FrameKind[]).includes(kind)
}

function isOuterKind(kind: FrameKind): kind is OuterKind {
  return (outerKinds as readonly FrameKind[]).includes(kind)
}

/**
 * The Branch in `direction` of the outer ring opened into `kind`, the others as they are. A peeled
 * center has no outer ring, so no Branch to open.
 */
export function openBranch(
  expansions: Expansions,
  direction: Direction,
  kind: FrameKind,
): Expansions {
  if (expansions.outer === null) return expansions
  return { ...expansions, branches: { ...withoutBranch(expansions, direction), [direction]: kind } }
}

/** The Branch in `direction` of the outer ring closed, the others as they are. */
export function closeBranch(expansions: Expansions, direction: Direction): Expansions {
  return { ...expansions, branches: withoutBranch(expansions, direction) }
}

function withoutBranch(expansions: Expansions, direction: Direction): Expansions['branches'] {
  const branches: Expansions['branches'] = {}
  for (const other of directions.filter((one) => one !== direction)) {
    const kind = expansions.branches[other]
    if (kind !== undefined) branches[other] = kind
  }
  return branches
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
