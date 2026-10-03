import { expect, test } from 'claude-code/testing'
import {
  frontmatter,
  parent,
  resolvePath,
  sortFolders,
  markdownOf,
  tileOf,
  titleFromName,
} from '../hooks/node.js'
import { layoutFrame } from '../hooks/layout.js'
import { base64, paint, sanitize, scaleFor, wrap } from '../hooks/raster.js'

const dir = (name: string) => ({ name, kind: 'dir' as const })

test('numbered folders are Children, dot folders are Context', () => {
  const sorted = sortFolders([
    dir('2-education'),
    dir('1-leadership'),
    dir('.claude'),
    dir('.2-notes'),
    dir('.git'),
    dir('notes'),
    { name: '3-file.md', kind: 'file' },
  ])
  expect(sorted.children).toEqual({ 1: '1-leadership', 2: '2-education', 3: 'notes' })
  expect(sorted.context).toEqual({ 1: '.claude', 2: '.2-notes' })
  expect(sorted.overflow).toEqual([])
})

test('unnumbered folders take the free Child slots in name order, then overflow', () => {
  const sorted = sortFolders(['b', '2-two', 'a', 'c', 'd', 'e', 'f', 'node_modules'].map(dir))
  expect(sorted.children).toEqual({ 1: 'a', 2: '2-two', 3: 'b', 4: 'c', 5: 'd', 6: 'e' })
  expect(sorted.overflow).toEqual(['f'])
})

test('a second folder in a direction overflows', () => {
  const sorted = sortFolders([dir('1-a'), dir('1-b')])
  expect(sorted.children).toEqual({ 1: '1-a' })
  expect(sorted.overflow).toEqual(['1-b'])
})

test('the frontmatter gives the title and a folded preview', () => {
  const body = [
    '---',
    'title: "Hexframe"',
    'preview: >-',
    '  One tile,',
    '  six around it.',
    '---',
    '# x',
  ].join('\n')
  expect(frontmatter(body)).toEqual({ title: 'Hexframe', preview: 'One tile, six around it.' })
  expect(tileOf('/a/1-hexframe', body).title).toBe('Hexframe')
  expect(tileOf('/a/4-software-engineering', undefined).title).toBe('Software engineering')
})

test('names read as titles', () => {
  expect(titleFromName('.claude')).toBe('.claude')
  expect(titleFromName('.3-game_rules')).toBe('Game rules')
})

test('paths resolve without Node', () => {
  expect(resolvePath('/work/a', '../b/./c')).toBe('/work/b/c')
  expect(resolvePath('/work', '/abs')).toBe('/abs')
  expect(parent('/work/a')).toBe('/work')
  expect(parent('/work')).toBe('/')
})

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
  const painting = paint(layoutFrame(frame, 'children'), scale ?? 0)
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
