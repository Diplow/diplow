import { expect, test } from 'claude-code/testing'
import { exclusionsFile, isExcluded, parseExclusions } from './exclusions.js'

const patterns = (text: string) => parseExclusions(text).map(({ pattern }) => pattern)

test('exclusions.yaml lists its names under one key, as a block list or a flow list', () => {
  expect(exclusionsFile).toBe('.hexframe/exclusions.yaml')
  const block = [
    '# What this folder leaves out',
    'exclude:',
    '  - dist/',
    '  - "*.log"   # quoted, since * starts a YAML alias',
    "  - 'it''s.md'",
    "  - don't # a plain name keeps its apostrophe",
    '',
    '- tsconfig.json',
  ].join('\r\n')
  expect(patterns(block)).toEqual(['dist/', '*.log', "it's.md", "don't", 'tsconfig.json'])
  expect(patterns('exclude: [a, "b, c", \'d\']  # flow')).toEqual(['a', 'b, c', 'd'])
  expect(patterns('exclude: []')).toEqual([])
  expect(patterns('exclude:   # nothing yet')).toEqual([])
  expect(patterns('')).toEqual([])
})

test('anything else in exclusions.yaml throws, naming the line', () => {
  expect(() => parseExclusions('names:\n  - a')).toThrow(/^line 1: the one key is `exclude:`/)
  expect(() => parseExclusions('- a')).toThrow(/^line 1: a list item comes before/)
  expect(() => parseExclusions('exclude:\n  -')).toThrow(/^line 2: an item is empty/)
  expect(() => parseExclusions('exclude:\nexclude:')).toThrow(/^line 2: .* written twice/)
  expect(() => parseExclusions('exclude: a')).toThrow(/^line 1: `exclude:` takes a list/)
  expect(() => parseExclusions('exclude: [a, b')).toThrow(/^line 1: the list is left open/)
  expect(() => parseExclusions('exclude:\n  - "a')).toThrow(/^line 2: a quote is left open/)
  expect(() => parseExclusions('exclude:\n  - "a" b')).toThrow(/^line 2: `b` follows the item/)
  expect(() => parseExclusions('exclude: [src/lib]')).toThrow(/`src\/lib` is no name/)
})

test('a glob matches whole names: * any run of characters, ? one, the rest as written', () => {
  const exclusions = parseExclusions('exclude: ["*.log", "v?.md", "a+b(1).txt", ".*"]')
  const out = (name: string) => isExcluded(name, false, exclusions)
  expect(out('build.log')).toBe(true)
  expect(out('build.log.md')).toBe(false)
  expect(out('v1.md')).toBe(true)
  expect(out('v10.md')).toBe(false)
  expect(out('a+b(1).txt')).toBe(true)
  expect(out('aab(1).txt')).toBe(false)
  expect(out('.claude')).toBe(true)
  expect(out('notes.md')).toBe(false)
})

test('a trailing / leaves out folders only', () => {
  const exclusions = parseExclusions('exclude: [dist/]')
  expect(isExcluded('dist', true, exclusions)).toBe(true)
  expect(isExcluded('dist', false, exclusions)).toBe(false)
})

test('every folder leaves out .git, node_modules and .hexframe, whatever it lists', () => {
  for (const name of ['.git', 'node_modules', '.hexframe']) {
    expect(isExcluded(name, true, [])).toBe(true)
  }
  expect(isExcluded('.github', true, [])).toBe(false)
})
