// A note of a vault folder split into its frontmatter and its Markdown: the format the files are
// written in, which Mapping reads Help's Tiles from (src/domains/mapping/help/). A frontmatter opens
// with a `---` first line and closes with the next one, and holds scalar fields only, which is all the
// vault's notes use, so no YAML library is needed. Pure, and free of `import.meta.glob`, so the
// build's check of Help (scripts/check-help.ts) loads it with the Vite config.

/** A note: the scalar fields of its frontmatter, and its Markdown after it, trimmed. */
export interface Note {
  readonly fields: Readonly<Record<string, string>>
  readonly body: string
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

/** A note's frontmatter and its Markdown, or `undefined` when it opens with no frontmatter. */
export function noteOf(text: string): Note | undefined {
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
