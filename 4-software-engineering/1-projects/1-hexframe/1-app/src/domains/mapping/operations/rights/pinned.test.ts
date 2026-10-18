import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'

import { type Actor, systemOf } from '../../entities'
import * as Mapping from '../../mapping'
import { CreateReference } from '..'
import { actingOnOwn, createTile, editTile, held, TestTiles, tree } from '../../testing'

// A pin, over PGlite: a Reference from a Context slot to a Tile of another System, which its creator
// may read there (HEX-133). Bob pins Ana's Journal, shared with him, sees it from her star, loses
// *read*, and sees it unavailable, as a Reference whose Tile was deleted shows; Carol, reading Bob's
// Tile, who never read Journal, sees the same, with no id; a Tile Bob never read is `TileNotFound`;
// a Turn, bound to its own System, pins nothing; and an export writes the pin as its link. On Systems
// made by hand, what a reader is shown is `../../entities/rights/seen.test.ts`'s.

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Sets Grants on the owner's System, as a Session's write of them does. */
const granting = (owner: string, ...rows: ReadonlyArray<GrantRow>) =>
  transactional(Effect.forEach(rows, (row) => granted(owner, row), { discard: true }))

/** A Grant on one of the owner's Tiles for an Account. */
const toAccount = (tile: string, account: string, value: GrantRow['value']): GrantRow => ({
  tile,
  subject: 'account',
  subjectId: account,
  value,
})

/**
 * Ana's System, her star titled, `Journal` shared with Bob to read and `Garden` kept to herself; and
 * Bob's, his star, `Desk` and Bob's Version of `Desk`, which the pin's create names.
 */
const scenario = Effect.gen(function* () {
  const ana = crypto.randomUUID()
  const anaStar = (yield* tree(ana)).id
  yield* editTile(ana, anaStar, content('Ana'))
  const journal = yield* createTile(ana, { parent: anaStar, slot: 1, ...content('Journal') })
  const garden = yield* createTile(ana, { parent: anaStar, slot: 2, ...content('Garden') })
  const bob = crypto.randomUUID()
  const bobStar = (yield* tree(bob)).id
  const desk = yield* createTile(bob, { parent: bobStar, slot: 1, ...content('Desk') })
  yield* granting(ana, toAccount(journal.id, bob, 'read'))
  return { ana, journal, garden, bob, desk }
})

/** A Reference's create in a Context slot of the Tile, at the Version it has. */
const pin = (parent: { id: string; version: number }, target: string, slot = -1 as const) =>
  new CreateReference({ parent: parent.id, parentVersion: parent.version, slot, target })

/** What Bob's own read shows in Desk's Context slot −1, on the canvas and through the MCP's reads. */
const shownToBob = (bob: string, desk: string) =>
  Effect.gen(function* () {
    const acting = yield* actingOnOwn(bob)
    const seen = yield* Mapping.system(acting)
    const opened = yield* Mapping.openTile(acting, { id: desk, fields: ['title'], language: 'en' })
    return {
      seen,
      drawn: systemOf(seen, seen.pinned).branches[1]?.context[-1],
      opened: opened.context[-1],
    }
  })

layer(TestTiles)('a pin, a Reference to a Tile of another System, over PGlite', (it) => {
  it.effect('lets Bob pin Journal, which he reads, and shows it him from Ana’s star', () =>
    Effect.gen(function* () {
      const { journal, bob, desk } = yield* scenario
      yield* transactional(Mapping.createReference(yield* actingOnOwn(bob), pin(desk, journal.id)))
      const { seen, drawn, opened } = yield* shownToBob(bob, desk.id)
      const tile = { id: journal.id, title: 'Journal', preview: 'Journal, in short.' }
      expect(seen.pinned).toEqual({ [journal.id]: { ...tile, star: 'Ana' } })
      expect(drawn).toEqual({
        _tag: 'Reference',
        tile: { ...tile, body: '' },
        elsewhere: { star: 'Ana' },
      })
      expect(opened).toEqual({ _tag: 'Reference', tile, elsewhere: { star: 'Ana' } })
    }),
  )

  it.effect('shows it unavailable once Bob loses read, as a Reference to a deleted Tile', () =>
    Effect.gen(function* () {
      const { ana, journal, bob, desk } = yield* scenario
      yield* transactional(Mapping.createReference(yield* actingOnOwn(bob), pin(desk, journal.id)))
      yield* granting(ana, toAccount(journal.id, bob, 'none'))
      const { seen, drawn, opened } = yield* shownToBob(bob, desk.id)
      // His own, as he stored it: the id he pinned, nothing more of the Tile.
      expect(seen.pinned).toEqual({})
      expect(drawn).toEqual({ _tag: 'BrokenReference', target: journal.id })
      expect(opened).toEqual({ _tag: 'BrokenReference', target: journal.id })
      expect(JSON.stringify(seen)).not.toContain('Journal')
    }),
  )

  it.effect(
    'shows Carol, reading Desk, what Bob loses: Journal while she may read it, else no id',
    () =>
      Effect.gen(function* () {
        const { ana, journal, bob, desk } = yield* scenario
        const bobs = yield* actingOnOwn(bob)
        yield* transactional(Mapping.createReference(bobs, pin(desk, journal.id)))
        const carol = crypto.randomUUID()
        yield* granting(bob, toAccount(desk.id, carol, 'read'))
        const actor: Actor = { account: carol, groups: [], owners: [carol], session: true }
        const onDesk = { actor, system: bobs.system }
        const opened = () =>
          Effect.map(
            Mapping.openTile(onDesk, { id: desk.id, fields: ['title'], language: 'en' }),
            ({ context }) => context[-1],
          )
        // Carol never read Journal: unavailable, and its id is nowhere.
        const never = yield* Mapping.system(onDesk)
        expect(Object.values(never.tiles)).toContainEqual(expect.objectContaining({ target: '' }))
        expect(JSON.stringify(never)).not.toContain(journal.id)
        expect(yield* opened()).toEqual({ _tag: 'BrokenReference', target: '' })
        // Shared with her, she reads it there.
        yield* granting(ana, toAccount(journal.id, carol, 'read'))
        expect(yield* opened()).toMatchObject({
          tile: { title: 'Journal' },
          elsewhere: { star: 'Ana' },
        })
      }),
  )

  it.effect('refuses a pin of a Tile Bob never read TileNotFound, writing nothing', () =>
    Effect.gen(function* () {
      const { garden, bob, desk } = yield* scenario
      const before = yield* held(bob)
      const refused = Mapping.createReference(yield* actingOnOwn(bob), pin(desk, garden.id))
      expect(yield* Effect.flip(transactional(refused))).toMatchObject({ _tag: 'TileNotFound' })
      // As for an id no System holds.
      const nowhere = Mapping.createReference(
        yield* actingOnOwn(bob),
        pin(desk, crypto.randomUUID()),
      )
      expect(yield* Effect.flip(transactional(nowhere))).toMatchObject({ _tag: 'TileNotFound' })
      expect(yield* held(bob)).toEqual(before)
    }),
  )

  it.effect('pins nothing for a Turn, which reads and writes the System it started in alone', () =>
    Effect.gen(function* () {
      const { journal, bob, desk } = yield* scenario
      const bobs = yield* actingOnOwn(bob)
      const turns = { ...bobs, actor: { ...bobs.actor, session: false } }
      const applied = Mapping.runOperation(turns, pin(desk, journal.id), undefined)
      expect(yield* Effect.flip(transactional(applied))).toMatchObject({ _tag: 'TileNotFound' })
      const drafted = Mapping.addToBatch(turns, [], pin(desk, journal.id))
      expect(yield* Effect.flip(drafted)).toMatchObject({ _tag: 'TileNotFound' })
      // A pin Bob made shows unavailable to a read that resolves none, as a Turn's Key reads.
      yield* transactional(Mapping.createReference(bobs, pin(desk, journal.id)))
      const opened = yield* Mapping.openTile(bobs, {
        id: desk.id,
        fields: ['title'],
        language: 'en',
        across: false,
      })
      expect(opened.context[-1]).toEqual({ _tag: 'BrokenReference', target: journal.id })
    }),
  )

  it.effect('lets someone writing in Bob’s System pin a Tile they read, undoably', () =>
    Effect.gen(function* () {
      const { ana, journal, bob, desk } = yield* scenario
      yield* granting(bob, toAccount(desk.id, ana, 'read+write'))
      const actor: Actor = { account: ana, groups: [], owners: [ana], session: true }
      const bobsStar = (yield* actingOnOwn(bob)).system
      const ran = yield* transactional(
        Mapping.runUndoable({ actor, system: bobsStar }, pin(desk, journal.id)),
      )
      expect(ran.change).toMatchObject({ verb: 'ReferenceCreated' })
      const { drawn } = yield* shownToBob(bob, desk.id)
      // Bob may read Journal, shared with him: he sees what Ana pinned.
      expect(drawn).toMatchObject({ tile: { title: 'Journal' }, elsewhere: { star: 'Ana' } })
    }),
  )

  it.effect('exports a pin as its link in the app, the Tile it points at in no file', () =>
    Effect.gen(function* () {
      const { journal, bob, desk } = yield* scenario
      const bobs = yield* actingOnOwn(bob)
      yield* transactional(Mapping.createReference(bobs, pin(desk, journal.id)))
      const link = (id: string) => `https://hexframe.test/t/${id}`
      const { files } = yield* Mapping.systemFiles(bobs, link)
      const pinned = files.find((file) => file.content.includes('reference:'))
      expect(pinned?.content).toContain(`reference: ${link(journal.id)}`)
      expect(JSON.stringify(files)).not.toContain('Journal, in short.')
    }),
  )
})
