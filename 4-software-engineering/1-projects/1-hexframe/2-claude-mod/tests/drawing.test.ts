import { expect, test } from 'claude-code/testing'
import { markdownOf } from '../hooks/markdown.js'
import { layoutView } from '../hooks/shape/layout.js'
import { base64, paint, sanitize, scaleFor, wrap } from '../hooks/raster.js'

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
  const frame = {
    tile: { path: '/w', title: 'Center', preview: 'A preview' },
    children: { 1: { path: '/w/1-a', title: 'A', preview: '' } },
    context: {},
    overflow: [],
  }
  const scale = scaleFor(80, 26)
  expect(scale).toBeDefined()
  const painting = paint(layoutView({ frame, ring: 'children' }, 1), scale ?? 0)
  expect(painting.columns <= 80).toBe(true)
  expect(painting.rows <= 26).toBe(true)
  const bytes = (painting.cells.length / 4) * 3 - (painting.cells.match(/=*$/)?.[0].length ?? 0)
  expect(bytes).toBe(painting.columns * painting.rows * 12)
  expect(scaleFor(20, 10)).toBeUndefined()
})

test('the preview drops the frontmatter and stays within what a Markdown draws', () => {
  expect(markdownOf('---\ntitle: A\n---\n# A\r\n\nBody\u0007\n')).toBe('# A\n\nBody')
  expect(markdownOf('No frontmatter')).toBe('No frontmatter')
  const long = markdownOf('x'.repeat(20000))
  expect(long.length).toBe(10000)
  expect(long.endsWith('open it to read the rest.*')).toBe(true)
})
