// Reads a folder as a hexframe node, from what a directory listing and its CLAUDE.md say. Pure:
// each medium does the file system calls and hands the results here.

export type Direction = 1 | 2 | 3 | 4 | 5 | 6

export const directions: readonly Direction[] = [1, 2, 3, 4, 5, 6]

export interface Entry {
  name: string
  kind: 'file' | 'dir' | 'other'
}

export interface Tile {
  path: string
  title: string
  preview: string
}

/** A folder seen as a hexframe: its Tile, its Children (1 to 6) and its Context (-1 to -6). */
export interface Frame {
  tile: Tile
  children: Partial<Record<Direction, Tile>>
  context: Partial<Record<Direction, Tile>>
  /** Folders that found no free slot, so the reader knows the node overflows. */
  overflow: string[]
}

/** The file that presents a node; a private one (`-CLAUDE.md`) when the plain one is missing. */
export const bodyFiles = ['CLAUDE.md', '-CLAUDE.md'] as const

/** Folders that hold tooling, never a node's meaning. */
const ignored = new Set(['.git', 'node_modules', '.DS_Store'])

const child = /^([1-6])-(.+)$/
const numberedContext = /^\.([1-6])-(.+)$/

/**
 * Sorts a node's folders into its two rings. `<n>-<slug>/` is the Child in direction n and
 * `.<n>-<slug>/` the Context tile in direction n, as hexframe exports a System. An unnumbered
 * folder takes a free slot of its ring in name order: a dot folder (`.claude/`, `.skills/`) the
 * Context's, as the vault keeps its meta, any other the Children's.
 */
export function sortFolders(entries: readonly Entry[]): {
  children: Partial<Record<Direction, string>>
  context: Partial<Record<Direction, string>>
  overflow: string[]
} {
  const folders = entries
    .filter((entry) => entry.kind === 'dir' && !ignored.has(entry.name))
    .map((entry) => entry.name)
    .sort()
  const children: Partial<Record<Direction, string>> = {}
  const context: Partial<Record<Direction, string>> = {}
  const overflow: string[] = []
  const unnumberedChildren: string[] = []
  const unnumberedContext: string[] = []
  for (const name of folders) {
    const asChild = child.exec(name)
    const asContext = numberedContext.exec(name)
    if (asChild) place(children, Number(asChild[1]) as Direction, name, overflow)
    else if (asContext) place(context, Number(asContext[1]) as Direction, name, overflow)
    else if (name.startsWith('.')) unnumberedContext.push(name)
    else unnumberedChildren.push(name)
  }
  fill(children, unnumberedChildren, overflow)
  fill(context, unnumberedContext, overflow)
  return { children, context, overflow }
}

/** Seats each name in the ring's first free direction; with none left, it overflows. */
function fill(
  ring: Partial<Record<Direction, string>>,
  names: readonly string[],
  overflow: string[],
) {
  for (const name of names) {
    const free = directions.find((direction) => ring[direction] === undefined)
    if (free === undefined) overflow.push(name)
    else ring[free] = name
  }
}

function place(
  ring: Partial<Record<Direction, string>>,
  direction: Direction,
  name: string,
  overflow: string[],
) {
  if (ring[direction] === undefined) ring[direction] = name
  else overflow.push(name)
}

/** The Tile a folder shows: its frontmatter's title and preview, or a title made from its name. */
export function tileOf(path: string, body: string | undefined): Tile {
  const fields = body === undefined ? {} : frontmatter(body)
  return {
    path,
    title: fields.title ?? titleFromName(basename(path)),
    preview: fields.preview ?? '',
  }
}

/** `4-software-engineering` and `.4-software-engineering` read `Software engineering`; `.claude` stays. */
export function titleFromName(name: string): string {
  if (name.startsWith('.') && !numberedContext.test(name)) return name
  const slug = name.replace(/^\.?([1-6]-)?/, '').replace(/[-_]+/g, ' ')
  return slug === '' ? name : slug.charAt(0).toUpperCase() + slug.slice(1)
}

/**
 * The scalar fields of a YAML frontmatter: `key: value`, quoted or not, and the block scalars
 * `>` (folded) and `|` (literal), which is all the vault's frontmatters use.
 */
export function frontmatter(text: string): Record<string, string> {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') return {}
  const end = lines.indexOf('---', 1)
  const block = lines.slice(1, end === -1 ? lines.length : end)
  const fields: Record<string, string> = {}
  for (let index = 0; index < block.length; index++) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(block[index] ?? '')
    if (!match) continue
    const [, key = '', raw = ''] = match
    if (/^[>|][+-]?$/.test(raw)) {
      const continued: string[] = []
      while (index + 1 < block.length && /^(\s|$)/.test(block[index + 1] ?? '')) {
        index++
        continued.push((block[index] ?? '').trim())
      }
      fields[key] = (raw.startsWith('>') ? continued.join(' ') : continued.join('\n')).trim()
    } else {
      fields[key] = unquote(raw.trim())
    }
  }
  return fields
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"')
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

export function join(directory: string, name: string): string {
  return directory.endsWith('/') ? directory + name : `${directory}/${name}`
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1) || '/'
}

/** The folder holding `path`, or `path` itself at the root. */
export function parent(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** `path` as written, resolved against `cwd` when relative; `.` and `..` folded. */
export function resolvePath(cwd: string, path: string): string {
  const absolute = path.startsWith('/') ? path : join(cwd, path)
  const parts: string[] = []
  for (const part of absolute.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return '/' + parts.join('/')
}
