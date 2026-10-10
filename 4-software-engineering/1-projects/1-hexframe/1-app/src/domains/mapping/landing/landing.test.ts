import { expect, layer } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { Bus } from '#/domains/bus'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import { Tiles, layer as tilesLayer } from '#/repositories/database/tiles/tiles'
import { archiveOf } from '#/repositories/zip/testing'
import { layer as zipLayer } from '#/repositories/zip/zip'

import type { IdOfLink } from '../files/import/plan'
import { helpRoot } from '../help/help'
import { type SystemTile, systemOf } from '../entities'
import * as Mapping from '../mapping'
import { CreateTile, EditTile } from '../operations'
import { type ImportPlace, importTiles, planImport } from './landing'

// An import landed in a System over PGlite, as the API layer runs it: the plan read outside any
// transaction, then landed in one. Into a Branch, a Leaf and a Context slot, as the Root of an empty
// System; refused into Help, into a taken slot, a folder into a Leaf slot; References inside, by link
// to this System, to another's and to nothing; nothing written when refused; two copies for two.

/** The Account's System, read flat, as its tree: what the canvas draws, as the client builds it. */
const tree = (accountId: string) => Effect.map(Mapping.system(accountId), systemOf)

/** The bus, as Mapping publishes on it: these tests hear nothing it publishes. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

const TestLayers = Layer.mergeAll(
  tilesLayer.pipe(Layer.provideMerge(TestDatabase)),
  zipLayer,
  Unheard,
)

const noLink: IdOfLink = () => undefined

/** A vault's files: a Root with a Branch holding a Leaf, a Leaf, a Context Tile and a Reference. */
const vault = {
  'CLAUDE.md': '---\ntitle: Vault\npreview: The vault.\nowner: diplo\n---\n\nThe body.\n',
  '1-games/CLAUDE.md': '---\ntitle: Games\npreview: Games, in short.\n---\n\nPlay.\n',
  '1-games/notes.md': '---\ntitle: Notes\n---\n\nNoted.\n',
  '2-tools.md': '---\ntitle: Tools\n---\n\nTooled.\n',
  '.1-principles/CLAUDE.md': '---\ntitle: Principles\n---\n\nHeld.\n',
  '.2-games/CLAUDE.md': '---\ntitle: Games\nreference: "[[1-games/CLAUDE]]"\n---\n',
}

/** The plan for these files, zipped as `vault.zip`. */
const planOf = (files: Readonly<Record<string, string>>, link = noLink) =>
  planImport({ as: 'Zip', name: 'vault.zip', bytes: archiveOf(files) }, link)

/** The plan for one file alone. */
const planOfFile = (name: string, text: string) =>
  planImport({ as: 'File', name, bytes: new TextEncoder().encode(text) }, noLink)

/** These files planned, then landed in their own transaction, as the API layer runs an import. */
const land = (
  accountId: string,
  place: ImportPlace,
  files: Readonly<Record<string, string>> = vault,
  link = noLink,
) =>
  Effect.flatMap(planOf(files, link), (plan) =>
    transactional(importTiles(accountId, { plan, place })),
  )

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** An Account no other test uses, its System read once so its Root exists. */
const someone = Effect.gen(function* () {
  const accountId = crypto.randomUUID()
  const root = yield* tree(accountId)
  return { accountId, root }
})

/** Every id of a System's Tiles, the Root's included. */
function idsOf(tile: SystemTile): Array<string> {
  const below = [
    ...Object.values(tile.branches),
    ...Object.values(tile.context).filter((held) => held._tag === 'Tile'),
  ]
  return [tile.id, ...Object.values(tile.leaves).map(({ id }) => id), ...below.flatMap(idsOf)]
}

/** The vault as it lands under a Tile: its content, what it keeps, and everything below it. */
const vaultLanded = (tile: SystemTile | undefined) => {
  const games = tile?.branches[1]
  expect(tile).toMatchObject({
    title: 'Vault',
    preview: 'The vault.',
    body: '\nThe body.\n',
    frontmatter: { owner: 'diplo' },
  })
  expect(games).toMatchObject({
    title: 'Games',
    name: '1-games',
    leaves: { 1: { title: 'Notes' } },
  })
  expect(tile?.leaves[2]).toMatchObject({ title: 'Tools', name: '2-tools.md' })
  expect(tile?.context[-1]).toMatchObject({ _tag: 'Tile', title: 'Principles' })
  expect(tile?.context[-2]).toEqual({
    _tag: 'Reference',
    tile: { id: games?.id, title: 'Games', preview: 'Games, in short.', body: '\nPlay.\n' },
  })
}

layer(TestLayers)('an import landed where it was asked, over PGlite', (it) => {
  it.effect(
    'lands in a free Branch slot as a new Tile, its Name the upload’s, with all below',
    () =>
      Effect.gen(function* () {
        const { accountId, root } = yield* someone
        const report = yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: 3 })
        const landed = (yield* tree(accountId)).branches[3]
        vaultLanded(landed)
        expect(landed).toMatchObject({ id: report.id, name: 'vault' })
        expect(report).toEqual({ id: report.id, tiles: 5, references: 1, skipped: [] })
      }),
  )

  it.effect('lands in a free Context slot as a Context Tile', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: -4 })
      const held = (yield* tree(accountId)).context[-4]
      vaultLanded(held?._tag === 'Tile' ? held : undefined)
    }),
  )

  it.effect(
    'lands one file alone in a Leaf slot, and refuses a folder there, writing nothing',
    () =>
      Effect.gen(function* () {
        const { accountId, root } = yield* someone
        const place = { _tag: 'Slot', parent: root.id, slot: { leaf: 2 } } as const
        expect(yield* Effect.flip(land(accountId, place))).toMatchObject({
          _tag: 'LeafHoldsNothing',
        })
        expect(yield* tree(accountId)).toMatchObject({
          branches: {},
          leaves: {},
          context: {},
        })
        const plan = yield* planOfFile('STACK.md', '---\ntitle: Stack\n---\n\nThe stack.\n')
        const report = yield* transactional(importTiles(accountId, { plan, place }))
        expect(report).toMatchObject({ tiles: 1, references: 0 })
        expect((yield* tree(accountId)).leaves[2]).toMatchObject({
          id: report.id,
          title: 'Stack',
          body: '\nThe stack.\n',
          name: 'STACK.md',
        })
      }),
  )

  it.effect('lands as the Root of an empty System, and nowhere a System holds anything', () =>
    Effect.gen(function* () {
      const accountId = crypto.randomUUID()
      // The System was never read: landing adds its Root first.
      const report = yield* land(accountId, { _tag: 'Root' })
      const root = yield* tree(accountId)
      vaultLanded(root)
      expect(root.id).toBe(report.id)
      // The Root now says what the import gave it, one Version on from the empty one it replaced.
      expect(root.version).toBe(2)
      expect(report).toMatchObject({ tiles: 5, references: 1 })
      expect(yield* Effect.flip(land(accountId, { _tag: 'Root' }))).toMatchObject({
        _tag: 'DirectionTaken',
      })
      const named = yield* someone
      yield* transactional(
        Mapping.editTile(
          named.accountId,
          new EditTile({ id: named.root.id, version: 1, title: 'Ulysse' }),
        ),
      )
      expect(yield* Effect.flip(land(named.accountId, { _tag: 'Root' }))).toMatchObject({
        _tag: 'DirectionTaken',
      })
      expect(yield* tree(named.accountId)).toMatchObject({ title: 'Ulysse', branches: {} })
      // An untitled Root holding a Preview or a Body written before its name is no empty System.
      for (const written of [{ preview: 'Me, in short.' }, { body: '# Me' }]) {
        const untitled = yield* someone
        yield* transactional(
          Mapping.editTile(
            untitled.accountId,
            new EditTile({ id: untitled.root.id, version: 1, ...written }),
          ),
        )
        expect(yield* Effect.flip(land(untitled.accountId, { _tag: 'Root' }))).toMatchObject({
          _tag: 'DirectionTaken',
        })
        expect(yield* tree(untitled.accountId)).toMatchObject({ title: '', ...written })
      }
    }),
  )

  it.effect('refuses a slot of Help, which no import writes', () =>
    Effect.gen(function* () {
      const { accountId } = yield* someone
      const place = { _tag: 'Slot', parent: helpRoot, slot: 1 } as const
      expect(yield* Effect.flip(land(accountId, place))).toMatchObject({
        _tag: 'HelpReadOnly',
        kind: 'Forbidden',
      })
    }),
  )

  it.effect('refuses a slot taken since the plan was made, and writes nothing', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      const plan = yield* planOf(vault)
      const taken = yield* transactional(
        Mapping.createTile(
          accountId,
          new CreateTile({ parent: root.id, slot: 4, ...content('First') }),
        ),
      )
      const place = { _tag: 'Slot', parent: root.id, slot: 4 } as const
      expect(
        yield* Effect.flip(transactional(importTiles(accountId, { plan, place }))),
      ).toMatchObject({
        _tag: 'DirectionTaken',
        kind: 'Conflict',
      })
      const after = yield* tree(accountId)
      expect(idsOf(after)).toEqual([root.id, taken.id])
    }),
  )
})

layer(TestLayers)('what an import writes, over PGlite', (it) => {
  it.effect('resolves an app link to a Tile of this System only; anything else lands broken', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      const own = yield* transactional(
        Mapping.createTile(
          accountId,
          new CreateTile({ parent: root.id, slot: 1, ...content('Own') }),
        ),
      )
      const other = yield* someone
      const foreign = yield* transactional(
        Mapping.createTile(
          other.accountId,
          new CreateTile({ parent: other.root.id, slot: 1, ...content('Not') }),
        ),
      )
      const link: IdOfLink = (text) => /^app:(.+)$/.exec(text)?.[1]
      const files = {
        'CLAUDE.md': '---\ntitle: Links\n---\n',
        '.1-own/CLAUDE.md': `---\ntitle: Own\nreference: app:${own.id}\n---\n`,
        '.2-foreign/CLAUDE.md': `---\ntitle: Not\nreference: app:${foreign.id}\n---\n`,
        '.3-nowhere/CLAUDE.md': '---\ntitle: Gone\nreference: "[[nowhere]]"\n---\n',
        '.4-text/CLAUDE.md': '---\ntitle: Text\nreference: just text\n---\n',
      }
      const report = yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: 2 }, files, link)
      expect(report).toMatchObject({ tiles: 1, references: 4 })
      const context = (yield* tree(accountId)).branches[2]?.context
      expect(context?.[-1]).toMatchObject({ _tag: 'Reference', tile: { id: own.id, title: 'Own' } })
      for (const slot of [-2, -3, -4] as const) {
        expect(context?.[slot]).toMatchObject({ _tag: 'BrokenReference' })
      }
      // Nothing of the other Account's Tile is kept, not even its id.
      const rows = yield* Tiles.use((tiles) => tiles.read(accountId, Mapping.untitled))
      expect(rows.some(({ target }) => target === foreign.id)).toBe(false)
    }),
  )

  it.effect('refuses an import at fault with every fault at once, and writes nothing', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      const place = { _tag: 'Slot', parent: root.id, slot: 5 } as const
      const unsafe = { ...vault, '../escape.md': 'x', 'a/./b.md': 'y' }
      expect(yield* Effect.flip(land(accountId, place, unsafe))).toMatchObject({
        _tag: 'ImportRefused',
        kind: 'Invalid',
        faults: [
          { path: '../escape.md', fault: 'DotSegment' },
          { path: 'a/./b.md', fault: 'DotSegment' },
        ],
      })
      const tooLong = { ...vault, '2-tools.md': `---\npreview: ${'x'.repeat(351)}\n---\n` }
      expect(yield* Effect.flip(land(accountId, place, tooLong))).toMatchObject({
        _tag: 'ImportRefused',
        faults: [{ path: '2-tools.md', fault: 'PreviewTooLong' }],
      })
      expect(idsOf(yield* tree(accountId))).toEqual([root.id])
    }),
  )

  it.effect('makes a second copy of the same zip, every Tile new again', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      const first = yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: 1 })
      const second = yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: 2 })
      const after = yield* tree(accountId)
      vaultLanded(after.branches[1])
      vaultLanded(after.branches[2])
      const [one, two] = [after.branches[1], after.branches[2]].map((tile) =>
        tile === undefined ? [] : idsOf(tile),
      )
      expect(first.id).not.toBe(second.id)
      expect(one?.filter((id) => two?.includes(id))).toEqual([])
    }),
  )

  it.effect('lands a large import whole, in several statements, and reports what it skipped', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* someone
      const files: Record<string, string> = { 'CLAUDE.md': '---\ntitle: Big\n---\n' }
      const folders = (prefix: string) => [1, 2, 3, 4, 5, 6].map((n) => `${prefix}${String(n)}-f/`)
      for (const one of folders('')) {
        files[`${one}CLAUDE.md`] = ''
        for (const two of folders(one)) {
          files[`${two}CLAUDE.md`] = ''
          for (const three of folders(two)) {
            files[`${three}CLAUDE.md`] = ''
            for (const n of [1, 2, 3, 4, 5, 6]) files[`${three}${String(n)}-leaf.md`] = 'Leaf'
          }
        }
      }
      files['.DS_Store'] = 'binary-ish'
      const report = yield* land(accountId, { _tag: 'Slot', parent: root.id, slot: 6 }, files)
      expect(report).toMatchObject({
        tiles: 1 + 6 + 36 + 216 + 216 * 6,
        references: 0,
        skipped: [{ path: '.DS_Store', reason: 'DotFile' }],
      })
      const big = (yield* tree(accountId)).branches[6]
      expect(big === undefined ? 0 : idsOf(big).length).toBe(report.tiles)
    }),
  )
})
