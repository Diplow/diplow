import { expect, test } from 'claude-code/testing'
import {
  exclusionsFile,
  isExcluded,
  isOwnExclusionsFile,
  parseExclusions,
  patternOf,
} from './exclusions.js'

const patterns = parseExclusions

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
  // The message names the line, never repeats its text: the file could be anyone's
  expect(() => parseExclusions('exclude:\n  - "a" secret')).toThrow(
    /^line 2: something follows the item$/,
  )
  expect(() => parseExclusions('exclude:\n  - a\n  - src/lib')).toThrow(
    /^line 3: an exclusion names an entry of this folder, so it holds no other \/$/,
  )
  expect(() => parseExclusions('exclude: [/]')).toThrow(/^line 1: an exclusion names an entry/)
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
  expect(isExcluded('*', false, ['*'])).toBe(true)
  expect(isExcluded('', false, ['*'])).toBe(true)
})

test('a glob full of stars still answers at once', () => {
  const started = Date.now()
  const glob = '*a'.repeat(20) + '*b'
  expect(isExcluded('a'.repeat(4000), false, [glob])).toBe(false)
  expect(isExcluded('a'.repeat(4000) + 'b', false, [glob])).toBe(true)
  expect(Date.now() - started).toBeLessThan(1000)
})

test("only the folder's own exclusions.yaml is read, never one a symlink leads to", () => {
  expect(isOwnExclusionsFile('/v/a', '/v/a/.hexframe/exclusions.yaml')).toBe(true)
  expect(isOwnExclusionsFile('/', '/.hexframe/exclusions.yaml')).toBe(true)
  // `.hexframe/` or the file itself a link, to another folder of the vault or outside it
  expect(isOwnExclusionsFile('/v/a', '/v/b/.hexframe/exclusions.yaml')).toBe(false)
  expect(isOwnExclusionsFile('/v/a', '/home/me/secrets.yaml')).toBe(false)
  // A path the file system couldn't resolve is never the folder's own
  expect(isOwnExclusionsFile(undefined, '/v/a/.hexframe/exclusions.yaml')).toBe(false)
  expect(isOwnExclusionsFile('/v/a', undefined)).toBe(false)
})

test('a candidate names its own exclusion, a folder with a trailing /', () => {
  expect(patternOf({ kind: 'leaf', name: 'c.lock' })).toBe('c.lock')
  expect(patternOf({ kind: 'branch', name: 'dist' })).toBe('dist/')
  expect(patternOf({ kind: 'context', name: '.cache' })).toBe('.cache/')
  expect(isExcluded('dist', true, [patternOf({ kind: 'branch', name: 'dist' })])).toBe(true)
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
