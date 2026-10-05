// A vault folder read as a System's rows, in the shape a System exports to: a folder per Tile,
// `<n>-<slug>/` for a Child in Direction n and `.<n>-<slug>/` for a Tile of its Context in slot -n,
// each with a `CLAUDE.md` whose frontmatter holds the Tile's Title and Preview and whose rest is its
// Body. Pure: the files come in as text, from whoever read or bundled them, and what keeps a folder
// from reading as a Tile comes out as a problem, named.
import type { TileRow } from '#/repositories/database/tiles/tiles'

import { fitsPreview } from '../tile'

/** What every Tile's frontmatter holds, as every note of the vault's does. */
const required = ['title', 'parent', 'owner', 'preview'] as const

/** A folder's name, `3-children` or `.1-six-at-most`: a Child's Direction, or a Context slot. */
const folderName = /^(\.?)([1-6])-[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The slot a folder's name stands in, `undefined` for a name that stands in none. */
function slotOf(name: string): number | undefined {
  const match = folderName.exec(name)
  if (match === null) return undefined
  const direction = Number(match[2])
  return match[1] === '.' ? -direction : direction
}

function unquoted(value: string): string {
  const quote = value.at(0)
  if (value.length < 2 || (quote !== '"' && quote !== "'") || !value.endsWith(quote)) return value
  return quote === '"'
    ? value.slice(1, -1).replace(/\\"/g, '"')
    : value.slice(1, -1).replace(/''/g, "'")
}

/**
 * The scalar fields of a frontmatter's lines: `key: value`, quoted or not, and the block scalars `>`
 * (folded) and `|` (literal), which is all the vault's frontmatters use.
 */
function fieldsOf(lines: ReadonlyArray<string>): Record<string, string> {
  const fields: Record<string, string> = {}
  let index = 0
  while (index < lines.length) {
    // One `.*` after the colon, trimmed after: `\s*.*` would backtrack in time quadratic in the line.
    const match = /^([A-Za-z_][\w-]*):(.*)$/.exec(lines[index] ?? '')
    index += 1
    if (match === null) continue
    const [, key = '', raw = ''] = match
    const value = raw.trim()
    if (!/^[>|][+-]?$/.test(value)) {
      fields[key] = unquoted(value)
      continue
    }
    const block: string[] = []
    while (index < lines.length && /^(\s|$)/.test(lines[index] ?? '')) {
      block.push((lines[index] ?? '').trim())
      index += 1
    }
    fields[key] = (value.startsWith('>') ? block.join(' ') : block.join('\n')).trim()
  }
  return fields
}

/**
 * A note's frontmatter fields and its Body, or `undefined` when it opens with no frontmatter: a `---`
 * first line, closed by the next one.
 */
export function noteOf(text: string): { fields: Record<string, string>; body: string } | undefined {
  const lines = text.split(/\r\n?|\n/)
  const isFence = (line: string | undefined) => line?.trim() === '---'
  const end = lines.findIndex((line, index) => index > 0 && isFence(line))
  if (!isFence(lines[0]) || end === -1) return undefined
  return {
    fields: fieldsOf(lines.slice(1, end)),
    body: lines
      .slice(end + 1)
      .join('\n')
      .trim(),
  }
}

/** The content of a folder's note, or what keeps it from being a Tile's. */
function contentOf(text: string | undefined): Pick<TileRow, 'title' | 'preview' | 'body'> | string {
  if (text === undefined) return 'no CLAUDE.md'
  const note = noteOf(text)
  if (note === undefined) return 'its CLAUDE.md opens with no frontmatter'
  const missing = required.filter((field) => (note.fields[field] ?? '').trim() === '')
  if (missing.length > 0) return `its frontmatter has no ${missing.join(', ')}`
  const { title = '', preview = '' } = note.fields
  if (!fitsPreview(preview)) return 'its Preview is over 350 characters'
  return { title, preview, body: note.body }
}

/** A vault folder read: the rows of its Tiles, and what kept any of its folders from being one. */
export interface Vault {
  readonly rows: ReadonlyArray<TileRow>
  readonly problems: ReadonlyArray<string>
}

/** The row of the Tile a folder's note makes, by the folder's path, or what keeps it from being one. */
function rowOf(root: string, path: string, text: string | undefined): TileRow | string {
  const slots = path === '' ? [] : path.split('/').map(slotOf)
  if (!slots.every((slot) => slot !== undefined)) {
    return 'a folder is named <n>-<slug> for a Child, .<n>-<slug> for Context'
  }
  const content = contentOf(text)
  if (typeof content === 'string') return content
  const parentId = slots.length === 0 ? null : [root, ...slots.slice(0, -1)].join('/')
  const id = [root, ...slots].join('/')
  return { id, parentId, direction: slots.at(-1) ?? null, target: null, ...content }
}

/**
 * The Tiles of a vault folder whose Root has the id `root`, from the `CLAUDE.md` of each of its
 * folders, keyed by the folder's path from the vault folder (`''` for the Root itself,
 * `3-children/.1-six-at-most` below it), `undefined` for a folder that has none. A Tile's id is the
 * path of slots from the Root: `root`, `root/3`, `root/3/-1`.
 */
export function vaultOf(root: string, notes: Readonly<Record<string, string | undefined>>): Vault {
  const rows = new Map<string, TileRow>()
  const problems: string[] = []
  const refuse = (path: string, why: string) => problems.push(`${path || '.'}: ${why}`)
  for (const path of Object.keys(notes).sort()) {
    const row = rowOf(root, path, notes[path])
    if (typeof row === 'string') refuse(path, row)
    else if (rows.has(row.id)) refuse(path, 'another folder already stands in its slot')
    else rows.set(row.id, row)
  }
  if (!rows.has(root)) refuse('', 'the Root reads as no Tile')
  const orphans = [...rows.values()].filter(
    ({ parentId }) => parentId !== null && !rows.has(parentId),
  )
  for (const { id } of orphans) problems.push(`${id}: the folder above it reads as no Tile`)
  return { rows: [...rows.values()], problems }
}
