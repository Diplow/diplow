import { describe, expect, it } from 'vitest'

import { missingFrom, noteOf, shippedFolders } from './note'
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
    expect(Object.keys(shippedNotes)).toEqual([...shippedFolders])
    for (const folder of shippedFolders) {
      expect(shippedNotes[folder].en['']).toMatch(/^---\ntitle: /)
      expect(shippedNotes[folder].fr['']).toMatch(/^---\ntitle: /)
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
    expect(shippedNotes.help.en['']).toMatch(/^---\ntitle: Hexframe\n/)
  })

  it("holds the tutorial's apart from Help's, its Root and its six steps", () => {
    expect(Object.keys(shippedNotes.tutorial.en).sort()).toEqual([
      '',
      '1-go-in',
      '2-six-at-most',
      '3-context',
      '4-your-system',
      '5-unfold',
      '6-keep-up',
    ])
    expect(shippedNotes.tutorial.en['']).toMatch(/^---\ntitle: Tutorial\n/)
    expect(Object.keys(shippedNotes.help.en)).not.toContain('1-go-in')
  })

  it("holds each folder's French twin under the same path, apart from its English note", () => {
    for (const folder of shippedFolders) {
      expect(Object.keys(shippedNotes[folder].fr).sort()).toEqual(
        Object.keys(shippedNotes[folder].en).sort(),
      )
    }
    expect(shippedNotes.help.fr['2-tiles']).toMatch(/^---\ntitle: Les tuiles\n/)
    expect(shippedNotes.help.en['2-tiles']).toMatch(/^---\ntitle: Tiles\n/)
    expect(shippedNotes.tutorial.fr['']).toMatch(/^---\ntitle: Tutoriel\n/)
  })
})
