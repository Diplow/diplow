import { expect, test } from 'claude-code/testing'
import { exclusionsFile, parseExclusions } from './exclusions.js'
import {
  bodySources,
  frontmatter,
  kindsOf,
  linesOf,
  parent,
  readLimit,
  resolvePath,
  sortEntries,
  splitFrontmatter,
  tileOf,
  titleFromName,
  unreadable,
  type FileStat,
  type Ring,
  type Slot,
} from './node.js'

const dir = (name: string) => ({ name, kind: 'dir' as const })
const file = (name: string) => ({ name, kind: 'file' as const })

/** A seated ring's members by name. */
const names = (ring: Ring<Slot> | undefined) => {
  if (ring?.overflowing !== false) throw new Error(`expected a seated ring, got ${String(ring)}`)
  return Object.fromEntries(Object.entries(ring.members).map(([at, slot]) => [at, slot.name]))
}

/** An overflowing ring's candidates by name, and the names that found no direction. */
const listed = (ring: Ring<Slot> | undefined) => {
  if (ring?.overflowing !== true) throw new Error(`expected an overflowing ring`)
  const names = (slots: Slot[]) => slots.map(({ name }) => name)
  return { candidates: names(ring.candidates), overflow: names(ring.overflow) }
}

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
})

test('unnumbered folders take the free Branch slots in name order', () => {
  const rings = sortEntries([
    ...['b', '2-two', 'a', 'c', 'd', 'e', 'node_modules'].map(dir),
    file('x.md'),
  ])
  expect(names(rings.branches)).toEqual({ 1: 'a', 2: '2-two', 3: 'b', 4: 'c', 5: 'd', 6: 'e' })
})

test('a seventh Branch overflows the ring, which then lists every candidate', () => {
  const rings = sortEntries(['b', '2-two', 'a', 'c', 'd', 'e', 'f'].map(dir))
  expect(listed(rings.branches)).toEqual({
    candidates: ['2-two', 'a', 'b', 'c', 'd', 'e', 'f'],
    overflow: ['f'],
  })
})

test('a second name in a direction overflows its ring, six or fewer as it may be', () => {
  const rings = sortEntries([dir('1-a'), dir('1-b'), file('a.md')])
  expect(listed(rings.children)).toEqual({ candidates: ['1-a', '1-b', 'a.md'], overflow: ['1-b'] })
  expect(rings.children?.overflowing && rings.children.candidates).toEqual([
    { kind: 'branch', name: '1-a' },
    { kind: 'branch', name: '1-b' },
    { kind: 'leaf', name: 'a.md' },
  ])
})

test("a folder's files are its Leaves, but for its own CLAUDE.md and its dot files", () => {
  const rings = sortEntries(
    ['CLAUDE.md', '-CLAUDE.md', '.gitignore', '.DS_Store', 'b.md', '2-two.md', 'a.ts'].map(file),
  )
  expect(names(rings.children)).toEqual({ 1: 'a.ts', 2: '2-two.md', 3: 'b.md' })
  const members = rings.children?.overflowing === false ? rings.children.members : {}
  expect(Object.values(members).map(({ kind }) => kind)).toEqual(['leaf', 'leaf', 'leaf'])
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
  expect(rings.children?.overflowing === false && rings.children.clashes).toEqual([])
})

test('more than six make a Branches and a Leaves Frame, each counting its own directions', () => {
  const rings = sortEntries([
    ...['1-a', '2-b', '3-c', '4-d'].map(dir),
    ...['1-a.md', '3-x.md', 'z.md'].map(file),
  ])
  expect(kindsOf(rings)).toEqual(['branches', 'leaves', 'context'])
  expect(names(rings.branches)).toEqual({ 1: '1-a', 2: '2-b', 3: '3-c', 4: '4-d' })
  expect(names(rings.leaves)).toEqual({ 1: '1-a.md', 2: 'z.md', 3: '3-x.md' })
})

test('only the ring with a name left over overflows, past six as within', () => {
  const rings = sortEntries([
    ...['1-a', '2-b', '3-c', '4-d'].map(dir),
    ...['1-a.md', '3-x.md', 'z.md', '3-y.md'].map(file),
  ])
  expect(names(rings.branches)).toEqual({ 1: '1-a', 2: '2-b', 3: '3-c', 4: '4-d' })
  expect(listed(rings.leaves)).toEqual({
    candidates: ['1-a.md', '3-x.md', '3-y.md', 'z.md'],
    overflow: ['3-y.md'],
  })
})

test('a Leaf numbered like the Branch in its direction is a clash in the Children Frame', () => {
  const rings = sortEntries([dir('3-games'), dir('a'), file('3-games.md'), file('1-a.md')])
  // `a/` holds direction 1 without a number of its own, so `1-a.md` moves without a clash.
  expect(names(rings.children)).toEqual({ 1: 'a', 2: '1-a.md', 3: '3-games', 4: '3-games.md' })
  expect(rings.children?.overflowing === false && rings.children.clashes).toEqual([
    { direction: 3, leaf: '3-games.md', branch: '3-games' },
  ])
})

test('a name its folder excludes takes no slot, in every Frame kind', () => {
  const exclusions = parseExclusions('exclude: ["*.lock", dist/, .cache]')
  const listing = [
    ...['1-a', 'dist', '.cache', '.claude', '.hexframe', 'node_modules', '.git'].map(dir),
    ...['pnpm.lock', 'dist', 'b.md'].map(file),
  ]
  const rings = sortEntries(listing, exclusions)
  // `dist` the file stays: `dist/` leaves out the folder only.
  expect(names(rings.children)).toEqual({ 1: '1-a', 2: 'b.md', 3: 'dist' })
  expect(names(rings.context)).toEqual({ 1: '.claude' })
  // Without them, the built-in exclusions alone still keep `.hexframe/` out of the Context.
  expect(names(sortEntries(listing).context)).toEqual({ 1: '.cache', 2: '.claude' })
})

test('exclusions are what turns an overflowing ring back into hexes', () => {
  const listing = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md', 'h.md'].map(file)
  expect(listed(sortEntries(listing).leaves).overflow).toEqual(['g.md', 'h.md'])
  const rings = sortEntries(listing, parseExclusions('exclude: [g.md, h.md]'))
  expect(names(rings.children)).toEqual({
    1: 'a.md',
    2: 'b.md',
    3: 'c.md',
    4: 'd.md',
    5: 'e.md',
    6: 'f.md',
  })
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

test('a frontmatter opens on the first line and needs its closing line', () => {
  expect(splitFrontmatter('---\r\ntitle: A\r---\r\n# A\n')).toEqual({
    frontmatter: ['title: A'],
    body: '# A\n',
  })
  // Unclosed, it is no frontmatter: the Tile and the preview both read the whole file as body
  const unclosed = '---\ntitle: A\n# A'
  expect(splitFrontmatter(unclosed)).toEqual({ frontmatter: [], body: unclosed })
  expect(frontmatter(unclosed)).toEqual({})
  expect(splitFrontmatter('# A\n---\nb')).toEqual({ frontmatter: [], body: '# A\n---\nb' })
})

test('a line ends at every line ending a file may hold', () => {
  expect(linesOf('a\r\nb\rc\nd\u2028e\u2029f')).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  expect(splitFrontmatter('---\u2028title: A\u2028---\u2028# A').frontmatter).toEqual(['title: A'])
})

test('a frontmatter line reads in time linear in its length', () => {
  // `\s*(.*)$` took seconds on a line of spaces before a separator, still under the read limit
  const line = `title:${' '.repeat(500_000)}x\u2028y`
  const started = Date.now()
  expect(frontmatter(`---\n${line}\n---\n`)).toEqual({ title: 'x' })
  expect(Date.now() - started).toBeLessThan(500)
})

test('a medium reads a regular file within the limit, under its folder', () => {
  const stat = (realPath: string | undefined, size = 10, kind: FileStat['kind'] = 'file') => ({
    kind,
    size,
    ...(realPath === undefined ? {} : { realPath }),
  })
  expect(unreadable(stat('/v/a/CLAUDE.md'), '/v/a', 'CLAUDE.md')).toBeUndefined()
  expect(unreadable(stat('/CLAUDE.md'), '/', 'CLAUDE.md')).toBeUndefined()
  // A symlink that stays in the folder is followed; one that leaves it is not, nor a prefix lookalike
  expect(unreadable(stat('/v/a/docs/README.md'), '/v/a/', 'CLAUDE.md')).toBeUndefined()
  expect(unreadable(stat('/v/ab/CLAUDE.md'), '/v/a', 'CLAUDE.md')).toBe(
    'it leads outside its folder',
  )
  expect(unreadable(stat('/dev/zero', 0, 'other'), '/v/a', 'CLAUDE.md')).toBe(
    'it leads outside its folder',
  )
  expect(unreadable(stat('/v/a/CLAUDE.md', 0, 'dir'), '/v/a', 'CLAUDE.md')).toBe('it is not a file')
  expect(unreadable(stat('/v/a/b.md', readLimit + 1), '/v/a', 'b.md')).toBe('it is too large')
  expect(unreadable(stat('/v/a/b.md', readLimit), '/v/a', 'b.md')).toBeUndefined()
  // A path the file system couldn't resolve is never under the folder
  expect(unreadable(stat(undefined), '/v/a', 'b.md')).toBe('it leads outside its folder')
  expect(unreadable(stat('/v/a/b.md'), undefined, 'b.md')).toBe('it leads outside its folder')
})

test("only the folder's own exclusions.yaml is read, never one a symlink leads to", () => {
  const own = (realPath: string, folder: string) =>
    unreadable({ kind: 'file', size: 10, realPath }, folder, exclusionsFile)
  expect(own('/v/a/.hexframe/exclusions.yaml', '/v/a')).toBeUndefined()
  expect(own('/.hexframe/exclusions.yaml', '/')).toBeUndefined()
  // `.hexframe/` or the file itself a link, to another folder of the vault, inside its own, or out
  expect(own('/v/b/.hexframe/exclusions.yaml', '/v/a')).toBe('it leads outside its folder')
  expect(own('/v/a/exclusions.yaml', '/v/a')).toBe('it leads outside its folder')
  expect(own('/home/me/secrets.yaml', '/v/a')).toBe('it leads outside its folder')
})

test('names read as titles', () => {
  expect(titleFromName('.claude')).toBe('.claude')
  expect(titleFromName('.3-game_rules')).toBe('Game rules')
  expect(titleFromName('3-games.md', 'leaf')).toBe('Games')
  expect(titleFromName('package.json', 'leaf')).toBe('package.json')
  expect(titleFromName('2-v1.2_notes')).toBe('V1.2 notes')
})

test("a folder's Tile reads its body file, a Leaf's itself when it is Markdown", () => {
  expect(bodySources('/w/3-games', 'branch')).toEqual([
    '/w/3-games/CLAUDE.md',
    '/w/3-games/-CLAUDE.md',
  ])
  expect(bodySources('/w/.claude', 'context')).toEqual([
    '/w/.claude/CLAUDE.md',
    '/w/.claude/-CLAUDE.md',
  ])
  expect(bodySources('/w/3-games.md', 'leaf')).toEqual(['/w/3-games.md'])
  expect(bodySources('/w/package.json', 'leaf')).toEqual([])
})

test('paths resolve without Node', () => {
  expect(resolvePath('/work/a', '../b/./c')).toBe('/work/b/c')
  expect(resolvePath('/work', '/abs')).toBe('/abs')
  expect(parent('/work/a')).toBe('/work')
  expect(parent('/work')).toBe('/')
})
