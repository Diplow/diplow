// What the hex view's menu and its shortcuts offer on a hex: the items, their default keys, and what
// each asks of the view on a given hex, or nothing where it doesn't apply. The menu lists the items
// that apply, and a shortcut whose item doesn't apply does nothing. Pure, so which items apply to
// which hex is tested without Obsidian; the view carries them out.
import type { CollapsedView, FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  basename,
  isMarkdown,
  type Direction,
  type FrameKind,
} from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf, outerBranchOf, type Action, type TileHex } from './click.ts'
import { closeBranch, collapse, expandCenter, openBranch, type Expansions } from './expansions.ts'

/** The items of the menu, each an Obsidian command of the same id. */
export type ItemId =
  | 'center-here'
  | 'preview'
  | 'expand-as-children'
  | 'expand-as-branches'
  | 'expand-as-leaves'
  | 'expand-as-context'
  | 'collapse'
  | 'up'
  | 'open-in-default-app'

/** An item: its id, its name in the menu and the command palette, and its default key. */
export interface Item {
  id: ItemId
  name: string
  key: string
}

/** The items in the order the menu lists them. A key is Obsidian's: `' '` is Space. */
export const items: readonly Item[] = [
  { id: 'center-here', name: 'Center here', key: 'Enter' },
  { id: 'preview', name: 'Preview', key: ' ' },
  { id: 'expand-as-children', name: 'Expand as Children', key: 'H' },
  { id: 'expand-as-branches', name: 'Expand as Branches', key: 'B' },
  { id: 'expand-as-leaves', name: 'Expand as Leaves', key: 'L' },
  { id: 'expand-as-context', name: 'Expand as Context', key: 'C' },
  { id: 'collapse', name: 'Collapse', key: 'X' },
  { id: 'up', name: 'Up', key: 'U' },
  { id: 'open-in-default-app', name: 'Open in default app', key: 'O' },
]

/** The Frame kind each "Expand as" item opens. */
const expandsAs: Partial<Record<ItemId, FrameKind>> = {
  'expand-as-children': 'children',
  'expand-as-branches': 'branches',
  'expand-as-leaves': 'leaves',
  'expand-as-context': 'context',
}

/** What the view drew, which the items read. */
export interface Drawing {
  view: FrameView | CollapsedView
  /** The Frame kinds the center offers. */
  offered: readonly FrameKind[]
  /** The Frame kinds each Branch around the center offers, by direction, where they were read. */
  branchKinds: Partial<Record<Direction, readonly FrameKind[]>>
}

/** The hex an item acts on, what the view drew around it, and the expansions it shows. */
export interface Target extends Drawing {
  hex: TileHex
  /** The expansions the view shows, which an item's move starts from. */
  shown: Expansions
}

/** What an item asks of the view: what a click would, or new expansions to write and draw. */
export type Plan = { click: Action } | { expansions: Expansions }

/**
 * What `item` asks of the view on `target`'s hex, or undefined when it doesn't apply there. A move
 * that would change nothing doesn't apply either, so the file keeps asking for what it asked for.
 */
export function planOf(item: ItemId, { hex, ...around }: Target): Plan | undefined {
  const kind = expandsAs[item]
  if (kind !== undefined) return expansionsPlan(expandAs(hex, kind, around))
  if (item === 'collapse') return expansionsPlan(collapseOf(hex, around))
  return clickPlan(item, hex)
}

function expansionsPlan(expansions: Expansions | undefined): Plan | undefined {
  return expansions === undefined ? undefined : { expansions }
}

/**
 * The items that act as a click does: centering on a Branch or a Context folder, showing a hex's
 * note without moving, going up from the center, handing a Leaf that isn't Markdown to the system.
 * A Leaf that isn't Markdown has no note to preview: the paired pane is for notes.
 */
function clickPlan(item: ItemId, hex: TileHex): Plan | undefined {
  const isMember = hex.kind === 'member'
  const isLeaf = isMember && hex.memberKind === 'leaf'
  const isDocument = isLeaf && !isMarkdown(basename(hex.tile.path))
  const applies: Partial<Record<ItemId, boolean>> = {
    'center-here': isMember && !isLeaf,
    preview: !isDocument,
    up: hex.kind === 'center' && actionOf(hex, false)?.center !== undefined,
    'open-in-default-app': isDocument,
  }
  if (applies[item] !== true) return undefined
  const click = actionOf(hex, item === 'preview')
  return click === undefined ? undefined : { click }
}

type Around = Omit<Target, 'hex'>

/**
 * The expansions "Expand as `kind`" makes of `hex`: the center opened into it, as `expandCenter`
 * says, or a Branch around the center opened into it, when its folder offers it and it doesn't
 * show it already. The inner ring's hexes and a Branch's own members open nothing.
 */
function expandAs(hex: TileHex, kind: FrameKind, around: Around): Expansions | undefined {
  if (hex.kind === 'center') return expandCenter(around.shown, kind, around.offered)
  const direction = outerBranchOf(hex)
  if (direction === undefined || around.shown.outer === null) return undefined
  const offered = around.branchKinds[direction]
  if (offered === undefined || !offered.includes(kind)) return undefined
  if (openedKind(around, direction) === kind) return undefined
  return openBranch(around.shown, direction, kind)
}

/**
 * The expansions "Collapse" makes of `hex`: the center peeled, its outer ring first, or an opened
 * Branch around it closed. A hex that shows nothing opened has nothing to collapse, a Branch the
 * view left closed included.
 */
function collapseOf(hex: TileHex, around: Around): Expansions | undefined {
  const { shown } = around
  if (hex.kind === 'center') {
    return shown.outer === null && shown.inner === null ? undefined : collapse(shown)
  }
  const direction = outerBranchOf(hex)
  if (direction === undefined || openedKind(around, direction) === undefined) return undefined
  return closeBranch(shown, direction)
}

/** The kind the Branch in `direction` shows opened, or undefined while the view shows it closed. */
function openedKind({ view }: Around, direction: Direction): FrameKind | undefined {
  return 'frameKind' in view ? view.expanded?.[direction]?.frameKind : undefined
}
