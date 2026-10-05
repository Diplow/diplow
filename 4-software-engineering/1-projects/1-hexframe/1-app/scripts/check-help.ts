// What `build` checks before it bundles Help (src/domains/mapping/help/): every folder under the app's
// `help/` reads as a Tile, its `CLAUDE.md` opening with its frontmatter, its Preview within 350
// characters, its name a slot. The server reads Help from the bundle alone, so a folder that reads as
// no Tile would go missing without a word; this fails the build instead, and `dev` with it.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import type { Plugin } from 'vite'

import { vaultOf } from '../src/domains/mapping/help/vault'

/** What keeps each folder under `folder` from reading as a Tile, by its path from `folder`. */
export function problemsIn(folder: string): ReadonlyArray<string> {
  const below = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
  const notes = Object.fromEntries(
    ['', ...below].map((path) => {
      const file = join(folder, path, 'CLAUDE.md')
      return [path, existsSync(file) ? readFileSync(file, 'utf8') : undefined]
    }),
  )
  return vaultOf('help', notes).problems
}

/** Fails the build, and `dev`, while a folder of Help reads as no Tile. */
export function helpChecked(folder = 'help'): Plugin {
  return {
    name: 'hexframe:help-checked',
    buildStart() {
      const problems = problemsIn(folder)
      if (problems.length === 0) return
      this.error(
        `Help has folders that read as no Tile:\n${problems.map((line) => `  ${folder}/${line}`).join('\n')}`,
      )
    },
  }
}
