// What `build` checks before it bundles Help (src/domains/mapping/help/): every folder under the app's
// `help/` reads as a Tile in every language Help is written in, its `CLAUDE.md` and its French twin
// `CLAUDE.fr.md` each opening with its frontmatter, every field there, its Preview within 350
// characters, its name a slot. The server reads Help from the bundle alone, so a folder that reads as
// no Tile, or a note left untranslated, would go missing without a word; this fails the build
// instead, and `dev` when it starts.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import type { Plugin } from 'vite'

import { vaultOf } from '../src/domains/mapping/help/vault'
import { noteFiles } from '../src/repositories/help/note'

/**
 * What keeps each folder under `folder` from reading as a Tile, in any language, by its path from
 * `folder`: English first, then each other language, a problem about a note naming its file. A
 * problem every language shares, a folder's name that is no slot, is told once.
 */
export function problemsIn(folder: string): ReadonlyArray<string> {
  const below = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
  const problems = Object.values(noteFiles).flatMap((name) => {
    const notes = Object.fromEntries(
      ['', ...below].map((path) => {
        const file = join(folder, path, name)
        return [path, existsSync(file) ? readFileSync(file, 'utf8') : undefined]
      }),
    )
    return vaultOf('help', notes, name).problems
  })
  return [...new Set(problems)]
}

/**
 * Fails the build, and `dev` when it starts, while a folder of Help reads as no Tile. The folder is found from Vite's
 * root, as the bundle's `import.meta.glob('/help/**')` finds it, wherever Vite was started from.
 */
export function helpChecked(folder = 'help'): Plugin {
  let root = process.cwd()
  return {
    name: 'hexframe:help-checked',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const problems = problemsIn(resolve(root, folder))
      if (problems.length === 0) return
      this.error(
        `Help has folders that read as no Tile:\n${problems.map((line) => `  ${folder}/${line}`).join('\n')}`,
      )
    },
  }
}
