import { describe, expect, it } from 'vitest'

import { helpNotes } from './help'
import { noteOf } from './note'

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

describe("Help's notes, as the build bundles them", () => {
  it('holds the note of every folder, Context folders included, by its path', () => {
    expect(Object.keys(helpNotes)).toEqual(
      expect.arrayContaining([
        '',
        '.1-what-comes-first',
        '3-children-and-directions/.1-six-at-most',
      ]),
    )
    expect(helpNotes['']).toMatch(/^---\ntitle: Hexframe\n/)
  })
})
