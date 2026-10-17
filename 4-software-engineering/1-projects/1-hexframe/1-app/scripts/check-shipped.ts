// What `build` checks before it bundles the Systems hexframe ships (src/domains/mapping/shipped/):
// every folder under the app's `help/` and `tutorial/` reads as a Tile in every language they are
// written in, its `CLAUDE.md` and its French twin `CLAUDE.fr.md` each opening with its frontmatter,
// every field there, its Preview within 350 characters, its name a slot. The server reads them from
// the bundle alone, so a folder that reads as no Tile, or a note left untranslated, would go missing
// without a word; this fails the build instead, and `dev` when it starts.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

import type { Plugin } from 'vite'

import { shippedRoots } from '../src/domains/mapping/entities'
import { vaultOf } from '../src/domains/mapping/shipped/vault'
import { noteFiles } from '../src/repositories/shipped/note'

/**
 * What keeps each folder under `folder` from reading as a Tile of the System whose Root is `root`, in
 * any language, by its path from `folder`: English first, then each other language, a problem about a
 * note naming its file. A problem every language shares, a folder's name that is no slot, is told
 * once.
 */
export function problemsIn(folder: string, root: string): ReadonlyArray<string> {
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
    return vaultOf(root, notes, name).problems
  })
  return [...new Set(problems)]
}

/**
 * Fails the build, and `dev` when it starts, while a folder of a System hexframe ships reads as no
 * Tile, naming each: by default the folder of each Root Mapping names, its name the Root's id. Each
 * is found from Vite's root, as the bundle's `import.meta.glob('/help/**')` finds it, wherever Vite
 * was started from.
 */
export function shippedChecked(folders: ReadonlyArray<string> = shippedRoots): Plugin {
  let root = process.cwd()
  return {
    name: 'hexframe:shipped-checked',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      const problems = folders.flatMap((folder) =>
        problemsIn(resolve(root, folder), basename(folder)).map((line) => `  ${folder}/${line}`),
      )
      if (problems.length === 0) return
      this.error(
        `A System hexframe ships has folders that read as no Tile:\n${problems.join('\n')}`,
      )
    },
  }
}
