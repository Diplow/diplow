// What a click on a hex of the view does: where the view moves, and what it opens beside it. Pure,
// so the click rules are tested without Obsidian; the view carries the action out.
import type { Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import { bodySources, parent } from '../../2-claude-mod/hooks/shape/node.ts'
import { vaultPath } from './vault/frame.ts'

/**
 * What the view opens: the first of `notes` that exists, in the paired pane, or a `file` in the
 * system's default app.
 */
type Opened = { notes: string[] } | { file: string }

/** What a click asks of the view. Paths are relative to the vault, `''` being its root. */
export interface Action {
  /** The folder the view centers on; absent, the view stays where it is. */
  center?: string
  open: Opened
}

/**
 * What a click on `placement` asks, `shift` held or not; nothing for an empty hex.
 *
 * - A Branch or a Context folder: the view centers on it and shows its `CLAUDE.md` (or
 *   `-CLAUDE.md`).
 * - The center: the view goes up to the folder holding it and shows that one's note. At the vault
 *   root there is nowhere to go, and it shows its own.
 * - A Markdown Leaf: shown as it is, the view staying where it is. A Leaf that isn't Markdown opens
 *   in the system's default app.
 * - Shift held: the hex's note is shown and the view stays where it is.
 */
export function actionOf(placement: Placement, shift: boolean): Action | undefined {
  if (placement.kind === 'empty') return undefined
  const { path } = placement.tile
  if (placement.kind === 'member' && placement.memberKind === 'leaf') {
    const notes = bodySources(path, 'leaf')
    return { open: notes.length === 0 ? { file: path } : { notes } }
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
