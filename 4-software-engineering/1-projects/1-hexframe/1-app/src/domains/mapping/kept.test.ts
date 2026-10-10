import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import { expectTypeOf } from 'vitest'

import { Bus } from '#/domains/bus'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'
import type { TileConfigColumn } from '#/repositories/database/schema'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import {
  configured,
  Frontmatter,
  named,
  type StoredConfig,
  systemOf,
  type ToKeep,
} from './entities'
import { exportOf } from './files/files'
import * as Mapping from './mapping'
import { CreateTile, EditTile, MoveTile, SwapTiles } from './operations'

// What a Tile keeps from the files it was imported from, over PGlite: a Tile keeps them through an
// edit, a move and a swap, and a read gives them back. The checks themselves, on values made by hand,
// are in `entities/kept/kept.test.ts`.

/** The Account's System, read flat, as its tree: what the canvas draws, as the client builds it. */
const tree = (accountId: string) => Effect.map(Mapping.system(accountId), systemOf)

/** The bus, as Mapping publishes on it: these tests hear nothing it publishes. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

const TestTiles = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), Unheard)

/** A create as the API layer runs it, in a transaction, with what an import alone keeps beside it. */
const createTile = (
  accountId: string,
  { name, config, frontmatter, ...fields }: Omit<CreateTile, '_tag'> & ToKeep,
) =>
  transactional(
    Mapping.createTile(accountId, new CreateTile(fields), { name, config, frontmatter }),
  )

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

layer(TestTiles)('what a Tile keeps, over the tiles repository', (it) => {
  /** An Account's System, read once so its Root exists, and its Root. */
  const aSystem = Effect.gen(function* () {
    const accountId = crypto.randomUUID()
    const root = yield* tree(accountId)
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
      yield* transactional(
        Mapping.editTile(accountId, new EditTile({ id: kept.id, version: 1, title: 'The stack' })),
      )
      yield* transactional(
        Mapping.moveTile(
          accountId,
          new MoveTile({ id: kept.id, version: 2, parent: root.id, slot: 3 }),
        ),
      )
      expect((yield* tree(accountId)).branches[3]).toMatchObject({ title: 'The stack', name })
      yield* transactional(
        Mapping.swapTiles(
          accountId,
          new SwapTiles({ a: kept.id, aVersion: 3, b: other.id, bVersion: 1 }),
        ),
      )
      const after = yield* tree(accountId)
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
      yield* createTile(accountId, { parent: group.id, slot: 1, ...content('Do') })
      const read = yield* tree(accountId)
      expect(read.branches[1]).toMatchObject({ config: { fileName: 'SKILL.md' } })
      // The default file name at the Root, the one `skills` sets below it, and its folder pattern
      // below `ship`; `skills` is named by the stem of the Name it kept, its leading dot dropped.
      expect(exportOf(read, root.id, () => '')?.files.map(({ path }) => path)).toEqual([
        'CLAUDE.md',
        'skills/SKILL.md',
        'skills/.hexframe/config.yaml',
        'skills/4-ship/SKILL.md',
        'skills/4-ship/.hexframe/config.yaml',
        'skills/4-ship/do/SKILL.md',
      ])
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
      yield* transactional(
        Mapping.editTile(
          accountId,
          new EditTile({ id: tile.id, version: 1, ...content('Do a ticket') }),
        ),
      )
      const read = (yield* tree(accountId)).context[-2]
      expect(read).toMatchObject({
        title: 'Do a ticket',
        name: 'do-ticket',
        config: { fileName: 'SKILL.md' },
        frontmatter: given,
      })
      // In the order the file gave them, which a store sorting keys by length would lose.
      const kept = read?._tag === 'Tile' ? read.frontmatter : undefined
      expect(Object.keys(kept ?? {})).toEqual(['owner', 'description', 'weight', 'draft'])
    }),
  )

  it.effect('stores nothing it was not given', () =>
    Effect.gen(function* () {
      const { accountId, root } = yield* aSystem
      yield* createTile(accountId, { parent: root.id, slot: 5, ...content('Plain') })
      const plain = (yield* tree(accountId)).branches[5]
      for (const part of ['name', 'config', 'frontmatter']) expect(plain).not.toHaveProperty(part)
    }),
  )

  it('stores only what was checked: a write takes a decoded Name, Tile config and Frontmatter', () => {
    type Given = NonNullable<Parameters<typeof Mapping.createTile>[2]>
    expectTypeOf<string>().not.toExtend<NonNullable<Given['name']>>()
    expectTypeOf<{ fileName: string }>().not.toExtend<NonNullable<Given['config']>>()
    expectTypeOf<Record<string, string>>().not.toExtend<NonNullable<Given['frontmatter']>>()
  })
})

describe('a Tile config, as Mapping and the tiles repository each declare it', () => {
  it('names the same parts on both sides, so a part added to the column is a part Mapping checks', () => {
    expectTypeOf<keyof StoredConfig>().toEqualTypeOf<keyof TileConfigColumn>()
  })
})
