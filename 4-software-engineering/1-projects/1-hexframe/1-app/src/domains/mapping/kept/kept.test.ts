import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import { expectTypeOf } from 'vitest'

import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type TileRow, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import * as Mapping from '../mapping'
import { system } from '../mapping'
import { systemOf } from '../system'
import {
  Frontmatter,
  configured,
  isFolderPattern,
  isSegment,
  keepsNothing,
  keptOf,
  named,
} from './kept'
import { defaultNaming, inherited, namingOf } from './naming'

// What a Tile keeps from the files it was imported from: first the checks, on values made by hand,
// and the naming in force on rows made by hand; then over PGlite, a Tile keeps them through an edit, a
// move and a swap, and a read gives them back.

describe('one path segment', () => {
  it('takes a plain name, a dot file and a name of 255 bytes', () => {
    for (const name of ['STACK.md', '3-games', '-CLAUDE.md', '.skills', 'é'.repeat(127), 'a b']) {
      expect(isSegment(name), name).toBe(true)
    }
    expect(isSegment('x'.repeat(255))).toBe(true)
  })

  it('refuses an empty name, `.`, `..`, a slash, a backslash, a control character, 256 bytes', () => {
    const refused = [
      '',
      '.',
      '..',
      'a/b',
      '../a',
      'a\\b',
      'a\u0000b',
      'a\nb',
      'a\u007fb',
      'a\u0085b',
    ]
    for (const name of [...refused, 'x'.repeat(256), 'é'.repeat(128)]) {
      expect(isSegment(name), JSON.stringify(name)).toBe(false)
    }
  })
})

describe('a folder pattern', () => {
  it('fills in a Direction, a slug or both, between parts that are each one path segment', () => {
    for (const pattern of ['<n>-<slug>', '<slug>', '<n>', 'skill-<slug>', '<n>_<slug>.d']) {
      expect(isFolderPattern(pattern), pattern).toBe(true)
    }
  })

  it('refuses one that fills in nothing, or holds a part that is no path segment', () => {
    for (const pattern of ['folder', '', '<n>/<slug>', '..<n>', '<n>\\<slug>', '<n>\t<slug>']) {
      expect(isFolderPattern(pattern), pattern).toBe(false)
    }
    expect(isFolderPattern(`<n>${'x'.repeat(253)}`)).toBe(false)
  })
})

describe('a Name and a Tile config, when stored', () => {
  const refusal = (field: string) => ({ _tag: 'NameInvalid', kind: 'Invalid', fields: [field] })

  it.effect('takes a Name that is one path segment, and refuses one that is not, on `name`', () =>
    Effect.gen(function* () {
      expect(yield* named('STACK.md')).toBe('STACK.md')
      for (const name of ['..', 'a/b', 'a\\b', 'a\u0000b', 'x'.repeat(256)]) {
        expect(yield* Effect.flip(named(name))).toMatchObject(refusal('name'))
      }
    }),
  )

  it.effect(
    'takes a config naming its file and its folders, and refuses a bad one, on `config`',
    () =>
      Effect.gen(function* () {
        expect(yield* configured({ fileName: 'SKILL.md' })).toEqual({ fileName: 'SKILL.md' })
        expect(yield* configured({ folderPattern: '<slug>' })).toEqual({ folderPattern: '<slug>' })
        for (const config of [
          { fileName: '../CLAUDE.md' },
          { fileName: '' },
          { folderPattern: 'fixed' },
          { folderPattern: '<n>/..' },
        ]) {
          expect(yield* Effect.flip(configured(config))).toMatchObject(refusal('config'))
        }
      }),
  )
})

describe('kept Frontmatter', () => {
  const keeps = (value: unknown) => Schema.is(Frontmatter)(value)

  it('keeps scalar values under plain keys, up to 32 keys and 4 KB', () => {
    expect(keeps({ owner: 'diplo', name: 'do-ticket', weight: 2.5, draft: false })).toBe(true)
    expect(keeps({ 'a_B-9': '---', tab: 'a\tb' })).toBe(true)
    expect(
      keeps(Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`k${String(i)}`, i]))),
    ).toBe(true)
    expect(keeps({ description: 'x'.repeat(4_000) })).toBe(true)
  })

  it('refuses a nested value, a key with a space or a colon, a value over lines, a reserved key', () => {
    for (const value of [
      { tags: ['a', 'b'] },
      { nested: { owner: 'diplo' } },
      { empty: null },
      { 'two words': 'a' },
      { 'key:': 'a' },
      { '': 'a' },
      { ['k'.repeat(65)]: 'a' },
      { note: 'one\ntwo' },
      { note: 'one\n---\ntitle: injected' },
      { note: 'one\r\ntwo' },
      { note: `one${String.fromCodePoint(0x2028)}two` },
      { infinite: Number.POSITIVE_INFINITY },
    ]) {
      expect(keeps(value), JSON.stringify(value)).toBe(false)
    }
    expect(keeps(JSON.parse('{"__proto__": "polluted"}'))).toBe(false)
    for (const key of ['id', 'title', 'parent', 'preview', 'reference']) {
      expect(keeps({ [key]: 'kept?' }), key).toBe(false)
    }
  })

  it('refuses an oversized map: 33 keys, or over 4 KB', () => {
    expect(
      keeps(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`k${String(i)}`, i]))),
    ).toBe(false)
    expect(keeps({ description: 'x'.repeat(4_100) })).toBe(false)
    expect(keeps({ description: 'é'.repeat(2_100) })).toBe(false)
  })
})

describe('the naming in force, on rows made by hand', () => {
  const row = (id: string, parentId: string | null, direction: number | null): TileRow => ({
    id,
    parentId,
    direction,
    title: id,
    preview: '',
    body: '',
    target: null,
    ...keepsNothing,
  })
  // A Root; under it `.skills`, setting its file name, holding a skill, a Leaf and a Context Tile
  // setting its folder pattern; and a Branch setting nothing.
  const rows: ReadonlyArray<TileRow> = [
    row('root', null, null),
    { ...row('skills', 'root', 1), name: '.skills', config: { fileName: 'SKILL.md' } },
    { ...row('skill', 'skills', 2), name: 'do-ticket', frontmatter: { owner: 'diplo' } },
    row('leaf', 'skills', 7),
    { ...row('context', 'skills', -1), config: { folderPattern: '<slug>' } },
    row('inside', 'context', 3),
    row('plain', 'root', 2),
  ]
  const root = systemOf(rows)
  if (root === undefined) throw new Error('These rows hold a Root')

  it('gives a Tile what it keeps, and nothing for what it keeps not', () => {
    expect(root.branches[1]).toMatchObject({ name: '.skills', config: { fileName: 'SKILL.md' } })
    expect(root.branches[1]?.branches[2]).toMatchObject({ frontmatter: { owner: 'diplo' } })
    expect(keptOf(rows[0] ?? row('', null, null))).toEqual({})
    expect(root.branches[2]).not.toHaveProperty('name')
  })

  it('is the defaults where no config sets any, at the Root and below it', () => {
    expect(namingOf(root, 'root')).toEqual(defaultNaming)
    expect(namingOf(root, 'plain')).toEqual(defaultNaming)
  })

  it('is a Tile’s own config, inherited below it, part by part, until a Tile sets its own', () => {
    const skills = { ...defaultNaming, fileName: 'SKILL.md' }
    for (const id of ['skills', 'skill', 'leaf']) expect(namingOf(root, id), id).toEqual(skills)
    for (const id of ['context', 'inside']) {
      expect(namingOf(root, id), id).toEqual({ fileName: 'SKILL.md', folderPattern: '<slug>' })
    }
  })

  it('is nothing for a Tile the System does not hold', () => {
    expect(namingOf(root, 'gone')).toBeUndefined()
  })

  it('takes each part a config sets over the naming above it', () => {
    expect(inherited(defaultNaming, {})).toEqual(defaultNaming)
    expect(inherited(defaultNaming, { config: { folderPattern: '<slug>' } })).toEqual({
      fileName: 'CLAUDE.md',
      folderPattern: '<slug>',
    })
  })
})

const TestTiles = tilesLayer.pipe(Layer.provideMerge(TestDatabase))

const createTile = (...args: Parameters<typeof Mapping.createTile>) =>
  transactional(Mapping.createTile(...args))

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

layer(TestTiles)('what a Tile keeps, over the tiles repository', (it) => {
  /** An Account's System, read once so its Root exists, and its Root. */
  const aSystem = Effect.gen(function* () {
    const accountId = crypto.randomUUID()
    const root = yield* system(accountId)
    return { accountId, root }
  })

  it.effect('keeps a Name through a Title edit, a move and a swap', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* aSystem
      const name = yield* named('STACK.md')
      const kept = yield* createTile(accountId, {
        parent: root.id,
        slot: { leaf: 1 },
        ...content('Stack'),
        name,
      })
      const other = yield* createTile(accountId, { parent: root.id, slot: 2, ...content('Other') })
      yield* transactional(Mapping.editTile(accountId, kept.id, { title: 'The stack' }))
      yield* transactional(Mapping.moveTile(accountId, kept.id, { parent: root.id, slot: 3 }))
      expect((yield* system(accountId)).branches[3]).toMatchObject({ title: 'The stack', name })
      yield* transactional(Mapping.swapTiles(accountId, kept.id, other.id))
      const after = yield* system(accountId)
      expect(after.branches[2]).toMatchObject({ id: kept.id, name: 'STACK.md' })
      expect(after.branches[3]).not.toHaveProperty('name')
    }),
  )

  it.effect('reads a config back, inherited below its Tile and overridden by one below', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* aSystem
      const skills = yield* createTile(accountId, {
        parent: root.id,
        slot: 1,
        ...content('Skills'),
        name: yield* named('.skills'),
        config: yield* configured({ fileName: 'SKILL.md' }),
      })
      const group = yield* createTile(accountId, {
        parent: skills.id,
        slot: 4,
        ...content('Ship'),
        config: yield* configured({ folderPattern: '<slug>' }),
      })
      const skill = yield* createTile(accountId, { parent: group.id, slot: 1, ...content('Do') })
      const read = yield* system(accountId)
      expect(read.branches[1]).toMatchObject({ config: { fileName: 'SKILL.md' } })
      expect(namingOf(read, root.id)).toEqual(defaultNaming)
      expect(namingOf(read, skills.id)).toEqual({ ...defaultNaming, fileName: 'SKILL.md' })
      expect(namingOf(read, skill.id)).toEqual({ fileName: 'SKILL.md', folderPattern: '<slug>' })
    }),
  )

  it.effect('keeps Frontmatter as it was given, and an edit leaves it, as it leaves the rest', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* aSystem
      const given = {
        owner: 'diplo',
        description: 'Starts a ticket: "HEX-1".',
        weight: 3,
        draft: true,
      }
      const frontmatter = yield* Schema.decodeUnknownEffect(Frontmatter)(given)
      const name = yield* named('do-ticket')
      const config = yield* configured({ fileName: 'SKILL.md' })
      const tile = yield* createTile(accountId, {
        parent: root.id,
        slot: -2,
        ...content('Do ticket'),
        name,
        config,
        frontmatter,
      })
      yield* transactional(Mapping.editTile(accountId, tile.id, content('Do a ticket')))
      expect((yield* system(accountId)).context[-2]).toMatchObject({
        title: 'Do a ticket',
        name: 'do-ticket',
        config: { fileName: 'SKILL.md' },
        frontmatter: given,
      })
    }),
  )

  it.effect('stores nothing it was not given', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* aSystem
      yield* createTile(accountId, { parent: root.id, slot: 5, ...content('Plain') })
      const plain = (yield* system(accountId)).branches[5]
      for (const part of ['name', 'config', 'frontmatter']) expect(plain).not.toHaveProperty(part)
    }),
  )

  it('stores only what was checked: a write takes a decoded Name, Tile config and Frontmatter', () => {
    type Given = Parameters<typeof Mapping.createTile>[1]
    expectTypeOf<string>().not.toExtend<NonNullable<Given['name']>>()
    expectTypeOf<{ fileName: string }>().not.toExtend<NonNullable<Given['config']>>()
    expectTypeOf<Record<string, string>>().not.toExtend<NonNullable<Given['frontmatter']>>()
  })
})
