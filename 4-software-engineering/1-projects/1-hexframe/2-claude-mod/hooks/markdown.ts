// A file as the pane's preview shows it, in the Markdown element Claude Code draws.
import { isMarkdown } from './shape/node.js'

/** The most a Markdown element draws. */
const markdownLimit = 10000

const cutNote = '\n\n*The file goes on; open it to read the rest.*'

/** The control characters a Markdown element refuses, C0 and C1: all but tab and newline. */
const controls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g

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
 * any run of backticks it shows, cut at the limit with a line that says so. Empty for an empty file.
 */
export function codeOf(text: string): string {
  const clean = text.replace(/\r\n?/g, '\n').replace(controls, '').trimEnd()
  if (clean.trim() === '') return ''
  // A longer fence leaves less room, which can only shorten the runs the shown part holds.
  let fence = 3
  let shown = clean
  for (;;) {
    const room = Math.max(0, markdownLimit - 2 * fence - 2 - cutNote.length)
    shown = clean.slice(0, room)
    const needed = longestRun(shown) + 1
    if (needed <= fence) break
    fence = needed
  }
  const bar = '`'.repeat(Math.max(3, longestRun(shown) + 1))
  return `${bar}\n${shown}\n${bar}${shown.length < clean.length ? cutNote : ''}`
}

function longestRun(text: string): number {
  return (text.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 0)
}

/** Whether a file read as text is text: a NUL among its first bytes says it is binary. */
export function isText(text: string): boolean {
  return !text.slice(0, 8000).includes('\u0000')
}

/**
 * What the preview shows of a Leaf read as `text`: Markdown rendered, any other text as a fence, or
 * a note when it is not text or has nothing to show.
 */
export function leafPreview(name: string, text: string): { markdown: string } | { note: string } {
  if (!isText(text)) return { note: `${name} is not a text file.` }
  const markdown = isMarkdown(name) ? markdownOf(text) : codeOf(text)
  if (markdown !== '') return { markdown }
  return { note: isMarkdown(name) ? `${name} holds only its frontmatter.` : `${name} is empty.` }
}
