import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { problemsIn, shippedChecked } from './check-shipped'

// The check `build` runs on the Systems hexframe ships before bundling them: the real folders, Help's
// and the tutorial's, pass, and a folder that reads as no Tile, in English or in French, fails the
// build with its System, its path and why.

const note = (preview: string) =>
  `---\ntitle: A Tile\nparent: help\nowner: diplo\npreview: ${preview}\n---\nBody\n`

/** A folder on disk named `name`, holding these notes, by their path from it. */
function folderWith(name: string, notes: Readonly<Record<string, string>>) {
  const folder = join(mkdtempSync(join(tmpdir(), 'shipped-')), name)
  mkdirSync(folder)
  for (const [path, text] of Object.entries(notes)) {
    mkdirSync(join(folder, path, '..'), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

/**
 * A shipped System's folder on disk: a Root in both languages, a Child with no note, a Context Tile
 * whose Preview runs long in English and is translated, and a Child whose French twin is missing.
 */
function broken(name: string) {
  const folder = folderWith(name, {
    'CLAUDE.md': note('Short.'),
    'CLAUDE.fr.md': note('Court.'),
    '.2-long/CLAUDE.md': note('x'.repeat(351)),
    '.2-long/CLAUDE.fr.md': note('Court.'),
    '3-untranslated/CLAUDE.md': note('Short.'),
  })
  mkdirSync(join(folder, '1-empty'))
  return folder
}

/** A shipped System's folder on disk that passes: a Root in both languages, and one Child. */
const sound = (name: string) =>
  folderWith(name, {
    'CLAUDE.md': note('Short.'),
    'CLAUDE.fr.md': note('Court.'),
    '1-step/CLAUDE.md': note('Short.'),
    '1-step/CLAUDE.fr.md': note('Court.'),
  })

/** The plugin's build start over these folders, as Vite calls it, its `this.error` throwing as Vite's does. */
function buildStart(folders?: ReadonlyArray<string>) {
  const hook = shippedChecked(folders).buildStart as (this: {
    error: (message: string) => never
  }) => void
  hook.call({
    error: (message) => {
      throw new Error(message)
    },
  })
}

describe("the build's check of the Systems hexframe ships", () => {
  it('finds nothing wrong with the real folders, Help and the tutorial', () => {
    expect(problemsIn('help', 'help')).toEqual([])
    expect(problemsIn('tutorial', 'tutorial')).toEqual([])
    expect(() => {
      buildStart()
    }).not.toThrow()
  })

  it('fails the build on a folder with no note, or with a Preview over 350 characters', () => {
    const folder = broken('help')
    expect(problemsIn(folder, 'help')).toEqual([
      '.2-long: its CLAUDE.md has a Preview over 350 characters',
      '1-empty: no CLAUDE.md',
      '1-empty: no CLAUDE.fr.md',
      '3-untranslated: no CLAUDE.fr.md',
    ])
    expect(() => {
      buildStart([folder])
    }).toThrow(
      /A System hexframe ships has folders that read as no Tile:\n {2}.+\/help\/\.2-long: its CLAUDE.md has a Preview/,
    )
  })

  it("fails the build on the tutorial's folder as on Help's, naming the tutorial's ids", () => {
    const tutorial = folderWith('tutorial', {
      'CLAUDE.md': note('Short.'),
      'CLAUDE.fr.md': note('Court.'),
      '2-six/1-below/CLAUDE.md': note('Short.'),
      '2-six/1-below/CLAUDE.fr.md': note('Court.'),
      'steps/CLAUDE.md': note('Short.'),
      'steps/CLAUDE.fr.md': note('Court.'),
    })
    expect(problemsIn(tutorial, 'tutorial')).toEqual([
      '2-six: no CLAUDE.md',
      'steps: a folder is named <n>-<slug> for a Child, .<n>-<slug> for Context',
      'tutorial/2/1: the folder above it reads as no Tile',
      '2-six: no CLAUDE.fr.md',
    ])
    expect(() => {
      buildStart([sound('help'), tutorial])
    }).toThrow(/:\n {2}.+\/tutorial\/2-six: no CLAUDE.md\n/)
    expect(() => {
      buildStart([sound('help'), sound('tutorial')])
    }).not.toThrow()
  })

  it('fails the build on a French twin missing a field, or whose Preview runs long', () => {
    const folder = folderWith('tutorial', {
      'CLAUDE.md': note('Short.'),
      'CLAUDE.fr.md': '---\ntitle: Racine\nparent: tutorial\nowner: diplo\n---\nContenu\n',
      '1-tiles/CLAUDE.md': note('Short.'),
      '1-tiles/CLAUDE.fr.md': note('x'.repeat(351)),
    })
    expect(problemsIn(folder, 'tutorial')).toEqual([
      '.: its CLAUDE.fr.md has no preview',
      '1-tiles: its CLAUDE.fr.md has a Preview over 350 characters',
      '.: the Root reads as no Tile',
    ])
  })
})
