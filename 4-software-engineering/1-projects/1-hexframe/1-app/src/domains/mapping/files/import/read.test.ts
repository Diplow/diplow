import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { ImportFault } from '../../errors'
import { contentBounds, previewLimit } from '../../tile'
import type { ImportFile, ImportPlan, ImportSource, PlannedTile } from './plan'
import { importOf } from './read'

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
    file('CLAUDE.md', note('id: old\ntitle: Ulysse\npreview: Who I am.\nowner: diplo', '# Me\n')),
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
      body: '# To do, no frontmatter\r\nkept as written',
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

  it('ignores the `id` a file carries and every key an export writes itself, keeping the rest', () => {
    const root = rootOf(vault)
    expect(root).not.toHaveProperty('id')
    expect(root.frontmatter).toEqual({ owner: 'diplo' })
  })
})

describe('a Tile config, read from `.hexframe/config.yaml`', () => {
  const skills = folder([
    file('.hexframe/config.yaml', 'fileName: SKILL.md\n'),
    file('SKILL.md', note('title: Skills\npreview: What I do.')),
    file('do-ticket/SKILL.md', note('title: Do ticket\npreview: Start a ticket.')),
    file('do-ticket/CLAUDE.md', 'Not a Leaf: the shape reads it as a folder’s own file.'),
    file('rules/.hexframe/config.yaml', 'folderPattern: <slug>\n'),
    file('rules/SKILL.md', note('title: Rules')),
  ])

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
  ])

  it('points inside the import by path, at an app link’s Tile by id, else at nothing', () => {
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
        file('.1-ref/CLAUDE.md', note('reference: "[[STACK]]"')),
        file('.1-ref/inside.md', ''),
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
        { path: '.1-ref', fault: 'ReferenceHoldsSomething' },
      ]),
    )
    expect(faults).toHaveLength(17)
  })

  it('reads a folder 16 deep, the deepest an import goes', () => {
    const sixteen = deep.split('/').slice(0, 16).join('/')
    expect(planOf(folder([file(`${sixteen}/CLAUDE.md`, note('title: Deep'))])).root).toBeDefined()
  })
})
