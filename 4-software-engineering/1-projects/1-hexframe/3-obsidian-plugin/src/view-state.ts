// The view state a hexframe file keeps as JSON, what the app keeps in its URL: the folder in the
// middle and how it is expanded. Pure, so it is tested without Obsidian. Paths are relative to the
// vault, `''` being its root.
import { isExcluded } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import type { FrameKind } from '../../2-claude-mod/hooks/shape/node.ts'

/** The Frame kinds the center's outer ring shows. Context goes inside the center's hex. */
export type OuterKind = Exclude<FrameKind, 'context'>

const outerKinds: readonly OuterKind[] = ['children', 'branches', 'leaves']

export interface ViewState {
  /** The folder in the middle; absent, the hexframe file's own folder. */
  center?: string
  expansions: { outer: OuterKind }
}

/** The state an empty hexframe file means. */
export const defaultState: ViewState = { expansions: { outer: 'children' } }

/** A file's view state, and what in the file was ignored for being malformed. */
export interface Decoded {
  state: ViewState
  problems: string[]
}

/**
 * The view state a hexframe file's text holds. An empty file means the defaults; a field that is
 * malformed falls back to its default, and a file that isn't a JSON object to all of them, each
 * with a problem to show. A problem names the field, never repeats the file's text.
 */
export function decodeViewState(text: string): Decoded {
  if (text.trim() === '') return { state: defaultState, problems: [] }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { state: defaultState, problems: ['it is not JSON'] }
  }
  if (!isObject(json)) return { state: defaultState, problems: ['it holds no JSON object'] }

  const problems: string[] = []
  const state: ViewState = { expansions: { outer: outerOf(json['expansions'], problems) } }
  const center = json['center']
  if (typeof center === 'string') state.center = center
  else if (center !== undefined) problems.push('`center` is not a path')
  return { state, problems }
}

function outerOf(expansions: unknown, problems: string[]): OuterKind {
  if (expansions === undefined) return defaultState.expansions.outer
  if (!isObject(expansions)) {
    problems.push('`expansions` is not an object')
    return defaultState.expansions.outer
  }
  const outer = expansions['outer']
  if (outer === undefined) return defaultState.expansions.outer
  const kind = outerKinds.find((candidate) => candidate === outer)
  if (kind === undefined) problems.push(`\`expansions.outer\` is none of ${outerKinds.join(', ')}`)
  return kind ?? defaultState.expansions.outer
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The text a hexframe file holds for `state`. */
export function encodeViewState(state: ViewState): string {
  return `${JSON.stringify({ center: state.center, expansions: state.expansions }, null, 2)}\n`
}

/**
 * The folder a view shows: the state's center, or `home`, the hexframe file's own folder, when the
 * state names none or one that leaves the vault (an absolute path, a `..` past its root) or lands
 * on a name every folder leaves out. `dropped` then says why. A medium still checks the folder on
 * disk, symlinks followed, before showing it.
 */
export function centerOf(state: ViewState, home: string): { folder: string; dropped?: string } {
  if (state.center === undefined) return { folder: home }
  const folded = fold(state.center)
  return 'outside' in folded ? { folder: home, dropped: folded.outside } : { folder: folded.path }
}

/** `path`, relative to the vault, with `.` and `..` folded, or why it leaves the vault. */
function fold(path: string): { path: string } | { outside: string } {
  if (/^(\/|\\|[A-Za-z]:)/.test(path)) return { outside: 'it is an absolute path' }
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part !== '..') parts.push(part)
    else if (parts.pop() === undefined) return { outside: 'it leads out of the vault' }
  }
  const excluded = parts.find((part) => isExcluded(part, true, []))
  if (excluded !== undefined) return { outside: `every folder leaves out ${excluded}` }
  return { path: parts.join('/') }
}

/**
 * The Frame kind the center's outer ring shows, among `offered`: the state's, or else Children,
 * or else Branches. A folder offers Children or Branches, never both: past six Branches and Leaves
 * in all, Children gives way to Branches and Leaves.
 */
export function outerKindOf(state: ViewState, offered: readonly FrameKind[]): OuterKind {
  const kinds: OuterKind[] = [state.expansions.outer, 'children', 'branches']
  return kinds.find((kind) => offered.includes(kind)) ?? 'children'
}

/**
 * The state once the folder at `from` is renamed to `to`: its center follows when it is that
 * folder or lies inside it. The same state, unchanged, otherwise.
 */
export function followRename(state: ViewState, from: string, to: string): ViewState {
  if (state.center === undefined) return state
  const folded = fold(state.center)
  if ('outside' in folded) return state
  const inside = relativeTo(folded.path, from)
  if (inside === undefined) return state
  return { ...state, center: inside === '' ? to : `${to}/${inside}` }
}

/**
 * Whether a change at `path` can change a view centered on `center`, at depth 1: the center
 * itself or a folder holding it, the center's own entries, and what lies in one of them, a
 * member's `CLAUDE.md` among it.
 */
export function touches(path: string, center: string): boolean {
  if (relativeTo(center, path) !== undefined) return true
  const inside = relativeTo(path, center)
  return inside !== undefined && inside.split('/').length <= 2
}

/** `path` relative to `folder`, `''` when it is `folder`, or undefined when it lies outside it. */
function relativeTo(path: string, folder: string): string | undefined {
  if (folder === '') return path
  if (path === folder) return ''
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : undefined
}
