import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { parse } from 'yaml'

import { splitFrontmatter } from '../../../../../2-claude-mod/hooks/shape/node'
import type { TileRow } from '#/repositories/database/tiles/tiles'

import { helpSystem } from '../help/help'
import { isSegment, keepsNothing } from '../kept/kept'
import { systemOf } from '../system'
import { type File, exportOf } from './files'
import { yamlOf } from './frontmatter'

// A Tile and everything below it written as files, on a System made by hand from rows, no database:
// each kind of slot, what a Tile keeps, its References, its naming; then every file read back the way
// the shape splits a frontmatter from its Body, and Help, which exports like any Tile.

const row = (id: string, parentId: string | null, direction: number | null): TileRow => ({
  id,
  parentId,
  direction,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}`,
  target: null,
  ...keepsNothing,
})

const reference = (id: string, parentId: string, direction: number, target: string): TileRow => ({
  ...row(id, parentId, direction),
  target,
})

const injected = 'Line one\n---\nid: injected'

// A Root; a Branch with a Markdown Leaf and one that isn't; a Branch kept as `3-games`, keeping
// Frontmatter, holding References, one inside, one broken; `.skills`, now a Branch, naming its files
// `SKILL.md`, with a skill and a Context Tile setting a bare `<slug>` folder pattern, under which sit
// a Title of `..` and a French one; and a Context Tile whose Title and Preview try to close the block.
const rows: ReadonlyArray<TileRow> = [
  { ...row('root', null, null), title: 'Ulysse' },
  { ...row('leadership', 'root', 1), title: 'Leadership' },
  { ...row('notes', 'leadership', 7), title: 'Notes' },
  {
    ...row('json', 'leadership', 8),
    title: 'package.json',
    preview: '',
    body: '{ "name": "x" }\n',
    name: 'package.json',
  },
  {
    ...row('games', 'root', 3),
    title: 'Games',
    name: '3-games',
    frontmatter: { owner: 'diplo', weight: 2, draft: false, constructor: 'kept' },
  },
  reference('to-leadership', 'games', -1, 'leadership'),
  reference('to-gone', 'games', -2, 'gone'),
  {
    ...row('skills', 'root', 4),
    title: 'Skills',
    name: '.skills',
    config: { fileName: 'SKILL.md' },
  },
  { ...row('do-ticket', 'skills', 1), title: 'Do ticket', name: 'do-ticket' },
  { ...row('rules', 'skills', -1), title: 'Rules', config: { folderPattern: '<slug>' } },
  { ...row('dots', 'rules', 2), title: '..' },
  { ...row('ecoles', 'rules', 1), title: 'Écoles françaises' },
  { ...row('principles', 'root', -1), title: injected, preview: 'a\u2028---\u2029b' },
]

const system = systemOf(rows)
if (system === undefined) throw new Error('These rows hold a Root')

const link = (id: string) => `https://hexframe.test/map?tile=${id}`

/** The export of the Tile of this id, which the System holds. */
function exported(id: string): ReadonlyArray<File> {
  if (system === undefined) throw new Error('These rows hold a Root')
  const files = exportOf(system, id, link)
  if (files === undefined) throw new Error(`The System holds ${id}`)
  return files
}

/** A file's frontmatter, split as the shape splits it, then read as YAML, and its Body. */
function read(files: ReadonlyArray<File>, path: string) {
  const file = files.find((found) => found.path === path)
  if (file === undefined) throw new Error(`No file at ${path}`)
  const { frontmatter, body } = splitFrontmatter(file.content)
  return { lines: frontmatter, fields: parse(frontmatter.join('\n')) as unknown, body }
}

describe('a System exported whole', () => {
  const files = exported('root')

  it('writes a folder per Branch and Context Tile, a file per Leaf, and the configs set', () => {
    expect(files.map(({ path }) => path).sort()).toEqual(
      [
        'CLAUDE.md',
        '1-leadership/CLAUDE.md',
        '1-leadership/1-notes.md',
        '1-leadership/package.json',
        '3-games/CLAUDE.md',
        '3-games/.1-leadership/CLAUDE.md',
        '3-games/.2-broken/CLAUDE.md',
        '4-skills/SKILL.md',
        '4-skills/.hexframe/config.yaml',
        '4-skills/do-ticket/SKILL.md',
        '4-skills/.1-rules/SKILL.md',
        '4-skills/.1-rules/.hexframe/config.yaml',
        '4-skills/.1-rules/tile/SKILL.md',
        '4-skills/.1-rules/ecoles-francaises/SKILL.md',
        '.1-line-one-id-injected/CLAUDE.md',
      ].sort(),
    )
  })

  it('opens each Tile’s file with its id, Title, parent and Preview, then its Body', () => {
    expect(read(files, 'CLAUDE.md')).toMatchObject({
      fields: { id: 'root', title: 'Ulysse', parent: '.', preview: 'root, in short.' },
      body: '# root',
    })
    const notes = read(files, '1-leadership/1-notes.md')
    expect(notes.fields).toEqual({
      id: 'notes',
      title: 'Notes',
      parent: '1-leadership',
      preview: 'notes, in short.',
    })
    expect(read(files, '4-skills/.1-rules/SKILL.md').fields).toMatchObject({
      parent: '4-skills/.1-rules',
    })
  })

  it('writes a Leaf that isn’t Markdown as its content alone, under its Name', () => {
    const json = files.find(({ path }) => path === '1-leadership/package.json')
    expect(json?.content).toBe('{ "name": "x" }\n')
  })

  it('writes the Frontmatter a Tile kept after its own keys, in the order it came', () => {
    const games = read(files, '3-games/CLAUDE.md')
    expect(Object.keys(games.fields as object)).toEqual([
      'id',
      'title',
      'parent',
      'preview',
      'owner',
      'weight',
      'draft',
      'constructor',
    ])
    expect(games.fields).toMatchObject({
      owner: 'diplo',
      weight: 2,
      draft: false,
      constructor: 'kept',
    })
  })

  it('links a Reference by its Tile’s path when exported too, a broken one by its URL', () => {
    expect(read(files, '3-games/.1-leadership/CLAUDE.md')).toEqual({
      lines: expect.any(Array) as unknown,
      fields: {
        title: 'Leadership',
        parent: '3-games/.1-leadership',
        preview: 'leadership, in short.',
        reference: '[[1-leadership/CLAUDE]]',
      },
      body: '',
    })
    expect(read(files, '3-games/.2-broken/CLAUDE.md').fields).toEqual({
      title: 'broken',
      parent: '3-games/.2-broken',
      preview: '',
      reference: link('gone'),
    })
  })

  it('writes the config a Tile sets in its folder’s `.hexframe/`, only the parts it sets', () => {
    const config = (path: string) =>
      parse(files.find((file) => file.path === path)?.content ?? '') as unknown
    expect(config('4-skills/.hexframe/config.yaml')).toEqual({ fileName: 'SKILL.md' })
    expect(config('4-skills/.1-rules/.hexframe/config.yaml')).toEqual({ folderPattern: '<slug>' })
  })

  it('keeps every value on its key’s line, a Title holding a line break and `---` included', () => {
    const principles = read(files, '.1-line-one-id-injected/CLAUDE.md')
    expect(principles.lines).toHaveLength(4)
    expect(principles.fields).toEqual({
      id: 'principles',
      title: injected,
      parent: '.1-line-one-id-injected',
      preview: 'a\u2028---\u2029b',
    })
    expect(principles.body).toBe('# principles')
  })

  it('writes every path one segment at a time, each a path segment', () => {
    for (const { path } of files) expect(path.split('/').every(isSegment), path).toBe(true)
  })
})

describe('a Tile exported with what is below it', () => {
  it('sits at the export’s root, a Reference to a Tile left out linked by its URL', () => {
    const files = exported('games')
    expect(files.map(({ path }) => path).sort()).toEqual(
      ['CLAUDE.md', '.1-leadership/CLAUDE.md', '.2-broken/CLAUDE.md'].sort(),
    )
    expect(read(files, 'CLAUDE.md').fields).toMatchObject({ id: 'games', parent: '.' })
    expect(read(files, '.1-leadership/CLAUDE.md').fields).toMatchObject({
      reference: link('leadership'),
    })
  })

  it('carries the naming it inherits in its root’s config, so it reads back named alike', () => {
    const files = exported('do-ticket')
    expect(files.map(({ path }) => path).sort()).toEqual(['.hexframe/config.yaml', 'SKILL.md'])
    expect(
      parse(files.find(({ path }) => path === '.hexframe/config.yaml')?.content ?? ''),
    ).toEqual({ fileName: 'SKILL.md' })
  })

  it('is one file for a Leaf, named as its folder names it', () => {
    expect(exported('json')).toEqual([{ path: 'package.json', content: '{ "name": "x" }\n' }])
    const [notes] = exported('notes')
    expect(notes?.path).toBe('1-notes.md')
    expect(read(exported('notes'), '1-notes.md').fields).toMatchObject({ id: 'notes', parent: '.' })
  })

  it('is nothing for an id the System does not hold', () => {
    expect(exportOf(system, 'gone', link)).toBeUndefined()
  })
})

describe('the YAML an export writes', () => {
  it('reads back as written, whatever a value holds', () => {
    const fields = {
      title: 'a: b # c',
      quoted: '"it\'s"',
      lines: 'one\r\ntwo\rthree\u0085four',
      separators: '\u2028---\u2029',
      long: 'a long title that goes on and on for a while\n---\nid: injected',
      longSeparators: `${'x'.repeat(60)}\u2028---\u2029${'y'.repeat(60)}`,
      looksTrue: 'true',
      empty: '',
      number: 3,
      flag: true,
    }
    const yaml = yamlOf(fields)
    expect(parse(yaml)).toEqual(fields)
    expect(yaml.split(/\r\n?|[\n\u2028\u2029]/).filter(Boolean)).toHaveLength(10)
  })
})

describe('Help, exported', () => {
  it.effect('reads like any Tile: a file per Tile, each one read back whole', () =>
    Effect.gen(function* () {
      const help = yield* helpSystem('en')
      const files = exportOf(help, help.id, link) ?? []
      const ids = files.map((file) => (read(files, file.path).fields as { id: string }).id)
      expect(ids).toContain(help.id)
      expect(new Set(ids).size).toBe(files.length)
      for (const { path } of files) expect(path.split('/').every(isSegment), path).toBe(true)
    }),
  )
})
