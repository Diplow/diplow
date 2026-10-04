// What a click on a hex of the view does: where the view moves, and what it opens beside it. Pure,
// so the click rules are tested without Obsidian; the view carries the action out.
import type { Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  basename,
  bodySources,
  isMarkdown,
  parent,
  type Direction,
} from '../../2-claude-mod/hooks/shape/node.ts'
import type { ListItem } from './list.ts'
import { vaultPath } from './vault/frame.ts'

/**
 * What the view opens: the first of `notes` that exists, in the paired pane, or a `file` in the
 * system's default app, once the vault lets it hand that file over.
 */
export type Asked = { notes: string[] } | { file: string }

/** What a click asks of the view. Paths are relative to the vault, `''` being its root. */
export interface Action {
  /** The folder the view centers on; absent, the view stays where it is. */
  center?: string
  open: Asked
}

/**
 * What a click on `placement` asks, `shift` held or not; nothing for an empty hex. A name of a
 * list asks what its hex would.
 *
 * - A Branch or a Context folder: the view centers on it and shows its `CLAUDE.md` (or
 *   `-CLAUDE.md`).
 * - The center: the view goes up to the folder holding it and shows that one's note. At the vault
 *   root there is nowhere to go, and it shows its own.
 * - A Markdown Leaf: shown as it is, the view staying where it is. A Leaf that isn't Markdown opens
 *   in the system's default app.
 * - Shift held: the hex's note is shown and the view stays where it is.
 */
export function actionOf(placement: Placement | ListItem, shift: boolean): Action | undefined {
  if (placement.kind === 'empty') return undefined
  const { path } = placement.tile
  if (placement.kind !== 'center' && placement.memberKind === 'leaf') {
    return { open: isMarkdown(basename(path)) ? { notes: [path] } : { file: path } }
  }
  const moveTo = placement.kind === 'center' ? up(path) : path
  if (shift || moveTo === undefined) return { open: { notes: notesOf(path) } }
  return { center: moveTo, open: { notes: notesOf(moveTo) } }
}

/** The notes that present `folder`, in the order the shape looks for them. */
function notesOf(folder: string): string[] {
  return bodySources(folder, 'branch').map(vaultPath)
}

/** The folder holding `folder`, or undefined at the vault root. */
function up(folder: string): string | undefined {
  return folder === '' ? undefined : vaultPath(parent(folder))
}

/**
 * The direction of the outer ring's Branch that `placement` stands for, its hex or, once opened,
 * its Tile inside it; undefined for any other hex. Those are the hexes a view opens on its own:
 * the inner ring holds Leaves and Context, never a Branch, and a Branch's own members open
 * nothing, nor does a name of a list.
 */
export function outerBranchOf(placement: Placement | ListItem): Direction | undefined {
  const isOuterBranch =
    placement.kind === 'member' && placement.memberKind === 'branch' && placement.generation === 1
  return isOuterBranch ? placement.direction : undefined
}
