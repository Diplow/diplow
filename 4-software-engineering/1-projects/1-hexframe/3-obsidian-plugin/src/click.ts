// What a click on a hex of the view does: where the view moves, and what it opens beside it. Pure,
// so the click rules are tested without Obsidian; the view carries the action out.
import type { Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import { basename, bodySources, parent } from '../../2-claude-mod/hooks/shape/node.ts'
import { vaultPath } from './vault/frame.ts'

/**
 * What the view opens: the first of `notes` that exists, in the paired pane, or a `file` in the
 * system's default app; or nothing, for a file it `refused` to hand over, saying `why`.
 */
type Opened = { notes: string[] } | { file: string } | { refused: string; why: string }

/**
 * The extensions of files a system runs, or follows to another path, rather than opens: programs,
 * scripts, installers and shortcuts, on Windows, macOS and Linux. A click never hands one over, so
 * a shared vault can't make a click run something or open what lies beyond the vault.
 */
const launchers = new Set([
  ...['exe', 'com', 'bat', 'cmd', 'msi', 'msp', 'scr', 'pif', 'cpl', 'reg', 'hta'],
  ...['ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'lnk', 'url', 'appref-ms'],
  ...['app', 'command', 'tool', 'terminal', 'workflow', 'scpt', 'applescript', 'pkg', 'mpkg'],
  ...['webloc', 'inetloc', 'fileloc', 'desktop', 'sh', 'run', 'appimage', 'jar'],
])

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
 *   in the system's default app, unless the system would run it.
 * - Shift held: the hex's note is shown and the view stays where it is.
 */
export function actionOf(placement: Placement, shift: boolean): Action | undefined {
  if (placement.kind === 'empty') return undefined
  const { path } = placement.tile
  if (placement.kind === 'member' && placement.memberKind === 'leaf') {
    const notes = bodySources(path, 'leaf')
    if (notes.length > 0) return { open: { notes } }
    if (launches(path)) return { open: { refused: path, why: 'the system would run it' } }
    return { open: { file: path } }
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

/** Whether the system runs the file at `path`, or follows it elsewhere, rather than opening it. */
function launches(path: string): boolean {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 && launchers.has(name.slice(dot + 1).toLowerCase())
}
