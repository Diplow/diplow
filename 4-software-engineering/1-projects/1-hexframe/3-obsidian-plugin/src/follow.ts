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

/** What an open asks of the view. */
export interface Follow {
  /** The folder the view moves onto; absent, it stays where it is. */
  folder?: string
  /**
   * The note of the paired pane the view has dealt with last, which it skips when it opens again:
   * one it showed there itself, or one it followed, or refused to.
   */
  lastPairedNote: string | undefined
}

/**
 * What `opened` asks of the view, `lastPairedNote` the note of the paired pane it dealt with last
 * and `center` the folder it is on:
 *
 * - only an open in the paired pane moves it, never one in another pane;
 * - only a folder's note, its `CLAUDE.md` or `-CLAUDE.md`, any other file leaving it be;
 * - not `lastPairedNote` opening again, as when the user comes back to the pane: the view showed
 *   it there itself, its click having already centered or chosen not to, shift held, or it already
 *   followed it, or refused to, so the view never follows itself and says a refusal once;
 * - not the note of `center`, so nothing is written for nothing.
 *
 * Any other open in the paired pane is the last one the view dealt with from then on, so going back
 * to an older note, by the back button, follows it again.
 */
export function followed(
  opened: Opened,
  lastPairedNote: string | undefined,
  center: string,
): Follow {
  if (!opened.inPaired || opened.path === lastPairedNote) return { lastPairedNote }
  const folder = folderOf(opened.path)
  return folder === undefined || folder === center
    ? { lastPairedNote: opened.path }
    : { folder, lastPairedNote: opened.path }
}

/** The folder `path` is the note of, relative to the vault, `''` its root; undefined for any other file. */
function folderOf(path: string): string | undefined {
  const isNote = (bodyFiles as readonly string[]).includes(basename(path))
  return isNote ? vaultPath(parent(path)) : undefined
}
