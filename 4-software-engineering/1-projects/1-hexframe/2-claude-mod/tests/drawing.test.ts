import { expect, test } from 'claude-code/testing'
import { outline } from '../hooks/draw/outline.js'
import { base64, paint, sanitize, scaleFor } from '../hooks/draw/raster.js'
import { wrap } from '../hooks/draw/style.js'
import { drawSvg } from '../hooks/draw/svg.js'
import {
  codeOf,
  isText,
  leafPreview,
  markdownOf,
  markdownPreview,
  oneLine,
} from '../hooks/markdown.js'
import { layoutView } from '../hooks/shape/layout.js'
import type { Frame } from '../hooks/shape/node.js'

/** A Frame whose Children are a Branch and a Leaf. */
const frame: Frame = {
  tile: { path: '/w', title: 'Center', preview: 'A preview' },
  rings: {
    children: {
      overflowing: false,
      members: {
        1: { kind: 'branch', tile: { path: '/w/1-a', title: 'A', preview: '' } },
        2: { kind: 'leaf', tile: { path: '/w/2-b.md', title: 'B', preview: '' } },
      },
      clashes: [],
    },
  },
}

test('words wrap and the last kept line ends with an ellipsis', () => {
  expect(wrap('one two three four', 9, 5)).toEqual(['one two', 'three', 'four'])
  expect(wrap('one two three four', 9, 2)).toEqual(['one two', 'three…'])
  expect(wrap('.conductor', 8, 2)).toEqual(['.conduc…'])
})

test('a Raster cell only ever holds a one-column character', () => {
  expect(sanitize('é́ 日本 ok')).toBe('é ?? ok')
})

test('base64 matches the standard encoding', () => {
  expect(base64(new TextEncoder().encode('hexframe!'))).toBe('aGV4ZnJhbWUh')
  expect(base64(new TextEncoder().encode('hex'))).toBe('aGV4')
  expect(base64(new TextEncoder().encode('he'))).toBe('aGU=')
})

test('the painting has a triplet per cell', () => {
  const scale = scaleFor(80, 26)
  expect(scale).toBeDefined()
  const painting = paint(layoutView({ frame, frameKind: 'children' }), scale ?? 0)
  expect(painting.columns <= 80).toBe(true)
  expect(painting.rows <= 26).toBe(true)
  const bytes = (painting.cells.length / 4) * 3 - (painting.cells.match(/=*$/)?.[0].length ?? 0)
  expect(bytes).toBe(painting.columns * painting.rows * 12)
  expect(scaleFor(20, 10)).toBeUndefined()
})

test('the preview drops the frontmatter and stays within what a Markdown draws', () => {
  expect(markdownOf('---\ntitle: A\n---\n# A\r\n\nBody\u0007\n')).toBe('# A\n\nBody')
  expect(markdownOf('No frontmatter')).toBe('No frontmatter')
  // Unclosed, it is no frontmatter, as the Tile reads it: all of it shows
  expect(markdownOf('---\ntitle: A\n# A')).toBe('---\ntitle: A\n# A')
  // C1 controls, CSI among them, go too: a terminal could read them as escapes.
  expect(markdownOf('a\u009b31mb\u0085c')).toBe('a31mbc')
  const long = markdownOf('x'.repeat(20000))
  expect(long.length).toBe(10000)
  expect(long.endsWith('open it to read the rest.*')).toBe(true)
})

test('the SVG fills a Leaf apart from a Branch', () => {
  const svg = drawSvg(layoutView({ frame, frameKind: 'children' }))
  expect(svg).toContain('fill="#2f3446"')
  expect(svg).toContain('fill="#4a3426"')
})

test('a name or a title reaches a Text on one line, with no control character', () => {
  expect(oneLine('a\r\nb\tc\u2028d')).toBe('a b c d')
  expect(oneLine('red\u001b[31m\u009b31m\u0007')).toBe('red[31m31m')
})

test('the SVG holds no control character, which would make it invalid XML', () => {
  const tile = { path: '/w', title: 'A\u0007title', preview: 'Two\nlines\u0085' }
  const svg = drawSvg(layoutView({ frame: { ...frame, tile }, frameKind: 'children' }))
  expect(svg).toContain('>Atitle<')
  expect(/[\u0000-\u001f\u007f-\u009f]/.test(svg)).toBe(false)
})

test('a file that is not Markdown shows as a fence longer than its backticks', () => {
  expect(codeOf('a: 1\r\nb: ```x```\n\n')).toBe('````\na: 1\nb: ```x```\n````')
  expect(codeOf('  \n')).toBe('')
  const long = codeOf('x'.repeat(20000))
  expect(long.length <= 10000).toBe(true)
  expect(long.endsWith('open it to read the rest.*')).toBe(true)
  // A run of backticks too long to fence within the limit is cut out of what shows.
  const fenced = codeOf('a' + '`'.repeat(6000) + 'b')
  expect(fenced.length <= 10000).toBe(true)
  expect(fenced.endsWith('open it to read the rest.*')).toBe(true)
  expect(isText('PNG\u0000\u0001')).toBe(false)
  expect(isText('plain')).toBe(true)
})

test('a Leaf previews as Markdown, as a fence, or as a note saying why not', () => {
  expect(leafPreview('a.md', '---\ntitle: A\n---\n# A\n')).toEqual({ markdown: '# A' })
  expect(leafPreview('a.json', '{}\n')).toEqual({ markdown: '```\n{}\n```' })
  expect(leafPreview('a.png', 'PNG\u0000')).toEqual({ note: 'a.png is not a text file.' })
  expect(leafPreview('a.md', '---\ntitle: A\n---\n')).toEqual({
    note: 'a.md holds only its frontmatter.',
  })
  expect(leafPreview('a.txt', '  \n')).toEqual({ note: 'a.txt is empty.' })
})

test("a folder's body file previews as its Markdown, or as a note when it holds only its frontmatter", () => {
  expect(markdownPreview("A's CLAUDE.md", '---\ntitle: A\n---\n# A\n')).toEqual({ markdown: '# A' })
  expect(markdownPreview("A's CLAUDE.md", '---\ntitle: A\n---\n\n')).toEqual({
    note: "A's CLAUDE.md holds only its frontmatter.",
  })
})

test('the outline says the Frame in lines, a Leaf naming its file and the selected hex marked', () => {
  expect(outline({ frame, frameKind: 'children' }, 2).split('\n')).toEqual([
    'Center',
    'A preview',
    '',
    ' 1  A',
    '›2  B  (2-b.md)',
    ' 3  ·',
    ' 4  ·',
    ' 5  ·',
    ' 6  ·',
  ])
  // A Frame kind the folder doesn't offer outlines an empty ring, and no hex is marked unselected.
  expect(outline({ frame, frameKind: 'context' })).not.toContain('›')
  expect(outline({ frame, frameKind: 'context' })).toContain(' 1  ·')
})
