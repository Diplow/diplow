import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { helpChecked, problemsIn } from './check-help'

// The check `build` runs on Help before bundling it: the real folder passes, and a folder that reads
// as no Tile fails the build with its path and why.

const note = (preview: string) =>
  `---\ntitle: A Tile\nparent: help\nowner: diplo\npreview: ${preview}\n---\nBody\n`

/** A Help folder on disk: a Root, a Child with no note, a Context Tile whose Preview runs long. */
function brokenHelp() {
  const folder = mkdtempSync(join(tmpdir(), 'help-'))
  writeFileSync(join(folder, 'CLAUDE.md'), note('Short.'))
  mkdirSync(join(folder, '1-empty'))
  mkdirSync(join(folder, '.2-long'))
  writeFileSync(join(folder, '.2-long', 'CLAUDE.md'), note('x'.repeat(351)))
  return folder
}

/** The plugin's build start, as Vite calls it, its `this.error` throwing as Vite's does. */
function buildStart(folder: string) {
  const hook = helpChecked(folder).buildStart as (this: {
    error: (message: string) => never
  }) => void
  hook.call({
    error: (message) => {
      throw new Error(message)
    },
  })
}

describe("the build's check of Help", () => {
  it('finds nothing wrong with the real folder', () => {
    expect(problemsIn('help')).toEqual([])
    expect(() => {
      buildStart('help')
    }).not.toThrow()
  })

  it('fails the build on a folder with no note, or with a Preview over 350 characters', () => {
    const folder = brokenHelp()
    expect(problemsIn(folder)).toEqual([
      '.2-long: its Preview is over 350 characters',
      '1-empty: no CLAUDE.md',
    ])
    expect(() => {
      buildStart(folder)
    }).toThrow(/Help has folders that read as no Tile:\n {2}.+\/\.2-long: its Preview/)
  })
})
