import { expect, test } from 'claude-code/testing'
import { frontmatter, parent, resolvePath, sortFolders, tileOf, titleFromName } from './node.js'

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
