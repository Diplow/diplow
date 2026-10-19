import { describe, expect, it } from 'vitest'

import { missingFrom, noteOf } from './note'
import { shippedNotes } from './shipped'

describe('a note of a vault folder', () => {
  it('reads its frontmatter, a folded scalar joined into one line, and its Markdown', () => {
    const text = `---\ntitle: "A: Tile"\nparent: x\nowner: diplo\npreview: >-\n  One\n  two.\n---\n\nBody\n`
    expect(noteOf(text)).toEqual({
      fields: { title: 'A: Tile', parent: 'x', owner: 'diplo', preview: 'One two.' },
      body: 'Body',
    })
    expect(noteOf('# No frontmatter')).toBeUndefined()
    expect(noteOf('---\ntitle: never closed\n')).toBeUndefined()
  })
})

describe("the vault's fields every note holds", () => {
  it("names those a note lacks or holds empty, and leaves a Tile's own to Mapping", () => {
    expect(
      missingFrom({ fields: { title: 'A', parent: 'x', owner: '', preview: 'P' }, body: '' }),
    ).toEqual(['owner'])
    expect(missingFrom({ fields: {}, body: '' })).toEqual(['parent', 'owner'])
  })
})

describe('the notes of the Systems hexframe ships, as the build bundles them', () => {
  it('bundles a folder of notes for each of them, Help and the tutorial, a Root in each', () => {
    expect(Object.keys(shippedNotes)).toEqual(['help', 'tutorial'])
    for (const notes of Object.values(shippedNotes)) {
      expect(notes.en['']).toMatch(/^---\ntitle: /)
      expect(notes.fr['']).toMatch(/^---\ntitle: /)
    }
  })

  it("holds the note of every folder of Help's, Context folders included, by its path", () => {
    expect(Object.keys(shippedNotes.help.en)).toEqual(
      expect.arrayContaining([
        '',
        '.1-what-comes-first',
        '3-children-and-directions/.1-six-at-most',
      ]),
    )
    expect(shippedNotes.help.en['']).toMatch(/^---\ntitle: Help\n/)
  })

  it("holds the tutorial's apart from Help's, its Root and its six numbered steps", () => {
    const folders = Object.keys(shippedNotes.tutorial.en)
    expect(folders).toContain('')
    expect(folders.filter((path) => /^[1-6]-[a-z0-9-]+$/.test(path))).toHaveLength(6)
    expect(shippedNotes.tutorial.en['']).not.toBe(shippedNotes.help.en[''])
  })

  it("holds each folder's French twin under the same path, apart from its English note", () => {
    for (const notes of Object.values(shippedNotes)) {
      expect(Object.keys(notes.fr).sort()).toEqual(Object.keys(notes.en).sort())
    }
    expect(shippedNotes.help.fr['2-tiles']).toMatch(/^---\ntitle: Les tuiles\n/)
    expect(shippedNotes.help.en['2-tiles']).toMatch(/^---\ntitle: Tiles\n/)
    expect(shippedNotes.tutorial.fr['']).not.toBe(shippedNotes.tutorial.en[''])
  })
})
