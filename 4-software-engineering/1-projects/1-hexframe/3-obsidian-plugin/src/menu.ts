// What the hex view's menu and its shortcuts offer on a hex: the items, their default keys, and what
// each asks of the view on a given hex, or nothing where it doesn't apply. The menu lists the items
// that apply, and a shortcut whose item doesn't apply does nothing. Each item is an Obsidian
// command, described here too. Pure, so which items apply to which hex is tested without Obsidian;
// the view carries them out.
import type { Command } from 'obsidian'

import type { CollapsedView, FrameView } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  basename,
  parent,
  type Direction,
  type FrameKind,
  type Slot,
} from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf, outerBranchOf, type Action } from './click.ts'
import {
  closeBranch,
  collapse,
  expandCenter,
  openBranch,
  sameExpansions,
  type Expansions,
} from './expansions.ts'
import { isListed, type Clickable } from './list.ts'
import { vaultPath } from './vault/frame.ts'

/** What the view drew, which the items read. */
export interface Drawing {
  view: FrameView | CollapsedView
  /** The expansions the view shows, which an item's move starts from. */
  shown: Expansions
  /** The Frame kinds the center offers. */
  offered: readonly FrameKind[]
  /** The Frame kinds each Branch around the center offers, by direction, where they were read. */
  branchKinds: Partial<Record<Direction, readonly FrameKind[]>>
  /** The path of the Tile whose hex's list fills the view, when one does. */
  fillingView?: string | undefined
}

/** The hex, or name of a list, an item acts on, and what the view drew around it. */
export interface Target extends Drawing {
  hex: Clickable
}

/**
 * What an item asks of the view: what a click would, new expansions to write and draw, the list of
 * the hex at a path to fill the view, a candidate left out of its folder's six, or the settings of
 * a folder opened.
 */
export type Plan =
  | { click: Action }
  | { expansions: Expansions }
  | { list: string }
  | { exclude: Excluded }
  | { settings: string }

/** A candidate to leave out, and the folder whose `exclusions.yaml` leaves it out. */
export interface Excluded {
  folder: string
  slot: Slot
}

/**
 * An item: its name in the menu and the command palette, its default key (Obsidian's: `' '` is
 * Space), and what it asks of the view on a hex.
 */
interface Row {
  name: string
  key: string
  plan: (target: Target) => Plan | undefined
}

/** The items, in the order the menu lists them. An item can't be added without its plan. */
const table = {
  'center-here': {
    name: 'Center here',
    key: 'Enter',
    plan: ({ hex }) => clickIf(hex.kind !== 'center', actionOf(hex, false), 'center'),
  },
  preview: {
    name: 'Preview',
    key: ' ',
    plan: ({ hex }) => clickIf(true, actionOf(hex, true), 'notes'),
  },
  'expand-as-children': { name: 'Expand as Children', key: 'H', plan: expandAs('children') },
  'expand-as-branches': { name: 'Expand as Branches', key: 'B', plan: expandAs('branches') },
  'expand-as-leaves': { name: 'Expand as Leaves', key: 'L', plan: expandAs('leaves') },
  'expand-as-context': { name: 'Expand as Context', key: 'C', plan: expandAs('context') },
  collapse: {
    name: 'Collapse',
    key: 'X',
    plan: (target) => expansionsIf(target, collapseOf(target)),
  },
  'show-list': {
    name: 'Show the list',
    key: 'S',
    plan: ({ hex, fillingView }) =>
      isListed(hex) && hex.tile.path !== fillingView ? { list: hex.tile.path } : undefined,
  },
  up: {
    name: 'Up',
    key: 'U',
    plan: ({ hex }) => clickIf(hex.kind === 'center', actionOf(hex, false), 'center'),
  },
  'open-in-default-app': {
    name: 'Open in default app',
    key: 'O',
    plan: ({ hex }) => clickIf(true, actionOf(hex, false), 'file'),
  },
  exclude: {
    name: 'Exclude from the six',
    key: 'E',
    plan: ({ hex }) => (hex.kind === 'center' ? undefined : { exclude: excludedOf(hex) }),
  },
  settings: {
    name: 'Hexframe settings',
    key: ',',
    plan: ({ view }) => ({ settings: vaultPath(view.frame.tile.path) }),
  },
} satisfies Record<string, Row>

/** The items of the menu, each an Obsidian command of the same id. */
export type ItemId = keyof typeof table

/** An item: its id, its name and its default key. */
export interface Item {
  id: ItemId
  name: string
  key: string
}

/** The items in the order the menu lists them. */
export const items: readonly Item[] = (Object.keys(table) as ItemId[]).map((id) => ({
  id,
  name: table[id].name,
  key: table[id].key,
}))

/**
 * What `item` asks of the view on `target`'s hex, or undefined when it doesn't apply there. A move
 * that would change nothing doesn't apply either, so the file keeps asking for what it asked for.
 */
export function planOf(item: ItemId, target: Target): Plan | undefined {
  const row: Row = table[item]
  return row.plan(target)
}

/**
 * The commands the items are: each bound to its key by default, and carried out by `run`, which
 * says whether it applies (`checking`) or carries it out, and is undefined while no hexframe view
 * has the focus.
 */
export function commandsOf(
  run: (item: ItemId, checking: boolean) => boolean | undefined,
): Command[] {
  return items.map(({ id, name, key }) => ({
    id,
    name,
    hotkeys: [{ modifiers: [], key }],
    checkCallback: (checking: boolean) => run(id, checking) ?? false,
  }))
}

/**
 * The click a click item asks, when it applies to the hex (`applies`) and what a click would do
 * there holds what the item is for: a folder to center on, notes to show, or a file for the
 * system. A Leaf that isn't Markdown has no note to preview: the paired pane is for notes.
 */
function clickIf(
  applies: boolean,
  click: Action | undefined,
  wanted: 'center' | 'notes' | 'file',
): Plan | undefined {
  if (!applies || click === undefined) return undefined
  const has = wanted === 'center' ? click.center !== undefined : wanted in click.open
  return has ? { click } : undefined
}

/**
 * What "Exclude from the six" leaves out for `hex`, a member of a ring or a name of a list: its
 * name, as a candidate of the folder holding it, whose exclusions then list it.
 */
function excludedOf({ tile, memberKind }: Exclude<Clickable, { kind: 'center' }>): Excluded {
  return {
    folder: vaultPath(parent(tile.path)),
    slot: { kind: memberKind, name: basename(tile.path) },
  }
}

/** `next` as a plan, unless it is missing or opens the same as what the view shows. */
function expansionsIf({ shown }: Target, next: Expansions | undefined): Plan | undefined {
  return next === undefined || sameExpansions(next, shown) ? undefined : { expansions: next }
}

/**
 * The plan of "Expand as `kind`": the center opened into it, as `expandCenter` says, or a Branch
 * around the center opened into it, when its folder offers it and the view doesn't show it opened
 * so already. The inner ring's hexes and a Branch's own members open nothing.
 */
function expandAs(kind: FrameKind): Row['plan'] {
  return (target) => {
    const { hex, shown, offered, branchKinds } = target
    if (hex.kind === 'center') return expansionsIf(target, expandCenter(shown, kind, offered))
    const direction = outerBranchOf(hex)
    if (direction === undefined || shown.outer === null) return undefined
    if (branchKinds[direction]?.includes(kind) !== true) return undefined
    if (openedKind(target, direction) === kind) return undefined
    return expansionsIf(target, openBranch(shown, direction, kind))
  }
}

/**
 * The expansions "Collapse" makes of the hex: the center peeled, its outer ring first, or a Branch
 * around it that the view shows opened, closed.
 */
function collapseOf(target: Target): Expansions | undefined {
  const { hex, shown } = target
  if (hex.kind === 'center') return collapse(shown)
  const direction = outerBranchOf(hex)
  if (direction === undefined || openedKind(target, direction) === undefined) return undefined
  return closeBranch(shown, direction)
}

/** The kind the Branch in `direction` shows opened, or undefined while the view shows it closed. */
function openedKind({ view }: Target, direction: Direction): FrameKind | undefined {
  return 'frameKind' in view ? view.expanded?.[direction]?.frameKind : undefined
}
