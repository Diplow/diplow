import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { helpChecked, problemsIn } from './check-help'

// The check `build` runs on Help before bundling it: the real folder passes, and a folder that reads
// as no Tile, in English or in French, fails the build with its path and why.

const note = (preview: string) =>
  `---\ntitle: A Tile\nparent: help\nowner: diplo\npreview: ${preview}\n---\nBody\n`

/** A folder of Help on disk, holding these notes, by their path from it. */
function helpWith(notes: Readonly<Record<string, string>>) {
  const folder = mkdtempSync(join(tmpdir(), 'help-'))
  for (const [path, text] of Object.entries(notes)) {
    mkdirSync(join(folder, path, '..'), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

/**
 * A Help folder on disk: a Root in both languages, a Child with no note, a Context Tile whose Preview
 * runs long in English and is translated, and a Child whose French twin is missing.
 */
function brokenHelp() {
  const folder = helpWith({
    'CLAUDE.md': note('Short.'),
    'CLAUDE.fr.md': note('Court.'),
    '.2-long/CLAUDE.md': note('x'.repeat(351)),
    '.2-long/CLAUDE.fr.md': note('Court.'),
    '3-untranslated/CLAUDE.md': note('Short.'),
  })
  mkdirSync(join(folder, '1-empty'))
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
      '.2-long: its CLAUDE.md has a Preview over 350 characters',
      '1-empty: no CLAUDE.md',
      '1-empty: no CLAUDE.fr.md',
      '3-untranslated: no CLAUDE.fr.md',
    ])
    expect(() => {
      buildStart(folder)
    }).toThrow(
      /Help has folders that read as no Tile:\n {2}.+\/\.2-long: its CLAUDE.md has a Preview/,
    )
  })

  it('fails the build on a French twin missing a field, or whose Preview runs long', () => {
    const folder = helpWith({
      'CLAUDE.md': note('Short.'),
      'CLAUDE.fr.md': '---\ntitle: Racine\nparent: help\nowner: diplo\n---\nContenu\n',
      '1-tiles/CLAUDE.md': note('Short.'),
      '1-tiles/CLAUDE.fr.md': note('x'.repeat(351)),
    })
    expect(problemsIn(folder)).toEqual([
      '.: its CLAUDE.fr.md has no preview',
      '1-tiles: its CLAUDE.fr.md has a Preview over 350 characters',
      '.: the Root reads as no Tile',
    ])
  })
})
