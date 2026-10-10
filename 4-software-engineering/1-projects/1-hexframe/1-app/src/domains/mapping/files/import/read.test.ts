import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { ImportFault } from '../../errors'
import { contentBounds, previewLimit } from '../../entities'
import type { ImportFile, ImportPlan, ImportSource, LeftOut, PlannedTile } from './plan'
import { importOf, isSettingsFile, leftOutOf, skippedAsBinary } from './read'

// Files read back into an import plan, on file lists made by hand, no zip: a vault folder read the way
// the shape reads one, what it keeps and what it skips, its References, a file alone; then every fault
// that refuses an import, all of them at once.

const utf8 = new TextEncoder()

const file = (path: string, text: string): ImportFile => ({ path, bytes: utf8.encode(text) })

/** A Markdown file: its frontmatter, written as given, then its Body. */
const note = (frontmatter: string, body = '') => `---\n${frontmatter}\n---\n${body}`

/** An app link, as the API builds one, and the id it points at. */
const appLink = (id: string) => `https://hexframe.test/?center=${id}`
const idOfLink = (link: string) => /^https:\/\/hexframe\.test\/\?center=(.+)$/.exec(link)?.[1]

const folder = (files: ReadonlyArray<ImportFile>, name = 'vault'): ImportSource => ({
  _tag: 'Folder',
  name,
  files,
})

/** The plan for a source, which must read without a fault. */
function planOf(source: ImportSource): ImportPlan {
  const read = importOf(source, idOfLink)
  if (Result.isFailure(read)) throw new Error(JSON.stringify(read.failure.faults))
  return read.success
}

/** The plan's root, which must be a Tile. */
function rootOf(source: ImportSource): PlannedTile {
  const { root } = planOf(source)
  if (root._tag !== 'Tile') throw new Error('The root is a Leaf')
  return root
}

/** The faults that refuse a source, which must be refused. */
function faultsOf(source: ImportSource): ReadonlyArray<ImportFault> {
  const read = importOf(source, idOfLink)
  if (Result.isSuccess(read)) throw new Error('The import was not refused')
  expect(read.failure).toMatchObject({ _tag: 'ImportRefused', kind: 'Invalid', fields: ['files'] })
  return read.failure.faults
}

describe('a vault folder, read as the shape reads it', () => {
  const vault = folder([
    file(
      'CLAUDE.md',
      note('id: old\ntitle: Ulysse\npreview: Who I am.\nversion: 7\nowner: diplo', '# Me\n'),
    ),
    file('1-leadership/CLAUDE.md', note('title: Leadership\npreview: Leading.', 'Lead.')),
    file('notes/todo.md', '# To do, no frontmatter\r\nkept as written'),
    file('STACK.md', note('title: Stack\npreview: The stack.\nweight: 2\ndraft: false')),
    file('package.json', '{ "name": "x" }\n'),
    file('.1-principles/CLAUDE.md', note('title: Principles\npreview: What I hold to.')),
    file('.claude/settings.md', 'Settings.'),
    file('.gitignore', 'node_modules\n'),
    file('logo.png', '\u0000PNG'),
    file('.git/HEAD', 'ref: main'),
    file('node_modules/x/index.js', 'module.exports = 1'),
    file('.hexframe/exclusions.yaml', 'exclude:\n  - dist/\n  - "*.log"\n'),
    file('dist/bundle.js', 'built'),
    file('debug.log', 'noise'),
  ])

  it('reads the root from its file, a Branch from its own, a folder without one by its name', () => {
    const root = rootOf(vault)
    expect(root).toMatchObject({
      _tag: 'Tile',
      path: '',
      title: 'Ulysse',
      preview: 'Who I am.',
      body: '# Me\n',
      name: 'vault',
      frontmatter: { owner: 'diplo' },
    })
    expect(root.branches[1]).toMatchObject({ title: 'Leadership', name: '1-leadership' })
    expect(root.branches[2]).toMatchObject({ path: 'notes', title: 'Notes', name: 'notes' })
  })

  it('reads a Markdown Leaf from its frontmatter, any other as its text, by name order', () => {
    const { branches, leaves } = rootOf(vault)
    expect(leaves).toEqual({
      1: {
        _tag: 'Leaf',
        path: 'STACK.md',
        title: 'Stack',
        preview: 'The stack.',
        body: '',
        name: 'STACK.md',
        frontmatter: { weight: 2, draft: false },
      },
      2: {
        _tag: 'Leaf',
        path: 'package.json',
        title: 'package.json',
        preview: '',
        body: '{ "name": "x" }\n',
        name: 'package.json',
      },
    })
    expect(branches[2]?.leaves[1]).toMatchObject({
      title: 'Todo',
      preview: '',
      body: '# To do, no frontmatter\nkept as written',
    })
  })

  it('reads dot folders as Context, the numbered in their slot, the others in the free ones', () => {
    const { context } = rootOf(vault)
    expect(context[-1]).toMatchObject({ _tag: 'Tile', title: 'Principles', name: '.1-principles' })
    expect(context[-2]).toMatchObject({ _tag: 'Tile', title: '.claude', name: '.claude' })
  })

  it('leaves out what `.hexframe/`, `.git` and `node_modules` exclude, and skips what a System can’t hold', () => {
    const plan = planOf(vault)
    expect(plan.skipped).toEqual([
      { path: '.gitignore', reason: 'DotFile' },
      { path: 'logo.png', reason: 'Binary' },
    ])
    const root = rootOf(vault)
    expect(Object.keys(root.branches)).toEqual(['1', '2'])
    expect(Object.keys(root.leaves)).toEqual(['1', '2'])
    expect(Object.keys(root.context)).toEqual(['-1', '-2'])
  })

  it('ignores the `id` and the `version` a file carries, every key an export writes itself, keeping the rest', () => {
    const root = rootOf(vault)
    expect(root).not.toHaveProperty('id')
    expect(root).not.toHaveProperty('version')
    expect(root.frontmatter).toEqual({ owner: 'diplo' })
  })
})

describe('a Tile config, read from `.hexframe/config.yaml`', () => {
  const skills = folder([
    file('.hexframe/config.yaml', 'fileName: SKILL.md\n'),
    file('SKILL.md', note('title: Skills\npreview: What I do.')),
    file('do-ticket/SKILL.md', note('title: Do ticket\npreview: Start a ticket.')),
    file('do-ticket/CLAUDE.md', 'Not a Leaf: the shape reads it as a folder’s own file, shadowed.'),
    file('rules/.hexframe/config.yaml', 'folderPattern: <slug>\n'),
    file('rules/SKILL.md', note('title: Rules')),
  ])

  it('reports the shape’s own files a folder’s file in force shadows', () => {
    expect(planOf(skills).skipped).toEqual([{ path: 'do-ticket/CLAUDE.md', reason: 'Shadowed' }])
  })

  it('becomes the config of its folder’s Tile, its file name in force below until one sets its own', () => {
    const root = rootOf(skills)
    expect(root).toMatchObject({ title: 'Skills', config: { fileName: 'SKILL.md' } })
    expect(root.branches[1]).toMatchObject({ title: 'Do ticket', leaves: {} })
    expect(root.branches[1]).not.toHaveProperty('config')
    expect(root.branches[2]).toMatchObject({ title: 'Rules', config: { folderPattern: '<slug>' } })
  })
})

describe('a Reference, read from a Context folder’s `reference`', () => {
  const reference = (target: string) =>
    note(`title: Theirs\npreview: Never read.\nreference: "${target}"`)
  const vault = folder([
    file('1-games/CLAUDE.md', note('title: Games')),
    file('STACK.md', note('title: Stack')),
    file('.1-to-games/CLAUDE.md', reference('[[1-games/CLAUDE]]')),
    file('.2-to-stack/CLAUDE.md', reference('[[STACK|the stack]]')),
    file('.3-to-mine/CLAUDE.md', reference(appLink('42'))),
    file('.4-elsewhere/CLAUDE.md', reference('https://example.com/?center=42')),
    file('.5-missing/CLAUDE.md', reference('[[nowhere/CLAUDE]]')),
    file('.6-to-reference/CLAUDE.md', reference('[[.1-to-games/CLAUDE]]')),
  ])

  it('points inside the import by path, at an app link’s Tile by id, else at nothing, never at a Reference', () => {
    const { context } = rootOf(vault)
    expect(context).toEqual({
      [-1]: { _tag: 'Reference', path: '.1-to-games', target: { _tag: 'Inside', path: '1-games' } },
      [-2]: {
        _tag: 'Reference',
        path: '.2-to-stack',
        target: { _tag: 'Inside', path: 'STACK.md' },
      },
      [-3]: { _tag: 'Reference', path: '.3-to-mine', target: { _tag: 'Linked', id: '42' } },
      [-4]: { _tag: 'Reference', path: '.4-elsewhere', target: { _tag: 'Broken' } },
      [-5]: { _tag: 'Reference', path: '.5-missing', target: { _tag: 'Broken' } },
      [-6]: {
        _tag: 'Reference',
        path: '.6-to-reference',
        target: { _tag: 'Broken' },
      },
    })
  })

  it('is no Reference in a Branch, whose `reference` is a key an export writes, dropped', () => {
    const branch = rootOf(folder([file('1-a/CLAUDE.md', reference('[[STACK]]'))])).branches[1]
    expect(branch).toMatchObject({ _tag: 'Tile', title: 'Theirs', preview: 'Never read.' })
    expect(branch).not.toHaveProperty('frontmatter')
  })
})

describe('a file alone', () => {
  it('is a Leaf, Markdown or not', () => {
    expect(planOf({ _tag: 'File', file: file('STACK.md', note('title: Stack', 'Body')) })).toEqual({
      root: {
        _tag: 'Leaf',
        path: 'STACK.md',
        title: 'Stack',
        preview: '',
        body: 'Body',
        name: 'STACK.md',
      },
      skipped: [],
    })
    expect(planOf({ _tag: 'File', file: file('a.txt', 'text') }).root).toMatchObject({
      title: 'a.txt',
      body: 'text',
    })
  })

  it('is refused when a System can’t hold it', () => {
    expect(faultsOf({ _tag: 'File', file: file('logo.png', '\u0000') })).toEqual([
      { path: 'logo.png', fault: 'NothingToImport' },
    ])
  })
})

describe('an import refused', () => {
  const seven = (prefix: string, make: (n: number) => string) =>
    [1, 2, 3, 4, 5, 6, 7].map((n) => file(`${prefix}${make(n)}`, ''))
  const deep = Array.from({ length: 17 }, (_, index) => `d${String(index)}`).join('/')

  it('lists every fault at once, each by its path', () => {
    const faults = faultsOf(
      folder([
        ...seven('rings/many/', (n) => `x${String(n)}/CLAUDE.md`),
        ...seven('rings/leaves/', (n) => `x${String(n)}.md`),
        file('rings/claimed/1-a/CLAUDE.md', ''),
        file('rings/claimed/1-b/CLAUDE.md', ''),
        file('rings/claimed/2-a.md', ''),
        file('rings/claimed/2-b.md', ''),
        file('rings/claimed/.1-a/CLAUDE.md', ''),
        file('rings/claimed/.1-b/CLAUDE.md', ''),
        file(
          'content/long/CLAUDE.md',
          note(
            `title: ${'t'.repeat(contentBounds.title + 1)}\npreview: ${'p'.repeat(previewLimit + 1)}`,
            'b'.repeat(contentBounds.body + 1),
          ),
        ),
        file('large.md', 'x'.repeat(1_000_001)),
        file('bad\u0001name.md', ''),
        file(`${deep}/CLAUDE.md`, ''),
        file('content/yaml/CLAUDE.md', note('title: [a, b]')),
        file('content/broken/CLAUDE.md', note('title: a\ntitle: b')),
        file('content/kept/CLAUDE.md', note('nested: { a: 1 }')),
        file('settings/config/.hexframe/config.yaml', 'fileName: a/b\n'),
        file('settings/excluded/.hexframe/exclusions.yaml', 'nothing: here\n'),
        file('settings/huge/.hexframe/exclusions.yaml', `# ${'x'.repeat(4_096)}`),
        file('settings/many/.hexframe/exclusions.yaml', `exclude: [${'a,'.repeat(16)}b]`),
        file('settings/long/.hexframe/exclusions.yaml', `exclude: [${'*'.repeat(65)}]`),
        file('.1-ref/CLAUDE.md', note('reference: "[[STACK]]"')),
        file('.1-ref/inside.md', ''),
        file('.2-ref/CLAUDE.md', note('reference: "[[STACK]]"')),
        file('.2-ref/.DS_Store', ''),
      ]),
    )
    expect(faults).toEqual(
      expect.arrayContaining([
        { path: 'rings/many', fault: 'RingOverflows' },
        { path: 'rings/leaves', fault: 'RingOverflows' },
        { path: 'rings/claimed/1-b', fault: 'DirectionClaimed' },
        { path: 'rings/claimed/2-b.md', fault: 'DirectionClaimed' },
        { path: 'rings/claimed/.1-b', fault: 'DirectionClaimed' },
        { path: 'content/long', fault: 'TitleTooLong' },
        { path: 'content/long', fault: 'PreviewTooLong' },
        { path: 'content/long', fault: 'BodyTooLong' },
        { path: 'large.md', fault: 'FileTooLarge' },
        { path: 'bad\u0001name.md', fault: 'NameInvalid' },
        { path: 'd0/d1/d2/d3/d4/d5/d6/d7/d8/d9/d10/d11/d12/d13/d14/d15/d16', fault: 'TooDeep' },
        { path: 'content/yaml/CLAUDE.md', fault: 'FrontmatterInvalid' },
        { path: 'content/broken/CLAUDE.md', fault: 'FrontmatterInvalid' },
        { path: 'content/kept/CLAUDE.md', fault: 'FrontmatterInvalid' },
        { path: 'settings/config/.hexframe/config.yaml', fault: 'ConfigInvalid' },
        { path: 'settings/excluded/.hexframe/exclusions.yaml', fault: 'ExclusionsInvalid' },
        { path: 'settings/huge/.hexframe/exclusions.yaml', fault: 'FileTooLarge' },
        { path: 'settings/many/.hexframe/exclusions.yaml', fault: 'ExclusionsInvalid' },
        { path: 'settings/long/.hexframe/exclusions.yaml', fault: 'ExclusionsInvalid' },
        { path: '.1-ref', fault: 'ReferenceHoldsSomething' },
        { path: '.2-ref', fault: 'ReferenceHoldsSomething' },
      ]),
    )
    expect(faults).toHaveLength(21)
  })

  it('reads a folder 16 deep, the deepest an import goes', () => {
    const sixteen = deep.split('/').slice(0, 16).join('/')
    expect(planOf(folder([file(`${sixteen}/CLAUDE.md`, note('title: Deep'))])).root).toBeDefined()
  })
})

describe('what a sender leaves out before an upload', () => {
  type Sent = { kept: ReadonlyArray<string>; leftOut: ReadonlyArray<LeftOut> }

  /** Each list in path order: the order a sender walks a folder in is no rule. */
  const inOrder = ({ kept, leftOut }: Sent): Sent => ({
    kept: [...kept].sort((a, b) => a.localeCompare(b)),
    leftOut: [...leftOut].sort((a, b) => a.path.localeCompare(b.path)),
  })

  /** What `leftOutOf` keeps, by path, and leaves out, the settings it reads given as text. */
  function sent(paths: ReadonlyArray<string>, settings: Readonly<Record<string, string>> = {}) {
    const bytes = new Map(Object.entries(settings).map(([path, text]) => [path, utf8.encode(text)]))
    const { kept, leftOut } = leftOutOf(
      paths.map((path) => ({ path })),
      bytes,
    )
    return inOrder({ kept: kept.map(({ path }) => path), leftOut })
  }

  it('keeps what a reading reads, Context folders and the settings it reads among them', () => {
    const paths = [
      'CLAUDE.md',
      '1-a/CLAUDE.md',
      '1-a/notes.md',
      '.1-why/CLAUDE.md',
      '.hexframe/config.yaml',
      '.hexframe/exclusions.yaml',
      '1-a/.hexframe/config.yaml',
    ]
    expect(sent(paths)).toEqual(inOrder({ kept: paths, leftOut: [] }))
  })

  it('leaves out dot files, the folders every folder leaves out, once, and other settings', () => {
    expect(
      sent([
        'CLAUDE.md',
        '.DS_Store',
        '1-a/.env',
        '.git/HEAD',
        '.git/objects/ab/cd',
        '1-a/node_modules/x/index.js',
        '.hexframe/notes.md',
        '.hexframe/cache/x',
      ]),
    ).toEqual(
      inOrder({
        kept: ['CLAUDE.md'],
        leftOut: [
          { path: '.DS_Store', reason: 'DotFile' },
          { path: '.git', reason: 'Excluded' },
          { path: '.hexframe/notes.md', reason: 'Excluded' },
          { path: '.hexframe/cache', reason: 'Excluded' },
          { path: '1-a/.env', reason: 'DotFile' },
          { path: '1-a/node_modules', reason: 'Excluded' },
        ],
      }),
    )
  })

  it('leaves out what a folder’s exclusions name, in that folder only', () => {
    const exclusions = 'exclude:\n  - dist/\n  - "*.log"\n'
    expect(
      sent(
        [
          '1-a/dist/x.md',
          '1-a/run.log',
          '1-a/keep.md',
          'run.log',
          'dist/x.md',
          '1-a/.hexframe/exclusions.yaml',
        ],
        { '1-a/.hexframe/exclusions.yaml': exclusions },
      ),
    ).toEqual(
      inOrder({
        kept: ['run.log', 'dist/x.md', '1-a/keep.md', '1-a/.hexframe/exclusions.yaml'],
        leftOut: [
          { path: '1-a/run.log', reason: 'Excluded' },
          { path: '1-a/dist', reason: 'Excluded' },
        ],
      }),
    )
  })

  it('leaves nothing out by exclusions it can’t read, for the server to refuse', () => {
    const paths = ['dist/x.md', '.hexframe/exclusions.yaml']
    for (const text of ['not: [a list', 'x'.repeat(5_000)]) {
      expect(sent(paths, { '.hexframe/exclusions.yaml': text })).toEqual(
        inOrder({ kept: paths, leftOut: [] }),
      )
    }
    expect(
      leftOutOf(
        paths.map((path) => ({ path })),
        new Map([['.hexframe/exclusions.yaml', new Uint8Array([0xff])]]),
      ).kept,
    ).toHaveLength(2)
  })

  it('leaves out nothing the reading would have read: the same plan from what is kept', () => {
    const files = [
      file('CLAUDE.md', note('title: Vault\npreview: All of it')),
      file('1-a/CLAUDE.md', note('title: A')),
      file('1-a/notes.md', note('title: Notes', 'Body')),
      file('1-a/.env', 'SECRET=x'),
      file('1-a/dist/out.md', 'built'),
      file('1-a/.hexframe/exclusions.yaml', 'exclude: [dist/]'),
      file('.1-why/CLAUDE.md', note('title: Why')),
      file('.hexframe/config.yaml', 'fileName: CLAUDE.md'),
      file('.hexframe/notes.txt', 'x'),
      file('node_modules/x/index.js', 'x'),
      file('.git/HEAD', 'ref'),
      file('.DS_Store', 'x'),
    ]
    const { kept } = leftOutOf(files, new Map(files.map(({ path, bytes }) => [path, bytes])))
    expect(planOf(folder(kept)).root).toEqual(planOf(folder(files)).root)
  })

  it('names the settings a reading reads, in any folder', () => {
    expect(isSettingsFile('.hexframe/config.yaml')).toBe(true)
    expect(isSettingsFile('a/b/.hexframe/exclusions.yaml')).toBe(true)
    expect(isSettingsFile('.hexframe/other.yaml')).toBe(false)
    expect(isSettingsFile('config.yaml')).toBe(false)
    expect(isSettingsFile('hexframe/config.yaml')).toBe(false)
  })

  it('tells a binary by its bytes, whole or by its first ones, as a reading does', () => {
    // A folder's settings are read whatever they hold.
    expect(skippedAsBinary('.hexframe/config.yaml', new Uint8Array([0xff]))).toBe(false)
    expect(skippedAsBinary('x.md', utf8.encode('# Notes, café'))).toBe(false)
    expect(skippedAsBinary('x.md', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(true)
    expect(skippedAsBinary('x.md', utf8.encode('a\0b'))).toBe(true)
    // A head may end inside a character: only the bytes before it count.
    const cut = utf8.encode('café').slice(0, 4)
    expect(skippedAsBinary('x.md', cut)).toBe(true)
    expect(skippedAsBinary('x.md', cut, true)).toBe(false)
    expect(skippedAsBinary('x.md', new Uint8Array([0xff, 0x41]), true)).toBe(true)
    expect(skippedAsBinary('x.md', utf8.encode('a\0'), true)).toBe(true)
  })
})
