// A body file as the pane's preview shows it, in the Markdown element Claude Code draws.

/** The most a Markdown element draws. */
const markdownLimit = 10000

/**
 * A body file as a Markdown element draws it: its frontmatter dropped (the Tile shows that), the
 * control characters a Markdown refuses gone, and cut at its limit with a line that says so.
 */
export function markdownOf(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const end = lines[0]?.trim() === '---' ? lines.indexOf('---', 1) : -1
  const markdown = lines
    .slice(end + 1)
    .join('\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
  if (markdown.length <= markdownLimit) return markdown
  const cut = '\n\n*The file goes on; open it to read the rest.*'
  return markdown.slice(0, markdownLimit - cut.length) + cut
}
