// What a folder leaves out of its Frames: the names its `.hexframe/exclusions.yaml` lists, and the
// ones every folder leaves out. Pure: a medium reads the file and hands its text here.

/** A folder's settings folder. It is always left out, so it never takes a Context slot. */
export const settingsFolder = '.hexframe'

/** The names every folder leaves out, whatever its `exclusions.yaml` says. */
export const builtInExclusions: readonly string[] = ['.git', 'node_modules', settingsFolder]

/** Where a folder lists the names it leaves out, relative to the folder. */
export const exclusionsFile = `${settingsFolder}/exclusions.yaml`

/** The one key of `exclusions.yaml`. */
const key = 'exclude'

/** One name or glob of a folder's exclusions, ready to match the entries of its listing. */
export interface Exclusion {
  /** As written, a trailing `/` included. */
  pattern: string
  /** A pattern written with a trailing `/` leaves out folders only. */
  foldersOnly: boolean
  matches: RegExp
}

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
 * other `/`. Comments and blank lines are skipped. Anything else throws, naming the line.
 */
export function parseExclusions(text: string): Exclusion[] {
  const items: string[] = []
  let opened = false
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line, index) => {
      const where = `line ${index + 1}`
      if (/^\s*(#.*)?$/.test(line)) return
      const listItem = /^\s*-(\s.*)?$/.exec(line)
      if (listItem) {
        if (!opened) throw new Error(`${where}: a list item comes before \`${key}:\``)
        items.push(itemOf(new Cursor(listItem[1] ?? '', where)))
        return
      }
      const field = /^([A-Za-z_][\w-]*):(\s.*)?$/.exec(line)
      if (!field || field[1] !== key) {
        throw new Error(`${where}: the one key is \`${key}:\`, followed by a list`)
      }
      if (opened) throw new Error(`${where}: \`${key}:\` is written twice`)
      opened = true
      items.push(...flowListOf(new Cursor(field[2] ?? '', where)))
    })
  return items.map(exclusionOf)
}

/** Whether `exclusions`, or the built-in ones, leave out the entry `name`, a folder when `isFolder`. */
export function isExcluded(
  name: string,
  isFolder: boolean,
  exclusions: readonly Exclusion[],
): boolean {
  if (builtInExclusions.includes(name)) return true
  return exclusions.some(
    ({ foldersOnly, matches }) => (isFolder || !foldersOnly) && matches.test(name),
  )
}

function exclusionOf(item: string): Exclusion {
  const foldersOnly = item.endsWith('/')
  const name = foldersOnly ? item.slice(0, -1) : item
  if (name === '' || name.includes('/')) {
    throw new Error(`\`${item}\` is no name of this folder: an exclusion holds no other /`)
  }
  return { pattern: item, foldersOnly, matches: globOf(name) }
}

/** `*` for any run of characters and `?` for one; every other character stands for itself. */
function globOf(name: string): RegExp {
  const source = [...name]
    .map((character) => {
      if (character === '*') return '.*'
      if (character === '?') return '.'
      return character.replace(/[\\^$.|+()[\]{}]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${source}$`, 's')
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

  constructor(
    private readonly text: string,
    private readonly where: string,
  ) {}

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
      throw this.error(`\`${this.text.slice(this.index).trim()}\` follows the item`)
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
