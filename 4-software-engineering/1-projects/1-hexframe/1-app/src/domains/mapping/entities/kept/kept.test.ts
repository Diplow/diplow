import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'

import type { Row } from '../rows'
import { systemFrom, systemOf } from '../system'
import {
  Frontmatter,
  configured,
  isFolderPattern,
  isSegment,
  keepsNothing,
  keptOf,
  named,
} from './kept'
import { defaultNaming, inherited } from './naming'

// What a Tile keeps from the files it was imported from: the checks, on values made by hand, and the
// naming in force on rows made by hand. Over PGlite, a Tile keeps them through an edit, a move and a
// swap, and a read gives them back: `../../kept.test.ts`, beside the application service.

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
          {},
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
  const row = (id: string, parentId: string | null, direction: number | null): Row => ({
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
  const rows: ReadonlyArray<Row> = [
    row('root', null, null),
    { ...row('skills', 'root', 1), name: '.skills', config: { fileName: 'SKILL.md' } },
    { ...row('skill', 'skills', 2), name: 'do-ticket', frontmatter: { owner: 'diplo' } },
    row('leaf', 'skills', 7),
    { ...row('context', 'skills', -1), config: { folderPattern: '<slug>' } },
    row('inside', 'context', 3),
    row('plain', 'root', 2),
  ]
  const found = systemFrom(rows, { owned: true })
  if (found === undefined) throw new Error('These rows hold a Root')
  const root = systemOf(found)

  it('gives a Tile what it keeps, and nothing for what it keeps not', () => {
    expect(root.branches[1]).toMatchObject({ name: '.skills', config: { fileName: 'SKILL.md' } })
    expect(root.branches[1]?.branches[2]).toMatchObject({ frontmatter: { owner: 'diplo' } })
    expect(keptOf(rows[0] ?? row('', null, null))).toEqual({})
    expect(root.branches[2]).not.toHaveProperty('name')
  })

  it('takes each part a config sets over the naming above it', () => {
    expect(inherited(defaultNaming, {})).toEqual(defaultNaming)
    expect(inherited(defaultNaming, { config: { folderPattern: '<slug>' } })).toEqual({
      fileName: 'CLAUDE.md',
      folderPattern: '<slug>',
    })
  })
})
