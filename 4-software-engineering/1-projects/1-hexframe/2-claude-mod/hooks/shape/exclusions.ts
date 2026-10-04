// What a folder leaves out of its Frames: the names its `.hexframe/exclusions.yaml` lists, and the
// ones every folder leaves out. Pure: a medium reads the file and hands its text here.
import { linesOf, type FileRead, type Slot } from './node.js'

/** A folder's settings folder. It is always left out, so it never takes a Context slot. */
export const settingsFolder = '.hexframe'

/** The names every folder leaves out, whatever its `exclusions.yaml` says. */
const builtInExclusions: readonly string[] = ['.git', 'node_modules', settingsFolder]

/** Where a folder lists the names it leaves out, relative to the folder. */
export const exclusionsFile = `${settingsFolder}/exclusions.yaml`

/** The one key of `exclusions.yaml`. */
const key = 'exclude'

/**
 * The exclusions an `exclusions.yaml` lists, under its one key, as a block list or a flow list:
 *
 * ```yaml
 * exclude:
 *   - dist/
 *   - "*.log"
 * ```
 *
 * Each item is a name of the folder or a glob, where `*` stands for any run of characters and `?`
 * for one; a trailing `/` keeps it to folders. An item applies to that folder only, so it holds no
 * other `/`. Comments and blank lines are skipped. Anything else throws, naming the line but not
 * repeating its text.
 */
export function parseExclusions(text: string): string[] {
  const items: string[] = []
  let opened = false
  linesOf(text).forEach((line, index) => {
    const where = `line ${index + 1}`
    if (/^\s*(#.*)?$/.test(line)) return
    const listItem = /^\s*-(\s.*)?$/.exec(line)
    if (listItem) {
      if (!opened) throw new Error(`${where}: a list item comes before \`${key}:\``)
      items.push(checked(itemOf(new Cursor(listItem[1] ?? '', where)), where))
      return
    }
    const field = /^([A-Za-z_][\w-]*):(\s.*)?$/.exec(line)
    if (!field || field[1] !== key) {
      throw new Error(`${where}: the one key is \`${key}:\`, followed by a list`)
    }
    if (opened) throw new Error(`${where}: \`${key}:\` is written twice`)
    opened = true
    items.push(...flowListOf(new Cursor(field[2] ?? '', where)).map((item) => checked(item, where)))
  })
  return items
}

/**
 * A folder's exclusions from what a medium got of its `exclusions.yaml`: none when it has none, and
 * none, with a warning for the medium to show, when the file was left unread or can't be parsed. A
 * broken file never hides the folder.
 */
export function exclusionsFrom(read: FileRead | undefined): {
  exclusions: string[]
  warning?: string
} {
  if (read === undefined) return { exclusions: [] }
  if ('unread' in read) return nothingLeftOut(read.unread)
  try {
    return { exclusions: parseExclusions(read.text) }
  } catch (error) {
    return nothingLeftOut(error instanceof Error ? error.message : String(error))
  }
}

function nothingLeftOut(reason: string): { exclusions: string[]; warning: string } {
  return {
    exclusions: [],
    warning: `Can't read ${exclusionsFile}, so nothing is left out: ${reason}`,
  }
}

/** Whether `exclusions`, or the built-in ones, leave out the entry `name`, a folder when `isFolder`. */
export function isExcluded(
  name: string,
  isFolder: boolean,
  exclusions: readonly string[],
): boolean {
  if (builtInExclusions.includes(name)) return true
  return exclusions.some((exclusion) => {
    const foldersOnly = exclusion.endsWith('/')
    return (
      (isFolder || !foldersOnly) &&
      globMatches(foldersOnly ? exclusion.slice(0, -1) : exclusion, name)
    )
  })
}

/** The exclusion that names exactly this candidate: its name, a folder's with a trailing `/`. */
export function patternOf({ kind, name }: Slot): string {
  return kind === 'leaf' ? name : `${name}/`
}

/** An item names an entry of this folder: no `/` but a trailing one. */
function checked(item: string, where: string): string {
  if (item === '/' || item.slice(0, -1).includes('/')) {
    throw new Error(`${where}: an exclusion names an entry of this folder, so it holds no other /`)
  }
  return item
}

/** Whether `item` is a glob, holding `*` or `?`, which match more than the item as written. */
export function isGlob(item: string): boolean {
  return /[*?]/.test(item)
}

/**
 * Whether the glob matches the whole name: `*` any run of characters, `?` one, every other
 * character itself. Walks both once, going back only to the last `*`, so no glob takes longer than
 * the name times the glob, whatever its stars.
 */
function globMatches(glob: string, name: string): boolean {
  const pattern = [...glob]
  const text = [...name]
  let at = 0
  let next = 0
  let star = -1
  let resume = 0
  while (at < text.length) {
    if (pattern[next] === '*') {
      star = next++
      resume = at
    } else if (next < pattern.length && (pattern[next] === '?' || pattern[next] === text[at])) {
      at++
      next++
    } else if (star !== -1) {
      next = star + 1
      at = ++resume
    } else {
      return false
    }
  }
  while (pattern[next] === '*') next++
  return next === pattern.length
}

/** One list item: a scalar, then nothing but a comment. */
function itemOf(cursor: Cursor): string {
  const item = cursor.scalar(/\s#/)
  cursor.end()
  return item
}

/** What follows `exclude:`: nothing when a block list comes next, or a flow list, `[a, "b*"]`. */
function flowListOf(cursor: Cursor): string[] {
  cursor.skipSpaces()
  if (cursor.atEnd() || cursor.take('#')) return []
  if (!cursor.take('[')) {
    throw cursor.error(`\`${key}:\` takes a list, as \`[a, b]\` or one \`- a\` per line`)
  }
  const items: string[] = []
  cursor.skipSpaces()
  if (!cursor.take(']')) {
    do {
      items.push(cursor.scalar(/[,\]]/))
    } while (cursor.take(','))
    if (!cursor.take(']')) throw cursor.error('the list is left open')
  }
  cursor.end()
  return items
}

/** Reads one line's value, left to right. */
class Cursor {
  private index = 0
  private readonly text: string
  private readonly where: string

  constructor(text: string, where: string) {
    this.text = text
    this.where = where
  }

  /** A quoted scalar, or a plain one that runs until `stop` or the end, trimmed. */
  scalar(stop: RegExp): string {
    this.skipSpaces()
    const quote = this.text[this.index]
    let value: string
    if (quote === '"' || quote === "'") {
      value = this.quoted(quote)
    } else if (quote === '#') {
      value = ''
    } else {
      const rest = this.text.slice(this.index)
      const cut = rest.search(stop)
      const raw = cut === -1 ? rest : rest.slice(0, cut)
      this.index += raw.length
      value = raw.trim()
    }
    if (value === '') throw this.error('an item is empty')
    this.skipSpaces()
    return value
  }

  /** The line has nothing left but spaces and a comment. */
  end() {
    this.skipSpaces()
    if (!this.atEnd() && this.text[this.index] !== '#') {
      throw this.error('something follows the item')
    }
  }

  take(character: string): boolean {
    this.skipSpaces()
    if (this.text[this.index] !== character) return false
    this.index++
    return true
  }

  skipSpaces() {
    while (this.index < this.text.length && /\s/.test(this.text[this.index] ?? '')) this.index++
  }

  atEnd(): boolean {
    return this.index >= this.text.length
  }

  error(message: string): Error {
    return new Error(`${this.where}: ${message}`)
  }

  /** `"…"` with `\"` and `\\` escapes, or `'…'` with `''` for a quote. */
  private quoted(quote: string): string {
    let value = ''
    for (this.index++; this.index < this.text.length; this.index++) {
      const character = this.text[this.index]
      if (quote === '"' && character === '\\' && this.index + 1 < this.text.length) {
        value += this.text[++this.index]
      } else if (character !== quote) {
        value += character
      } else if (quote === "'" && this.text[this.index + 1] === "'") {
        value += "'"
        this.index++
      } else {
        this.index++
        return value
      }
    }
    throw this.error('a quote is left open')
  }
}
