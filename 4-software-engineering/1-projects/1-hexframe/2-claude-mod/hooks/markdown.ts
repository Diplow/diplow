// A file as the pane's preview shows it, in the Markdown element Claude Code draws.

/** The most a Markdown element draws. */
const markdownLimit = 10000

const cutNote = '\n\n*The file goes on; open it to read the rest.*'

/** The control characters a Markdown element refuses: all but tab and newline. */
const controls = /[\u0000-\u0008\u000b-\u001f\u007f]/g

/**
 * A Markdown file as a Markdown element draws it: its frontmatter dropped (the Tile shows that),
 * the control characters a Markdown refuses gone, and cut at its limit with a line that says so.
 */
export function markdownOf(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const end = lines[0]?.trim() === '---' ? lines.indexOf('---', 1) : -1
  const markdown = lines
    .slice(end + 1)
    .join('\n')
    .replace(controls, '')
    .trim()
  if (markdown.length <= markdownLimit) return markdown
  return markdown.slice(0, markdownLimit - cutNote.length) + cutNote
}

/**
 * A file that isn't Markdown, as a fenced block the element draws as it is: its fence longer than
 * any run of backticks inside, cut at the limit with a line that says so. Empty for an empty file.
 */
export function codeOf(text: string): string {
  const clean = text.replace(/\r\n?/g, '\n').replace(controls, '').trimEnd()
  if (clean.trim() === '') return ''
  const head = clean.slice(0, markdownLimit)
  const longest = (head.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 2)
  const fence = '`'.repeat(longest + 1)
  const room = markdownLimit - 2 * fence.length - 2 - cutNote.length
  if (clean.length <= room) return `${fence}\n${clean}\n${fence}`
  return `${fence}\n${clean.slice(0, room)}\n${fence}${cutNote}`
}
