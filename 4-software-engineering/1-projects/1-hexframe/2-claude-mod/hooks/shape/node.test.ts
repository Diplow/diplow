import { expect, test } from 'claude-code/testing'
import {
  frontmatter,
  kindsOf,
  parent,
  resolvePath,
  sortEntries,
  tileOf,
  titleFromName,
  type Ring,
  type Slot,
} from './node.js'

const dir = (name: string) => ({ name, kind: 'dir' as const })
const file = (name: string) => ({ name, kind: 'file' as const })

/** A ring's members by name. */
const names = (ring: Ring<Slot> | undefined) =>
  Object.fromEntries(Object.entries(ring?.members ?? {}).map(([at, slot]) => [at, slot.name]))

test('numbered folders are Branches, dot folders are Context', () => {
  const rings = sortEntries([
    dir('2-education'),
    dir('1-leadership'),
    dir('.claude'),
    dir('.2-notes'),
    dir('.git'),
    dir('notes'),
  ])
  expect(names(rings.children)).toEqual({ 1: '1-leadership', 2: '2-education', 3: 'notes' })
  expect(names(rings.context)).toEqual({ 1: '.claude', 2: '.2-notes' })
  expect(rings.children?.overflow).toEqual([])
})

test('unnumbered folders take the free Branch slots in name order, then overflow', () => {
  const rings = sortEntries(['b', '2-two', 'a', 'c', 'd', 'e', 'f', 'node_modules'].map(dir))
  expect(names(rings.branches)).toEqual({ 1: 'a', 2: '2-two', 3: 'b', 4: 'c', 5: 'd', 6: 'e' })
  expect(rings.branches?.overflow).toEqual(['f'])
})

test('a second folder in a direction overflows', () => {
  const rings = sortEntries([dir('1-a'), dir('1-b')])
  expect(names(rings.children)).toEqual({ 1: '1-a' })
  expect(rings.children?.overflow).toEqual(['1-b'])
})

test("a folder's files are its Leaves, but for its own CLAUDE.md and its dot files", () => {
  const rings = sortEntries(
    ['CLAUDE.md', '-CLAUDE.md', '.gitignore', '.DS_Store', 'b.md', '2-two.md', 'a.ts'].map(file),
  )
  expect(names(rings.children)).toEqual({ 1: 'a.ts', 2: '2-two.md', 3: 'b.md' })
  expect(Object.values(rings.children?.members ?? {}).map(({ kind }) => kind)).toEqual([
    'leaf',
    'leaf',
    'leaf',
  ])
})

test('six Branches and Leaves or fewer make one Children Frame, the Branches seated first', () => {
  const rings = sortEntries([
    dir('2-b'),
    dir('notes'),
    file('1-x.md'),
    file('4-y.md'),
    file('a.md'),
    file('4-z.md'),
  ])
  expect(kindsOf(rings)).toEqual(['children', 'context'])
  // `notes/` keeps the direction it has among the Branches; `1-x.md` and `4-z.md` find theirs
  // taken, so they join `a.md` in the free ones, in name order.
  expect(names(rings.children)).toEqual({
    1: 'notes',
    2: '2-b',
    3: '1-x.md',
    4: '4-y.md',
    5: '4-z.md',
    6: 'a.md',
  })
  expect(rings.children?.overflow).toEqual([])
  expect(rings.children?.clashes).toEqual([])
})

test('more than six make a Branches and a Leaves Frame, each counting its own directions', () => {
  const rings = sortEntries([
    ...['1-a', '2-b', '3-c', '4-d'].map(dir),
    ...['1-a.md', '3-x.md', 'z.md', '3-y.md'].map(file),
  ])
  expect(kindsOf(rings)).toEqual(['branches', 'leaves', 'context'])
  expect(names(rings.branches)).toEqual({ 1: '1-a', 2: '2-b', 3: '3-c', 4: '4-d' })
  expect(names(rings.leaves)).toEqual({ 1: '1-a.md', 2: 'z.md', 3: '3-x.md' })
  expect(rings.leaves?.overflow).toEqual(['3-y.md'])
  expect(rings.leaves?.clashes).toEqual([])
})

test('a Leaf numbered like the Branch in its direction is a clash in the Children Frame', () => {
  const rings = sortEntries([dir('3-games'), dir('a'), file('3-games.md'), file('1-a.md')])
  // `a/` holds direction 1 without a number of its own, so `1-a.md` moves without a clash.
  expect(names(rings.children)).toEqual({ 1: 'a', 2: '1-a.md', 3: '3-games', 4: '3-games.md' })
  expect(rings.children?.clashes).toEqual([{ direction: 3, leaf: '3-games.md', branch: '3-games' }])
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
  expect(titleFromName('3-games.md')).toBe('Games')
  expect(titleFromName('package.json')).toBe('package.json')
})

test('paths resolve without Node', () => {
  expect(resolvePath('/work/a', '../b/./c')).toBe('/work/b/c')
  expect(resolvePath('/work', '/abs')).toBe('/abs')
  expect(parent('/work/a')).toBe('/work')
  expect(parent('/work')).toBe('/')
})
