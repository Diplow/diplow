// The rule of 6 inside the code: every folder under src/ holds at most 6 child folders and 6 files.
// No ESLint plugin counts a folder's children, and a lint rule only sees the folders that hold a linted file.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const budget = 6
const root = 'src'
// CLAUDE.md presents its node and sits outside every budget, as it does across the repo; macOS drops
// .DS_Store files that git ignores.
const outsideBudget = new Set(['CLAUDE.md', '.DS_Store'])
// Generated and ignored by git.
const skipped = new Set([join(root, 'paraglide')])

function overflows(folder: string): string[] {
  const entries = readdirSync(folder, { withFileTypes: true }).filter(
    (entry) => !outsideBudget.has(entry.name) && !skipped.has(join(folder, entry.name)),
  )
  const folders = entries.filter((entry) => entry.isDirectory())
  const files = entries.filter((entry) => !entry.isDirectory())
  const own = [
    ...(folders.length > budget ? [`${folder}/ holds ${String(folders.length)} folders`] : []),
    ...(files.length > budget ? [`${folder}/ holds ${String(files.length)} files`] : []),
  ]
  return [...own, ...folders.flatMap((child) => overflows(join(folder, child.name)))]
}

const problems = overflows(root)
if (problems.length > 0) {
  console.error(
    `Rule of 6: a folder holds at most ${String(budget)} folders and ${String(budget)} files; cut the node rather than work around it.`,
  )
  problems.forEach((problem) => {
    console.error(`  ${problem}`)
  })
  process.exitCode = 1
}
