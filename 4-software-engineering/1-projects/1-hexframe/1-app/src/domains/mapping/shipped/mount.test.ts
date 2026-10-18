import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import type { Bus } from '#/domains/bus'
import { type InTransaction, transactional } from '#/repositories/database/database'
import type { Tiles } from '#/repositories/database/tiles/tiles'

import { type Actor, anyone, hexframeStar, systemOf } from '../entities'
import * as Mapping from '../mapping'
import { CreateReference, CreateTile, EditTile, MoveTile } from '../operations'
import { grant } from '../sharing/sharing'
import { actingOnOwn, createTile, TestTiles } from '../testing'
import { mountedAt } from './mount'
import { shipped } from './shipped'

// The Systems hexframe ships, mounted under the Hexframe Organization's star, over PGlite, which the
// migrations made with its star (HEX-139): its System read with Help and the tutorial as Children of
// its star, in both languages, signed out too; a Help id held by that star; nobody writing a shipped
// Tile nor changing its Grants, the Organization's admins included, `Shipped`, while they write its
// own Tiles; and a Reference from someone's own Context pinning a Help Tile as any Tile of another
// System.

/** The Title of the shipped Tile of this id in a language, as the build bundled it. */
const titleOf = (language: 'en' | 'fr', id: string) =>
  [...shipped.help[language].rows, ...shipped.tutorial[language].rows].find((row) => row.id === id)
    ?.title

/** Anyone holding a link, on the Hexframe Organization's System. */
const signedOut: Mapping.Acting = { actor: anyone, system: hexframeStar }

/** An admin of the Hexframe Organization, standing for its owner, from a Session. */
const admin = Effect.map(Mapping.ownerOf(hexframeStar), (owner): Mapping.Acting => {
  const account = crypto.randomUUID()
  const actor: Actor = { account, groups: [], owners: [account, owner], session: true }
  return { actor, system: hexframeStar }
})

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: '' })

layer(TestTiles)(
  'the Hexframe Organization’s System, Help and the tutorial mounted in it',
  (it) => {
    it.effect('holds them as Children of its star, in both languages, read signed out', () =>
      Effect.gen(function* () {
        for (const language of ['en', 'fr'] as const) {
          const seen = yield* Mapping.system(signedOut, { language })
          expect(seen.root).toMatchObject({ id: hexframeStar, title: 'Hexframe' })
          expect(seen.tiles.help).toMatchObject({
            parent: hexframeStar,
            slot: mountedAt.help,
            title: titleOf(language, 'help'),
          })
          expect(seen.tiles.tutorial).toMatchObject({
            parent: hexframeStar,
            slot: mountedAt.tutorial,
            title: titleOf(language, 'tutorial'),
          })
          expect(seen.tiles['help/3']).toMatchObject({
            parent: 'help',
            title: titleOf(language, 'help/3'),
          })
          expect(seen.rights.help).toEqual(['read'])
          expect(seen.rights['tutorial/1']).toEqual(['read'])
          const tree = systemOf(seen)
          expect(tree.branches[1]?.branches[3]?.id).toBe('help/3')
        }
        expect(titleOf('fr', 'help/3')).not.toBe(titleOf('en', 'help/3'))
      }),
    )

    it.effect('holds a Help id there, and reads it through its star, signed out too', () =>
      Effect.gen(function* () {
        expect(yield* Mapping.holding('help/3/-1')).toBe(hexframeStar)
        expect(yield* Mapping.holding('tutorial/2')).toBe(hexframeStar)
        const star = yield* Mapping.readTile(signedOut, {
          depth: 1,
          fields: ['title'],
          language: 'fr',
        })
        expect(star.tile.branches?.[mountedAt.help]).toMatchObject({
          id: 'help',
          title: titleOf('fr', 'help'),
        })
        const opened = yield* Mapping.openTile(signedOut, {
          id: 'help',
          fields: ['title'],
          language: 'fr',
        })
        expect(opened.parent).toEqual({ id: hexframeStar, title: 'Hexframe' })
        expect(opened.branches[3]).toMatchObject({ id: 'help/3', title: titleOf('fr', 'help/3') })
        yield* Mapping.ownTile(signedOut, 'help/3')
        yield* Mapping.shownTile(signedOut, 'tutorial')
      }),
    )

    it.effect('lets nobody write a shipped Tile nor change its Grants, its admins included', () =>
      Effect.gen(function* () {
        const asAdmin = yield* admin
        const unchecked = { disableChecks: true }
        const refused: ReadonlyArray<
          Effect.Effect<unknown, { readonly _tag: string }, Tiles | Bus | InTransaction>
        > = [
          Mapping.editTile(
            asAdmin,
            new EditTile({ id: 'help', version: 1, title: 'Mine' }, unchecked),
          ),
          Mapping.createTile(
            asAdmin,
            new CreateTile({ parent: 'help/3', slot: 4, ...content('Mine') }, unchecked),
          ),
          Mapping.moveTile(
            asAdmin,
            new MoveTile({ id: 'tutorial', version: 1, parent: hexframeStar, slot: 6 }, unchecked),
          ),
          grant(asAdmin, { tile: 'help', subject: { _tag: 'Everyone' }, value: 'none' }),
        ]
        for (const change of refused) {
          expect(yield* Effect.flip(transactional(change))).toMatchObject({
            _tag: 'Shipped',
            kind: 'Forbidden',
          })
        }
        expect(yield* Effect.flip(Mapping.agentAt(asAdmin, 'help/3'))).toMatchObject({
          _tag: 'NotAllowed',
        })
        // Its own Tiles are its admins' to write, but in a Direction a mounted System holds.
        const taken = new CreateTile({
          parent: hexframeStar,
          slot: mountedAt.help,
          ...content('A'),
        })
        expect(yield* Effect.flip(transactional(Mapping.createTile(asAdmin, taken)))).toMatchObject(
          {
            _tag: 'DirectionTaken',
          },
        )
        const news = yield* transactional(
          Mapping.createTile(
            asAdmin,
            new CreateTile({ parent: hexframeStar, slot: 4, ...content('News') }),
          ),
        )
        const seen = yield* Mapping.system(asAdmin)
        expect(seen.asOwner).toBe(true)
        expect(seen.tiles[news.id]).toMatchObject({ title: 'News', slot: 4 })
        expect(seen.rights[news.id]).toEqual(['read', 'write', '@'])
        expect(seen.rights.help).toEqual(['read'])
        expect(seen.tiles['help/3']).toMatchObject({ title: titleOf('en', 'help/3') })
      }),
    )

    it.effect('pins a Help Tile from someone’s own Context, as a Tile of another System', () =>
      Effect.gen(function* () {
        const ana = crypto.randomUUID()
        const own = yield* actingOnOwn(ana)
        const notes = yield* createTile(ana, { parent: own.system, slot: 1, ...content('Notes') })
        yield* transactional(
          Mapping.createReference(
            own,
            new CreateReference({ parent: notes.id, parentVersion: 1, slot: -1, target: 'help/3' }),
          ),
        )
        for (const language of ['en', 'fr'] as const) {
          const seen = yield* Mapping.system(own, { language })
          expect(seen.pinned['help/3']).toMatchObject({
            id: 'help/3',
            title: titleOf(language, 'help/3'),
            starTitle: 'Hexframe',
          })
          expect(systemOf(seen, seen.pinned).branches[1]?.context[-1]).toMatchObject({
            _tag: 'Reference',
            tile: { id: 'help/3', title: titleOf(language, 'help/3') },
            elsewhere: { starTitle: 'Hexframe' },
          })
        }
        const opened = yield* Mapping.openTile(own, {
          id: notes.id,
          fields: ['title'],
          language: 'en',
        })
        expect(opened.context[-1]).toMatchObject({ _tag: 'Reference', tile: { id: 'help/3' } })
      }),
    )
  },
)
