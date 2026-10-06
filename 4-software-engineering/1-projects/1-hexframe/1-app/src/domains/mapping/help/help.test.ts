import { expect, it, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe } from 'vitest'

import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import * as Mapping from '../mapping'
import { previewLimit, systemOf } from '../entities'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  SwapTiles,
} from '../operations'
import { help } from './help'
import { vaultOf } from './vault'

// Help as the build bundles it, read through Mapping's `readTile` like a System, and refused to every
// write; then a vault folder read from notes made by hand, and what keeps one from reading as a Tile.

const TestTiles = tilesLayer.pipe(Layer.provideMerge(TestDatabase))

/** An Account no other test uses. */
const someone = () => crypto.randomUUID()

const note = (title: string, preview = `${title}, in short.`) =>
  `---\ntitle: ${title}\nparent: help\nowner: diplo\npreview: >-\n  ${preview}\n---\n# ${title}\n`

describe('Help, as the build bundles it from the real folder', () => {
  it('reads every folder as a Tile, its id the path of its slots from the Root', () => {
    expect(help.en.problems).toEqual([])
    const ids = help.en.rows.map(({ id }) => id)
    expect(ids).toEqual(
      expect.arrayContaining(['help', 'help/-1', 'help/1', 'help/3', 'help/3/-1', 'help/6/2']),
    )
    expect(help.en.rows.find(({ id }) => id === 'help')).toMatchObject({
      title: 'Hexframe',
      target: null,
      parentId: null,
      direction: null,
    })
    expect(help.en.rows.find(({ id }) => id === 'help/3/-1')).toMatchObject({
      parentId: 'help/3',
      direction: -1,
    })
  })

  it('reads it in French too, every Tile at the same id, its words translated', () => {
    expect(help.fr.problems).toEqual([])
    const placeOf = ({ id, parentId, direction }: (typeof help.fr.rows)[number]) => ({
      id,
      parentId,
      direction,
    })
    expect(help.fr.rows.map(placeOf)).toEqual(help.en.rows.map(placeOf))
    expect(help.fr.rows.find(({ id }) => id === 'help/2')).toMatchObject({ title: 'Les tuiles' })
    expect(help.en.rows.find(({ id }) => id === 'help/2')).toMatchObject({ title: 'Tiles' })
  })
})

describe('Help whole, as /help draws it', () => {
  it.effect('reads the Root with everything below it in the language asked, Bodies included', () =>
    Effect.gen(function* () {
      const english = yield* Mapping.helpSystem('en')
      const french = yield* Mapping.helpSystem('fr')
      expect(english).toMatchObject({ _tag: 'Tile', id: 'help', title: 'Hexframe' })
      expect(english.branches[2]).toMatchObject({ id: 'help/2', title: 'Tiles' })
      expect(french.branches[2]).toMatchObject({ id: 'help/2', title: 'Les tuiles' })
      expect(french.branches[2]?.body).toMatch(/Une tuile est l’unité d’un système/)
      expect(french.context[-1]).toMatchObject({ _tag: 'Tile', id: 'help/-1' })
      expect(french.branches[3]?.context[-1]).toMatchObject({
        id: 'help/3/-1',
        title: 'Six au plus',
      })
    }),
  )
})

layer(TestTiles)("Help, read through Mapping's readTile", (it) => {
  it.effect('opens its Root with its Children and its Context, to the depth asked', () =>
    Effect.gen(function* () {
      const read = yield* Mapping.readTile(someone(), {
        language: 'en',
        id: 'help',
        depth: 1,
        fields: ['title', 'preview'],
      })
      expect(read.parent).toBeNull()
      expect(read.tile).toMatchObject({ _tag: 'Tile', id: 'help', title: 'Hexframe' })
      expect(read.tile).not.toHaveProperty('body')
      expect(Object.keys(read.tile.branches ?? {})).toEqual(['1', '2', '3', '4', '5', '6'])
      expect(read.tile.branches?.[3]).toMatchObject({ _tag: 'Tile', id: 'help/3' })
      expect(read.tile.branches?.[3]).not.toHaveProperty('branches')
      expect(read.tile.context?.[-1]).toMatchObject({ _tag: 'Tile', id: 'help/-1' })
    }),
  )

  it.effect('opens a Tile below with the fields asked, and names its parent', () =>
    Effect.gen(function* () {
      const read = yield* Mapping.readTile(someone(), {
        language: 'en',
        id: 'help/3',
        depth: 1,
        fields: ['body'],
      })
      expect(read.parent).toEqual({ id: 'help', title: 'Hexframe' })
      expect(read.tile).toMatchObject({ _tag: 'Tile', id: 'help/3' })
      expect(read.tile.body).toMatch(/Directions/)
      expect(read.tile).not.toHaveProperty('title')
      expect(read.tile.context?.[-1]).toMatchObject({ _tag: 'Tile', id: 'help/3/-1' })
    }),
  )

  it.effect('opens the same Tile in French, at the same id', () =>
    Effect.gen(function* () {
      const read = yield* Mapping.readTile(someone(), {
        id: 'help/3',
        depth: 1,
        fields: ['title'],
        language: 'fr',
      })
      expect(read.parent).toEqual({ id: 'help', title: 'Hexframe' })
      expect(read.tile).toMatchObject({
        _tag: 'Tile',
        id: 'help/3',
        title: 'Enfants et directions',
      })
      expect(read.tile.context?.[-1]).toMatchObject({ id: 'help/3/-1', title: 'Six au plus' })
    }),
  )

  it.effect('finds no Tile at an id Help has none at, a path that climbs out included', () =>
    Effect.gen(function* () {
      for (const id of ['help/7', 'help/1/1/1', 'help/../../x', 'help/3/../../package.json']) {
        const refused = yield* Mapping.readTile(someone(), {
          language: 'en',
          id,
          depth: 0,
          fields: ['body'],
        }).pipe(Effect.flip)
        expect(refused).toMatchObject({ _tag: 'TileNotFound', kind: 'NotFound' })
      }
    }),
  )
})

layer(TestTiles)('Help, refused to every write in Mapping itself', (it) => {
  it.effect('refuses each write that names a Help Tile, a move or a swap with one end in it', () =>
    Effect.gen(function* () {
      const accountId = someone()
      const { root } = yield* Mapping.system(accountId)
      const own = yield* transactional(
        Mapping.createTile(
          accountId,
          new CreateTile({
            parent: root.id,
            slot: 1,
            title: 'Own',
            preview: 'Own, in short.',
            body: '',
          }),
        ),
      )
      const content = { title: 'Mine', preview: 'Mine.', body: '' }
      // Operations naming Help's ids, which their schemas refuse: built past the checks, as a caller
      // whose schema let them through would, so Mapping is seen refusing them itself.
      const unchecked = { disableChecks: true }
      const attempts: ReadonlyArray<
        Effect.Effect<unknown, { readonly _tag: string }, InTransaction | Tiles>
      > = [
        Mapping.createTile(
          accountId,
          new CreateTile({ parent: 'help', slot: 1, ...content }, unchecked),
        ),
        Mapping.createTile(
          accountId,
          new CreateTile(
            { parent: 'help/3', slot: -2, title: '', preview: '', body: '' },
            unchecked,
          ),
        ),
        Mapping.editTile(accountId, new EditTile({ id: 'help/3', title: 'Mine' }, unchecked)),
        Mapping.moveTile(
          accountId,
          new MoveTile({ id: 'help/3', parent: root.id, slot: 2 }, unchecked),
        ),
        Mapping.moveTile(
          accountId,
          new MoveTile({ id: own.id, parent: 'help/3', slot: 2 }, unchecked),
        ),
        Mapping.swapTiles(accountId, new SwapTiles({ a: own.id, b: 'help/3' }, unchecked)),
        Mapping.swapTiles(accountId, new SwapTiles({ a: 'help/-1', b: own.id }, unchecked)),
        Mapping.deleteTile(accountId, new DeleteTile({ id: 'help/6/2' }, unchecked)),
        Mapping.deleteTile(accountId, new DeleteTile({ id: 'help/../../x' }, unchecked)),
        Mapping.createReference(
          accountId,
          new CreateReference({ parent: own.id, slot: -1, target: 'help/2' }, unchecked),
        ),
        Mapping.createReference(
          accountId,
          new CreateReference({ parent: 'help', slot: -2, target: own.id }, unchecked),
        ),
        Mapping.deleteReference(
          accountId,
          new DeleteReference({ parent: 'help', slot: -1 }, unchecked),
        ),
      ]
      for (const attempt of attempts) {
        expect(yield* Effect.flip(transactional(attempt))).toMatchObject({
          _tag: 'HelpReadOnly',
          kind: 'Forbidden',
        })
      }
      const after = systemOf(yield* Mapping.system(accountId))
      expect(after.branches[1]).toMatchObject({ id: own.id, title: 'Own', context: {} })
    }),
  )
})

describe('a vault folder read as Tiles', () => {
  it('names each Tile by the slots of its folders: a Child by its Direction, Context below zero', () => {
    const { rows, problems } = vaultOf(
      'help',
      {
        '': note('Root'),
        '2-tiles': note('Tiles'),
        '2-tiles/.4-why': note('Why'),
      },
      'CLAUDE.md',
    )
    expect(problems).toEqual([])
    expect(rows.map(({ id, parentId, direction }) => [id, parentId, direction])).toEqual([
      ['help', null, null],
      ['help/2', 'help', 2],
      ['help/2/-4', 'help/2', -4],
    ])
  })

  it('names every folder that reads as no Tile, and why', () => {
    const { rows, problems } = vaultOf(
      'help',
      {
        '': note('Root'),
        '1-bare': '# No frontmatter',
        '2-long': note('Long', 'x'.repeat(previewLimit + 1)),
        '3-missing': undefined,
        '3-missing/1-orphan': note('Orphan'),
        '4-twin': note('Twin'),
        '4-other-twin': note('Other twin'),
        '5-untitled': '---\nparent: help\nowner: diplo\npreview: Short.\n---\n',
        notes: note('Unnumbered'),
      },
      'CLAUDE.md',
    )
    expect(problems).toEqual([
      '1-bare: its CLAUDE.md opens with no frontmatter',
      '2-long: its CLAUDE.md has a Preview over 350 characters',
      '3-missing: no CLAUDE.md',
      '4-twin: another folder already stands in its slot',
      '5-untitled: its CLAUDE.md has no title',
      'notes: a folder is named <n>-<slug> for a Child, .<n>-<slug> for Context',
      'help/3/1: the folder above it reads as no Tile',
    ])
    expect(rows.map(({ id }) => id)).toEqual(['help', 'help/3/1', 'help/4'])
  })

  it('names the folder of a note the import’s reading refuses, which Help’s own rules let pass', () => {
    const { rows, problems } = vaultOf(
      'help',
      { '': note('Root'), '1-long': note('x'.repeat(1_001), 'Long.'), '2-flow': note('a: b') },
      'CLAUDE.md',
    )
    expect(problems).toEqual([
      '1-long: its CLAUDE.md reads as no Tile: TitleTooLong',
      '2-flow: its CLAUDE.md reads as no Tile: FrontmatterInvalid',
    ])
    expect(rows).toEqual([])
  })

  it('finds no Root in a folder whose own note reads as none', () => {
    expect(vaultOf('help', { '': undefined }, 'CLAUDE.md').problems).toEqual([
      '.: no CLAUDE.md',
      '.: the Root reads as no Tile',
    ])
  })
})
