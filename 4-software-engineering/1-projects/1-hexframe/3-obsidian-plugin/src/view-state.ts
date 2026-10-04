// The view state a hexframe file keeps as JSON, what the app keeps in its URL: the folder in the
// middle and how it is expanded. Pure, so it is tested without Obsidian. Paths are relative to the
// vault, `''` being its root.
import { isExcluded } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import { directions, frameKinds } from '../../2-claude-mod/hooks/shape/node.ts'
import {
  centerExpansion,
  defaultExpansions,
  around,
  beside,
  innerKinds,
  outerKinds,
  sameExpansions,
  type CenterExpansion,
  type Expansions,
  type InnerKind,
} from './expansions.ts'

export interface ViewState {
  /** The folder in the middle; absent, the hexframe file's own folder. */
  center?: string
  expansions: Expansions
}

/** The state an empty hexframe file means. */
export const defaultState: ViewState = { expansions: defaultExpansions }

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
  const state: ViewState = { expansions: expansionsOf(json['expansions'], problems) }
  const center = json['center']
  if (typeof center === 'string') state.center = center
  else if (center !== undefined) problems.push('`center` is not a path')
  return { state, problems }
}

/**
 * The expansions a file's `expansions` field holds. A missing kind takes its default: Context
 * inside, and around it Branches beside Leaves, Children beside Context, nothing beside nothing. A
 * kind that is `null` is peeled. A pair a view can't show keeps the outer kind, Context inside.
 */
function expansionsOf(expansions: unknown, problems: string[]): Expansions {
  if (expansions === undefined) return defaultExpansions
  if (!isObject(expansions)) {
    problems.push('`expansions` is not an object')
    return defaultExpansions
  }
  const innerRead = kindOf(expansions, 'inner', innerKinds, problems)
  const inner = innerRead === undefined ? defaultExpansions.inner : innerRead
  const outer = kindOf(expansions, 'outer', outerKinds, problems)
  const branches = branchesOf(expansions['branches'], problems)
  if (outer === undefined) return { ...centerAround(inner), branches }
  if (outer === null) return { outer, inner, branches }
  const center = centerExpansion(outer, inner)
  if (center !== undefined) return { ...center, branches }
  problems.push(`\`expansions.inner\` can't be ${String(inner)} beside ${outer}`)
  return { ...beside(outer), branches }
}

/**
 * The center a file that names no outer kind means: the outer ring that opens around `inner`,
 * Children beside Context until a folder says it has more than six, or none around none.
 */
function centerAround(inner: InnerKind | null): CenterExpansion {
  return inner === null ? { outer: null, inner } : around(inner, frameKinds)
}

/**
 * `field` of `expansions` when it is one of `kinds` or `null`; undefined when it is missing, or
 * malformed, with a problem then.
 */
function kindOf<K extends string>(
  expansions: Record<string, unknown>,
  field: string,
  kinds: readonly K[],
  problems: string[],
): K | null | undefined {
  const value = expansions[field]
  if (value === undefined || value === null) return value
  const kind = kinds.find((candidate) => candidate === value)
  if (kind === undefined) problems.push(`\`expansions.${field}\` is none of ${kinds.join(', ')}`)
  return kind
}

/** The kind each Branch of the outer ring opens into, by direction; a malformed one stays closed. */
function branchesOf(value: unknown, problems: string[]): Expansions['branches'] {
  if (value === undefined) return {}
  if (!isObject(value)) {
    problems.push('`expansions.branches` is not an object')
    return {}
  }
  const branches: Expansions['branches'] = {}
  for (const [key, kind] of Object.entries(value)) {
    const direction = directions.find((candidate) => String(candidate) === key)
    const found = frameKinds.find((candidate) => candidate === kind)
    if (direction !== undefined && found !== undefined) branches[direction] = found
    else problems.push(`\`expansions.branches\` holds a direction or a kind it can't read`)
  }
  return branches
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The text a hexframe file holds for `state`. */
export function encodeViewState(state: ViewState): string {
  return `${JSON.stringify({ center: state.center, expansions: jsonOf(state.expansions) }, null, 2)}\n`
}

/** The expansions as the file writes them: no `branches` when none is opened. */
function jsonOf({ outer, inner, branches }: Expansions) {
  return Object.keys(branches).length === 0 ? { outer, inner } : { outer, inner, branches }
}

/**
 * `text`, a hexframe file's, with each field where `next` differs from `state` set to `next`'s,
 * and everything else in it kept as written, a field the view doesn't know or couldn't read
 * included. A file that holds no JSON object is written whole from `next`.
 */
export function withChanges(text: string, state: ViewState, next: ViewState): string {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return encodeViewState(next)
  }
  if (!isObject(json)) return encodeViewState(next)
  const expansions = jsonOf(next.expansions)
  const changed = {
    ...(next.center !== state.center && { center: next.center }),
    ...(!sameExpansions(next.expansions, state.expansions) && { expansions }),
  }
  return `${JSON.stringify({ ...json, ...changed }, null, 2)}\n`
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
 * Whether a change at `path` can change a view that read `folders` as Frames, the center and the
 * Branches it opens: one of them or a folder holding it, their own entries, and what lies in one
 * of those, a member's `CLAUDE.md` among it.
 */
export function touches(path: string, folders: readonly string[]): boolean {
  return folders.some((folder) => {
    if (relativeTo(folder, path) !== undefined) return true
    const inside = relativeTo(path, folder)
    return inside !== undefined && inside.split('/').length <= 2
  })
}

/** `path` relative to `folder`, `''` when it is `folder`, or undefined when it lies outside it. */
function relativeTo(path: string, folder: string): string | undefined {
  if (folder === '') return path
  if (path === folder) return ''
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : undefined
}
