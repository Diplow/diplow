import { expect, test } from 'claude-code/testing'
import { codeOf, isText, leafPreview, markdownOf } from '../hooks/markdown.js'
import { layoutView } from '../hooks/shape/layout.js'
import type { Frame } from '../hooks/shape/node.js'
import { base64, paint, sanitize, scaleFor, wrap } from '../hooks/raster.js'
import { drawSvg } from '../hooks/svg.js'

/** A Frame whose Children are a Branch and a Leaf. */
const frame: Frame = {
  tile: { path: '/w', title: 'Center', preview: 'A preview' },
  rings: {
    children: {
      members: {
        1: { kind: 'branch', tile: { path: '/w/1-a', title: 'A', preview: '' } },
        2: { kind: 'leaf', tile: { path: '/w/2-b.md', title: 'B', preview: '' } },
      },
      overflow: [],
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
  const painting = paint(layoutView({ frame, frameKind: 'children' }, 1), scale ?? 0)
  expect(painting.columns <= 80).toBe(true)
  expect(painting.rows <= 26).toBe(true)
  const bytes = (painting.cells.length / 4) * 3 - (painting.cells.match(/=*$/)?.[0].length ?? 0)
  expect(bytes).toBe(painting.columns * painting.rows * 12)
  expect(scaleFor(20, 10)).toBeUndefined()
})

test('the preview drops the frontmatter and stays within what a Markdown draws', () => {
  expect(markdownOf('---\ntitle: A\n---\n# A\r\n\nBody\u0007\n')).toBe('# A\n\nBody')
  expect(markdownOf('No frontmatter')).toBe('No frontmatter')
  // C1 controls, CSI among them, go too: a terminal could read them as escapes.
  expect(markdownOf('a\u009b31mb\u0085c')).toBe('a31mbc')
  const long = markdownOf('x'.repeat(20000))
  expect(long.length).toBe(10000)
  expect(long.endsWith('open it to read the rest.*')).toBe(true)
})

test('the SVG fills a Leaf apart from a Branch', () => {
  const svg = drawSvg(layoutView({ frame, frameKind: 'children' }, 1))
  expect(svg).toContain('fill="#2f3446"')
  expect(svg).toContain('fill="#4a3426"')
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
