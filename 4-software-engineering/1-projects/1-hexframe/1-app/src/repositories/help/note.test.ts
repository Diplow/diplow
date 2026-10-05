import { describe, expect, it } from 'vitest'

import { helpNotes } from './help'
import { missingFrom, noteOf } from './note'

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

describe("Help's notes, as the build bundles them", () => {
  it('holds the note of every folder, Context folders included, by its path', () => {
    expect(Object.keys(helpNotes.en)).toEqual(
      expect.arrayContaining([
        '',
        '.1-what-comes-first',
        '3-children-and-directions/.1-six-at-most',
      ]),
    )
    expect(helpNotes.en['']).toMatch(/^---\ntitle: Hexframe\n/)
  })

  it("holds each folder's French twin under the same path, apart from its English note", () => {
    expect(Object.keys(helpNotes.fr).sort()).toEqual(Object.keys(helpNotes.en).sort())
    expect(helpNotes.fr['2-tiles']).toMatch(/^---\ntitle: Les tuiles\n/)
    expect(helpNotes.en['2-tiles']).toMatch(/^---\ntitle: Tiles\n/)
  })
})
