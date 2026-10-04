// The paired pane taking the view along: a folder's note opened there moves the view onto that
// folder, so the note being read and the hexframe beside it don't drift apart. Pure, so the filter
// is tested without Obsidian; the view listens for the opens and carries the move out.
import { basename, bodyFiles, parent } from '../../2-claude-mod/hooks/shape/node.ts'
import { vaultPath } from './vault/frame.ts'

/** A file Obsidian opened, as the view sees it. */
export interface Opened {
  /** Relative to the vault. */
  path: string
  /** Whether it opened in the paired pane, the one the view's clicks show notes in. */
  inPaired: boolean
}

/**
 * The folder the view moves onto once `opened` opens, or undefined when it stays where it is:
 *
 * - only an open in the paired pane moves it, never one in another pane;
 * - only a folder's note, its `CLAUDE.md` or `-CLAUDE.md`, any other file leaving it be;
 * - not the note the view itself last showed there, `shown`, which its click already centered on,
 *   or chose not to, shift held, so the view never follows itself;
 * - not the note of `center`, the folder it is already on, so nothing is written for nothing.
 */
export function followed(
  opened: Opened,
  shown: string | undefined,
  center: string,
): string | undefined {
  if (!opened.inPaired || opened.path === shown) return undefined
  const folder = folderOf(opened.path)
  return folder === center ? undefined : folder
}

/** The folder `path` is the note of, relative to the vault, `''` its root; undefined for any other file. */
function folderOf(path: string): string | undefined {
  const isNote = (bodyFiles as readonly string[]).includes(basename(path))
  return isNote ? vaultPath(parent(path)) : undefined
}
