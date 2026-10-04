import { describe, expect, it } from 'vitest'

import { parseExclusions } from '../../2-claude-mod/hooks/shape/exclusions.ts'
import type { Entry, Slot } from '../../2-claude-mod/hooks/shape/node.ts'
import {
  candidatesOf,
  changeOf,
  countLine,
  countsOf,
  handWritten,
  leavingOf,
  toggled,
  togetherLine,
  withChange,
} from './exclusions.ts'

const dir = (name: string): Entry => ({ name, kind: 'dir' })
const file = (name: string): Entry => ({ name, kind: 'file' })
const branch = (name: string): Slot => ({ kind: 'branch', name })
const leaf = (name: string): Slot => ({ kind: 'leaf', name })

/** `1-app/` as the vault holds it: seven Leaves once its Tile and dot files are set aside. */
const app: Entry[] = [
  ...['src', 'public', 'node_modules', '.git', '.hexframe', '.vercel'].map(dir),
  ...['CLAUDE.md', '.env', 'package.json', 'vite.config.ts', 'tsconfig.json'].map(file),
  ...['README.md', 'eslint.config.ts', 'knip.json', 'drizzle.config.ts'].map(file),
]

describe('candidatesOf', () => {
  it('lists every candidate of each kind, in name order, but what every folder leaves out', () => {
    expect(candidatesOf(app)).toEqual({
      branch: [branch('public'), branch('src')],
      leaf: [
        'README.md',
        'drizzle.config.ts',
        'eslint.config.ts',
        'knip.json',
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
      ].map(leaf),
      context: [{ kind: 'context', name: '.vercel' }],
    })
  })
})

describe('leavingOf', () => {
  it('tells a candidate left out by its name from one a glob leaves out', () => {
    const items = ['src/', 'public', '*.json', 'dist/']
    expect(leavingOf(branch('src'), items)).toEqual({ by: 'name' })
    expect(leavingOf(branch('public'), items)).toEqual({ by: 'name' })
    expect(leavingOf(leaf('knip.json'), items)).toEqual({ by: 'glob', glob: '*.json' })
    expect(leavingOf(leaf('README.md'), items)).toEqual({ by: 'none' })
  })

  it('keeps a trailing / to folders', () => {
    expect(leavingOf(leaf('src'), ['src/'])).toEqual({ by: 'none' })
  })
})

describe('toggled', () => {
  it('adds the pattern of a candidate shown, a folder with its trailing /', () => {
    expect(toggled(['*.json'], branch('public'))).toEqual(['*.json', 'public/'])
    expect(toggled([], leaf('README.md'))).toEqual(['README.md'])
  })

  it('removes every item naming a candidate left out, and keeps the globs', () => {
    expect(toggled(['src', '*.json', 'src/'], branch('src'))).toEqual(['*.json'])
  })

  it('leaves alone a candidate a glob leaves out, even when its name is listed too', () => {
    expect(toggled(['*.json', 'knip.json'], leaf('knip.json'))).toEqual(['*.json', 'knip.json'])
  })
})

describe('handWritten', () => {
  it('names the globs and the names of nothing here, which the panel keeps', () => {
    expect(handWritten(['src/', '*.json', 'dist/'], candidatesOf(app))).toEqual(['*.json', 'dist/'])
  })
})

describe('countsOf', () => {
  it('counts each kind against six, and says when its ring overflows', () => {
    expect(countsOf(app, [])).toEqual({
      branch: { shown: 2, overflowing: false },
      leaf: { shown: 7, overflowing: true },
      context: { shown: 1, overflowing: false },
      children: undefined,
    })
  })

  it('follows the ticks: Branches and Leaves six or fewer draw together as Children', () => {
    const counts = countsOf(app, ['*.json', 'drizzle.config.ts'])
    expect(counts.leaf).toEqual({ shown: 3, overflowing: false })
    expect(counts.children).toEqual({ shown: 5, overflowing: false })
  })

  it('says a ring overflows when two names claim one number, under six', () => {
    expect(countsOf([dir('1-a'), dir('1-b')], []).branch).toEqual({ shown: 2, overflowing: true })
  })
})

describe('countLine', () => {
  it('says how many of six, and why a ring shows as a list', () => {
    expect(countLine({ shown: 4, overflowing: false })).toBe('4 of 6')
    expect(countLine({ shown: 8, overflowing: true })).toBe(
      '8 of 6, 2 too many: they show as a list',
    )
    expect(countLine({ shown: 2, overflowing: true })).toBe(
      '2 of 6, names share a number: they show as a list',
    )
  })
})

describe('togetherLine', () => {
  it('says whether Branches and Leaves draw together as Children, and how many of six', () => {
    expect(togetherLine({ shown: 5, overflowing: false })).toBe(
      'Branches and Leaves draw together as Children: 5 of 6.',
    )
    expect(togetherLine(undefined)).toBe(
      'Branches and Leaves are more than six in all, so each kind draws in a ring of its own.',
    )
  })
})

describe('withChange', () => {
  it('writes a new file with its one key', () => {
    expect(withChange(undefined, { add: ['dist/', '*.log'], remove: [] })).toBe(
      'exclude:\n  - dist/\n  - "*.log"\n',
    )
  })

  it('keeps comments, the globs written by hand and their order, and the list indent', () => {
    const text = '# What 1-app leaves out\nexclude:\n    - "*.json" # configs\n    - dist/\n\n'
    expect(withChange(text, { add: ['README.md'], remove: ['dist/'] })).toBe(
      '# What 1-app leaves out\nexclude:\n    - "*.json" # configs\n    - README.md\n',
    )
  })

  it('round-trips: what it writes reads back as the items changed, globs and quotes kept', () => {
    const text = 'exclude:\n  - \'*.lo?\'\n  - "a \\"b\\""\n  - src/\n'
    const before = parseExclusions(text)
    const after = [...before.filter((item) => item !== 'src/'), 'odd # name', '-dash', 'x\\y']
    const written = withChange(text, changeOf(before, after))
    expect(parseExclusions(written)).toEqual(after)
    expect(written).toContain("- '*.lo?'")
  })

  it('makes a flow list a block list, its items kept in order', () => {
    expect(withChange('exclude: [a, "b*"]\n', { add: ['c'], remove: ['a'] })).toBe(
      'exclude:\n  - "b*"\n  - c\n',
    )
  })

  it('adds the key to a file of comments only, and nothing twice', () => {
    expect(withChange('# nothing yet\n\n', { add: ['a', 'a'], remove: [] })).toBe(
      '# nothing yet\nexclude:\n  - a\n',
    )
    expect(withChange('exclude:\n  - a\n', { add: ['a'], remove: [] })).toBe('exclude:\n  - a\n')
  })

  it("keeps the file's line ending, and a comment on the key that holds a bracket", () => {
    expect(withChange('# a\r\nexclude:\r\n  - b\r\n', { add: ['c'], remove: [] })).toBe(
      '# a\r\nexclude:\r\n  - b\r\n  - c\r\n',
    )
    expect(withChange('exclude: # see [x]\n  - b\n', { add: [], remove: ['b'] })).toBe(
      'exclude: # see [x]\n',
    )
  })

  it('throws on a name that holds a line break, which the file cannot hold', () => {
    expect(() => withChange(undefined, { add: ['a\nb'], remove: [] })).toThrow(/line break/)
  })

  it('gives the file back as it is for a change of nothing', () => {
    const text = 'exclude: [a]   # kept as written'
    expect(withChange(text, { add: [], remove: [] })).toBe(text)
  })

  it('throws on a file it cannot parse, so it never writes over it', () => {
    expect(() => withChange('ignore:\n  - a\n', { add: ['b'], remove: [] })).toThrow(/line 1/)
  })
})
