import { expect, it, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe } from 'vitest'

import { Bus } from '#/domains/bus'
import { type InTransaction, transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { type Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import * as Mapping from '../mapping'
import { previewLimit, type Row, shippedOf, shippedRoots, systemOf } from '../entities'
import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  type Operation,
  SwapTiles,
} from '../operations'
import { shipped } from './shipped'
import { vaultOf } from './vault'
import { actingOnOwn } from '../testing'

// The Systems hexframe ships, Help and the tutorial, as the build bundles them, read through Mapping's
// `readTile` like a System, and refused to every write; then a vault folder read from notes made by
// hand, and what keeps one from reading as a Tile.

/** The bus, as Mapping publishes on it: these tests hear nothing it publishes. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Unheard)

/** An Account no other test uses. */
const someone = () => crypto.randomUUID()

/**
 * The tutorial's Tile at this id in a language, as the build bundled it: its words are Ulysse's, to
 * change, so the tests read them from there rather than write them out.
 */
const tutorialAt = (language: 'en' | 'fr', id: string) =>
  shipped.tutorial[language].rows.find((row) => row.id === id)

/** Where a Tile stands, whatever it says. */
const placeOf = ({ id, parentId, direction }: Row) => ({ id, parentId, direction })

const note = (title: string, preview = `${title}, in short.`) =>
  `---\ntitle: ${title}\nparent: help\nowner: diplo\npreview: >-\n  ${preview}\n---\n# ${title}\n`

describe('Help, as the build bundles it from the real folder', () => {
  it('reads every folder as a Tile, its id the path of its slots from the Root', () => {
    expect(shipped.help.en.problems).toEqual([])
    const ids = shipped.help.en.rows.map(({ id }) => id)
    expect(ids).toEqual(
      expect.arrayContaining(['help', 'help/-1', 'help/1', 'help/3', 'help/3/-1', 'help/6/2']),
    )
    expect(shipped.help.en.rows.find(({ id }) => id === 'help')).toMatchObject({
      title: 'Hexframe',
      target: null,
      parentId: null,
      direction: null,
    })
    expect(shipped.help.en.rows.find(({ id }) => id === 'help/3/-1')).toMatchObject({
      parentId: 'help/3',
      direction: -1,
    })
  })

  it('reads it in French too, every Tile at the same id, its words translated', () => {
    expect(shipped.help.fr.problems).toEqual([])
    const placeOf = ({ id, parentId, direction }: (typeof shipped.help.fr.rows)[number]) => ({
      id,
      parentId,
      direction,
    })
    expect(shipped.help.fr.rows.map(placeOf)).toEqual(shipped.help.en.rows.map(placeOf))
    expect(shipped.help.fr.rows.find(({ id }) => id === 'help/2')).toMatchObject({
      title: 'Les tuiles',
    })
    expect(shipped.help.en.rows.find(({ id }) => id === 'help/2')).toMatchObject({ title: 'Tiles' })
  })
})

describe('every System Mapping ships, as the build bundles it', () => {
  it('is bundled whole, its Root first, read with no problem, in every language', () => {
    for (const root of shippedRoots) {
      for (const language of ['en', 'fr'] as const) {
        const { rows, problems } = shipped[root][language]
        expect(problems, `${root} in ${language}`).toEqual([])
        expect(rows[0], `${root} in ${language}`).toMatchObject({ id: root, parentId: null })
      }
    }
  })
})

describe('the tutorial, as the build bundles it from the real folder', () => {
  it('reads its Root and its six steps as Tiles, each at the same place in both languages', () => {
    const steps = ([1, 2, 3, 4, 5, 6] as const).map((direction) => ({
      id: `tutorial/${String(direction)}`,
      parentId: 'tutorial',
      direction,
    }))
    expect(shipped.tutorial.en.rows.map(placeOf)).toEqual(
      expect.arrayContaining([{ id: 'tutorial', parentId: null, direction: null }, ...steps]),
    )
    expect(shipped.tutorial.fr.rows.map(placeOf)).toEqual(shipped.tutorial.en.rows.map(placeOf))
  })

  it("takes its words from its own notes, apart from Help's, a Title and a Preview to each Tile", () => {
    for (const language of ['en', 'fr'] as const) {
      for (const { title, preview } of shipped.tutorial[language].rows) {
        expect(title.trim()).not.toBe('')
        expect(preview.trim()).not.toBe('')
      }
    }
    expect(tutorialAt('fr', 'tutorial')?.body).not.toBe(tutorialAt('en', 'tutorial')?.body)
    expect(tutorialAt('en', 'tutorial')?.body).not.toBe(shipped.help.en.rows[0]?.body)
  })

  it('names the System an id is of by its Root, and none for an id of an Account', () => {
    expect(['help', 'help/3/-1', 'tutorial', 'tutorial/2', 'tutorial/../x'].map(shippedOf)).toEqual(
      ['help', 'help', 'tutorial', 'tutorial', 'tutorial'],
    )
    expect([crypto.randomUUID(), 'helper', 'tutorials/1', ''].map(shippedOf)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('a System hexframe ships, whole, as home draws it', () => {
  it.effect('reads Help with everything below it in the language asked, Bodies included', () =>
    Effect.gen(function* () {
      const english = yield* Mapping.shippedSystem('help', 'en')
      const french = yield* Mapping.shippedSystem('help', 'fr')
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

  it.effect('reads the tutorial the same way, its Root with its six steps, in each language', () =>
    Effect.gen(function* () {
      for (const language of ['en', 'fr'] as const) {
        const tutorial = yield* Mapping.shippedSystem('tutorial', language)
        expect(tutorial).toMatchObject({
          _tag: 'Tile',
          id: 'tutorial',
          title: tutorialAt(language, 'tutorial')?.title,
          body: tutorialAt(language, 'tutorial')?.body,
        })
        for (const direction of [1, 2, 3, 4, 5, 6] as const) {
          const id = `tutorial/${String(direction)}`
          expect(tutorial.branches[direction]).toMatchObject({
            id,
            title: tutorialAt(language, id)?.title,
          })
        }
      }
    }),
  )
})

layer(TestTiles)("Help, read through Mapping's readTile", (it) => {
  it.effect('opens its Root with its Children and its Context, to the depth asked', () =>
    Effect.gen(function* () {
      const read = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
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
      const read = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
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
      const read = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
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
        const refused = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
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

layer(TestTiles)("the tutorial, read through Mapping's readTile and openTile", (it) => {
  it.effect('opens its Root with its six steps, in the language asked', () =>
    Effect.gen(function* () {
      const read = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
        language: 'fr',
        id: 'tutorial',
        depth: 1,
        fields: ['title', 'preview'],
      })
      expect(read.parent).toBeNull()
      expect(read.tile).toMatchObject({
        _tag: 'Tile',
        id: 'tutorial',
        title: tutorialAt('fr', 'tutorial')?.title,
      })
      expect(Object.keys(read.tile.branches ?? {})).toEqual(['1', '2', '3', '4', '5', '6'])
      expect(read.tile.branches?.[1]).toMatchObject({
        id: 'tutorial/1',
        title: tutorialAt('fr', 'tutorial/1')?.title,
      })
    }),
  )

  it.effect('opens a step, its Body when asked, its parent named', () =>
    Effect.gen(function* () {
      const opened = yield* Mapping.openTile(yield* actingOnOwn(someone()), {
        language: 'en',
        id: 'tutorial/3',
        fields: ['title', 'body'],
      })
      expect(opened.parent).toEqual({ id: 'tutorial', title: tutorialAt('en', 'tutorial')?.title })
      expect(opened.tile).toMatchObject({
        _tag: 'Tile',
        id: 'tutorial/3',
        title: tutorialAt('en', 'tutorial/3')?.title,
        body: tutorialAt('en', 'tutorial/3')?.body,
      })
    }),
  )

  it.effect('finds no Tile at an id that no slot gives, a path that climbs out included', () =>
    Effect.gen(function* () {
      for (const id of ['tutorial/7', 'tutorial/0', 'tutorial/x', 'tutorial/../help']) {
        const refused = yield* Mapping.readTile(yield* actingOnOwn(someone()), {
          language: 'en',
          id,
          depth: 0,
          fields: ['title'],
        }).pipe(Effect.flip)
        expect(refused, id).toMatchObject({ _tag: 'TileNotFound', kind: 'NotFound' })
      }
    }),
  )
})

/** Operations naming the ids of the System hexframe ships from `root`, `own` a Tile of the Account's. */
function writesTo(root: string, { root: rootOfOwn, own }: { root: string; own: string }) {
  const content = { title: 'Mine', preview: 'Mine.', body: '' }
  // Operations naming a shipped System's ids, which their schemas refuse: built past the checks, as
  // a caller whose schema let them through would, so Mapping is seen refusing them itself.
  const unchecked = { disableChecks: true }
  return [
    new CreateTile({ parent: root, slot: 1, ...content }, unchecked),
    new CreateTile({ parent: `${root}/3`, slot: -2, title: '', preview: '', body: '' }, unchecked),
    new EditTile({ id: `${root}/3`, version: 1, title: 'Mine' }, unchecked),
    new MoveTile({ id: `${root}/3`, version: 1, parent: rootOfOwn, slot: 2 }, unchecked),
    new MoveTile({ id: own, version: 1, parent: `${root}/3`, slot: 2 }, unchecked),
    new SwapTiles({ a: own, aVersion: 1, b: `${root}/3`, bVersion: 1 }, unchecked),
    new SwapTiles({ a: `${root}/-1`, aVersion: 1, b: own, bVersion: 1 }, unchecked),
    new DeleteTile({ id: `${root}/6/2`, version: 1 }, unchecked),
    new DeleteTile({ id: `${root}/../../x`, version: 1 }, unchecked),
    new CreateReference({ parent: root, parentVersion: 1, slot: -2, target: own }, unchecked),
    new DeleteReference({ parent: root, parentVersion: 1, slot: -1 }, unchecked),
  ]
}

/** An Operation run by the service's own function for it, as its server function runs it. */
function run(
  acting: Mapping.Acting,
  operation: Operation,
): Effect.Effect<unknown, { readonly _tag: string }, InTransaction | Tiles | Bus> {
  switch (operation._tag) {
    case 'CreateTile':
      return Mapping.createTile(acting, operation)
    case 'EditTile':
      return Mapping.editTile(acting, operation)
    case 'MoveTile':
      return Mapping.moveTile(acting, operation)
    case 'SwapTiles':
      return Mapping.swapTiles(acting, operation)
    case 'DeleteTile':
      return Mapping.deleteTile(acting, operation)
    case 'CreateReference':
      return Mapping.createReference(acting, operation)
    case 'DeleteReference':
      return Mapping.deleteReference(acting, operation)
  }
}

/** An Account no other test uses, with a Tile of its own under its Root, untouched since. */
const withOwnTile = Effect.gen(function* () {
  const accountId = someone()
  const { root } = yield* Mapping.system(yield* actingOnOwn(accountId))
  const own = yield* transactional(
    Mapping.createTile(
      yield* actingOnOwn(accountId),
      new CreateTile({
        parent: root.id,
        slot: 1,
        title: 'Own',
        preview: 'Own, in short.',
        body: '',
      }),
    ),
  )
  return { accountId, root: root.id, own: own.id }
})

/** What a write refused as a shipped System's is refused with. */
const readOnly = { _tag: 'Shipped', kind: 'Forbidden' }

layer(TestTiles)('the Systems hexframe ships, refused to every write in Mapping itself', (it) => {
  it.effect(
    'refuses each write that names a Tile of Help or of the tutorial, either end of a move',
    () =>
      Effect.gen(function* () {
        const { accountId, root, own } = yield* withOwnTile
        for (const shippedRoot of ['help', 'tutorial']) {
          for (const operation of writesTo(shippedRoot, { root, own })) {
            const refused = yield* Effect.flip(
              transactional(run(yield* actingOnOwn(accountId), operation)),
            )
            expect(refused, `${operation._tag} on ${shippedRoot}`).toMatchObject(readOnly)
          }
        }
        const unchecked = { disableChecks: true }
        const across = new MoveTile(
          { id: 'help/3', version: 1, parent: 'tutorial', slot: 2 },
          unchecked,
        )
        expect(
          yield* Effect.flip(transactional(run(yield* actingOnOwn(accountId), across))),
        ).toMatchObject(readOnly)
        const after = systemOf(yield* Mapping.system(yield* actingOnOwn(accountId)))
        expect(after.branches[1]).toMatchObject({ id: own, title: 'Own', context: {} })
        expect(Object.keys(after.branches)).toEqual(['1'])
      }),
  )

  it.effect('refuses a batch naming a Tile of the tutorial, added to or run whole', () =>
    Effect.gen(function* () {
      const { accountId, own } = yield* withOwnTile
      const unchecked = { disableChecks: true }
      const edit = new EditTile({ id: own, version: 1, title: 'Renamed' })
      const intoTutorial = new MoveTile(
        { id: own, version: 1, parent: 'tutorial/1', slot: 3 },
        unchecked,
      )
      expect(
        yield* Effect.flip(Mapping.addToBatch(yield* actingOnOwn(accountId), [], intoTutorial)),
      ).toMatchObject(readOnly)
      const batch = [{ operation: edit }, { operation: intoTutorial }]
      expect(
        yield* Effect.flip(transactional(Mapping.runBatch(yield* actingOnOwn(accountId), batch))),
      ).toMatchObject(readOnly)
      const after = systemOf(yield* Mapping.system(yield* actingOnOwn(accountId)))
      expect(after.branches[1]).toMatchObject({ id: own, title: 'Own' })
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
