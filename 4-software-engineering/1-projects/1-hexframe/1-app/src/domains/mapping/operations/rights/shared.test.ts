import { expect, layer } from '@effect/vitest'
import { Effect, Exit } from 'effect'

import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'
import { Tiles } from '#/repositories/database/tiles/tiles'

import type { Actor } from '../../entities'
import * as Mapping from '../../mapping'
import { DeleteTile, EditTile, MoveTile } from '..'
import { createTile, readTile, TestTiles, tree } from '../../testing'

// A System shared by its Grants, over PGlite: every read and every change of Mapping's service asking
// `may`, from the Grants the tiles repository keeps, on the grill's scenario. Ana's star lets Everyone
// read it, `Journal` sets Everyone to none, and the Group `Family`, Bob's, reads the star. How Grants
// resolve is `../../entities/rights/rights.test.ts`'s; what each Operation needs, `./may.test.ts`'s.

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Sets Grants on the owner's System, as a Session's write of them will. */
const granting = (owner: string, ...rows: ReadonlyArray<GrantRow>) =>
  transactional(Effect.forEach(rows, (row) => granted(owner, row), { discard: true }))

/** Someone acting on Ana's System who doesn't own it, in these Groups. */
const visitor = (system: string, groups: ReadonlyArray<string> = []): Mapping.Acting => {
  const account = crypto.randomUUID()
  const actor: Actor = { account, groups, owners: [account], session: true }
  return { actor, system }
}

/** Ana's System as the grill tells it: her star, `Journal` with an `Entry` below it, and `Garden`. */
const scenario = Effect.gen(function* () {
  const ana = crypto.randomUUID()
  const star = (yield* tree(ana)).id
  const journal = yield* createTile(ana, { parent: star, slot: 1, ...content('Journal') })
  const entry = yield* createTile(ana, { parent: journal.id, slot: 1, ...content('Entry') })
  const garden = yield* createTile(ana, { parent: star, slot: 2, ...content('Garden') })
  yield* granting(
    ana,
    { tile: star, subject: 'everyone', subjectId: null, value: 'read' },
    { tile: journal.id, subject: 'everyone', subjectId: null, value: 'none' },
    { tile: star, subject: 'group', subjectId: 'family', value: 'read' },
  )
  return { ana, star, journal, entry, garden }
})

/** A read of one Tile, by its Title, as the actor may read it. */
const titled = (acting: Mapping.Acting, id: string) =>
  Effect.map(
    Mapping.readTile(acting, { id, depth: 1, fields: ['title'], language: 'en' }),
    ({ tile }) => tile,
  )

/** A change run as the API layer runs it, in the transaction it opens. */
const changed = transactional

layer(TestTiles)('a System shared by its Grants, read, over PGlite', (it) => {
  it.effect('lets Bob, in Family, read Journal, and keeps it from a stranger', () =>
    Effect.gen(function* () {
      const { star, journal, entry } = yield* scenario
      const bob = visitor(star, ['family'])
      expect(yield* titled(bob, journal.id)).toMatchObject({
        title: 'Journal',
        branches: { 1: { title: 'Entry' } },
      })
      const stranger = visitor(star)
      for (const hidden of [journal.id, entry.id]) {
        expect(yield* Effect.flip(titled(stranger, hidden))).toMatchObject({
          _tag: 'TileNotFound',
        })
      }
      const fromStar = yield* titled(stranger, star)
      expect(fromStar).toMatchObject({ branches: { 2: { title: 'Garden' } } })
      expect(fromStar.branches?.[1]).toBeUndefined()
      expect(yield* Mapping.titles(stranger, [journal.id, star])).toEqual({ [star]: '' })
      expect(yield* Mapping.titles(bob, [journal.id])).toEqual({ [journal.id]: 'Journal' })
    }),
  )

  it.effect('gives nobody but the owner anything of a star with no Grant', () =>
    Effect.gen(function* () {
      const ana = crypto.randomUUID()
      const star = (yield* tree(ana)).id
      const child = yield* createTile(ana, { parent: star, slot: 1, ...content('Mine') })
      for (const acting of [visitor(star), visitor(star, ['family'])]) {
        expect(yield* Effect.flip(titled(acting, child.id))).toMatchObject({ _tag: 'TileNotFound' })
        expect(yield* Mapping.glimpses(acting, [star, child.id])).toEqual([])
      }
      expect(
        (yield* readTile(ana, { id: child.id, depth: 0, fields: ['title'] })).tile,
      ).toMatchObject({ title: 'Mine' })
    }),
  )
})

layer(TestTiles)('a System shared by its Grants, changed, over PGlite', (it) => {
  it.effect('refuses a write the reader may not make NotAllowed, and lets a writer make it', () =>
    Effect.gen(function* () {
      const { ana, star, journal } = yield* scenario
      const bob = visitor(star, ['family'])
      const edit = new EditTile({ id: journal.id, version: 1, title: 'Bob’s now' })
      expect(yield* Effect.flip(changed(Mapping.editTile(bob, edit)))).toMatchObject({
        _tag: 'NotAllowed',
        kind: 'Forbidden',
      })
      expect(yield* Effect.flip(changed(Mapping.editTile(visitor(star), edit)))).toMatchObject({
        _tag: 'TileNotFound',
      })
      yield* granting(ana, {
        tile: journal.id,
        subject: 'account',
        subjectId: bob.actor.account,
        value: 'read+write',
      })
      expect(yield* changed(Mapping.editTile(bob, edit))).toMatchObject({ title: 'Bob’s now' })
    }),
  )

  it.effect('refuses a delete over a subtree holding a Tile set to none for the actor', () =>
    Effect.gen(function* () {
      const { ana, star, journal, entry } = yield* scenario
      const bob = visitor(star)
      const asBob = { subject: 'account', subjectId: bob.actor.account } as const
      yield* granting(
        ana,
        { tile: star, ...asBob, value: 'read+write' },
        { tile: entry.id, ...asBob, value: 'none' },
      )
      const deletion = new DeleteTile({ id: journal.id, version: 1 })
      expect(yield* Effect.flip(changed(Mapping.deleteTile(bob, deletion)))).toMatchObject({
        _tag: 'NotAllowed',
      })
      expect(yield* titled(bob, journal.id)).toMatchObject({ title: 'Journal' })
    }),
  )

  it.effect(
    'refuses Bob’s move of an inheriting Tile under a public parent, and lets Ana’s through',
    () =>
      Effect.gen(function* () {
        const { ana, star, entry, garden } = yield* scenario
        const bob = visitor(star)
        yield* granting(ana, {
          tile: star,
          subject: 'account',
          subjectId: bob.actor.account,
          value: 'read+write',
        })
        // Under Garden, Entry would inherit Everyone's read from the star, where Journal keeps it none.
        const opening = new MoveTile({ id: entry.id, version: 1, parent: garden.id, slot: 1 })
        expect(yield* Effect.flip(changed(Mapping.moveTile(bob, opening)))).toMatchObject({
          _tag: 'NotAllowed',
        })
        const anaByKey: Mapping.Acting = {
          actor: { account: ana, groups: [], owners: [ana], session: false },
          system: star,
        }
        expect(yield* Effect.flip(changed(Mapping.moveTile(anaByKey, opening)))).toMatchObject({
          _tag: 'NotAllowed',
        })
        yield* changed(
          Mapping.moveTile({ ...anaByKey, actor: { ...anaByKey.actor, session: true } }, opening),
        )
        expect(yield* titled(visitor(star), entry.id)).toMatchObject({ title: 'Entry' })
      }),
  )
})

layer(TestTiles)('a System shared by its Grants, batched, moved and deleted, over PGlite', (it) => {
  it.effect(
    'refuses a batch its owner adds to or runs without a Session when it opens a Tile',
    () =>
      Effect.gen(function* () {
        const { ana, star, entry, garden } = yield* scenario
        const byKey: Mapping.Acting = {
          actor: { account: ana, groups: [], owners: [ana], session: false },
          system: star,
        }
        const fromSession = { ...byKey, actor: { ...byKey.actor, session: true } }
        const opening = new MoveTile({ id: entry.id, version: 1, parent: garden.id, slot: 1 })
        expect(yield* Effect.flip(Mapping.addToBatch(byKey, [], opening))).toMatchObject({
          _tag: 'NotAllowed',
        })
        const { batched } = yield* Mapping.addToBatch(fromSession, [], opening)
        expect(yield* Effect.flip(changed(Mapping.runBatch(byKey, [batched])))).toMatchObject({
          _tag: 'NotAllowed',
        })
        expect(yield* Effect.flip(titled(visitor(star), entry.id))).toMatchObject({
          _tag: 'TileNotFound',
        })
        yield* changed(Mapping.runBatch(fromSession, [batched]))
        expect(yield* titled(visitor(star), entry.id)).toMatchObject({ title: 'Entry' })
      }),
  )

  it.effect('undoes a batch that kept a Tile from someone only for its owner from a Session', () =>
    Effect.gen(function* () {
      const { ana, star, garden, journal } = yield* scenario
      const fromSession: Mapping.Acting = {
        actor: { account: ana, groups: [], owners: [ana], session: true },
        system: star,
      }
      const byKey = { ...fromSession, actor: { ...fromSession.actor, session: false } }
      // Under Journal, Garden is kept from Everyone; its undo would open it again.
      const keeping = new MoveTile({ id: garden.id, version: 1, parent: journal.id, slot: 2 })
      const { batched } = yield* Mapping.addToBatch(byKey, [], keeping)
      const { undo } = yield* changed(Mapping.runBatch(byKey, [batched]))
      expect(yield* Effect.flip(changed(Mapping.undo(byKey, undo)))).toMatchObject({
        _tag: 'NotAllowed',
      })
      yield* changed(Mapping.undo(fromSession, undo))
      expect(yield* titled(visitor(star), garden.id)).toMatchObject({ title: 'Garden' })
    }),
  )

  it.effect(
    'refuses a delete without a Session of a Tile carrying a Grant, which no undo puts back',
    () =>
      Effect.gen(function* () {
        const { ana, star, journal } = yield* scenario
        const byKey: Mapping.Acting = {
          actor: { account: ana, groups: [], owners: [ana], session: false },
          system: star,
        }
        const deletion = new DeleteTile({ id: journal.id, version: 1 })
        expect(yield* Effect.flip(changed(Mapping.deleteTile(byKey, deletion)))).toMatchObject({
          _tag: 'NotAllowed',
        })
        expect(yield* Effect.flip(Mapping.addToBatch(byKey, [], deletion))).toMatchObject({
          _tag: 'NotAllowed',
        })
        expect(yield* titled(byKey, journal.id)).toMatchObject({ title: 'Journal' })
      }),
  )

  it.effect('refuses a move without write on the parent it lands under', () =>
    Effect.gen(function* () {
      const { ana, star, journal, entry, garden } = yield* scenario
      const bob = visitor(star, ['family'])
      yield* granting(ana, {
        tile: journal.id,
        subject: 'account',
        subjectId: bob.actor.account,
        value: 'read+write',
      })
      const away = new MoveTile({ id: entry.id, version: 1, parent: garden.id, slot: 1 })
      expect(yield* Effect.flip(changed(Mapping.moveTile(bob, away)))).toMatchObject({
        _tag: 'NotAllowed',
      })
      const within = new MoveTile({ id: entry.id, version: 1, parent: journal.id, slot: 4 })
      yield* changed(Mapping.moveTile(bob, within))
      expect(yield* titled(bob, journal.id)).toMatchObject({
        branches: { 4: { title: 'Entry' } },
      })
    }),
  )

  it.effect(
    'deletes a Tile’s Grants with it, and keeps no Grant giving Everyone more than read',
    () =>
      Effect.gen(function* () {
        const { ana, star, journal } = yield* scenario
        yield* changed(
          Mapping.deleteTile(
            { actor: { account: ana, groups: [], owners: [ana], session: true }, system: star },
            new DeleteTile({ id: journal.id, version: 1 }),
          ),
        )
        const kept = yield* Tiles.use((tiles) => tiles.grants(ana))
        expect(kept.map(({ tile }) => tile)).toEqual([star, star])
        const exit = yield* Effect.exit(
          granting(ana, {
            tile: star,
            subject: 'everyone',
            subjectId: null,
            value: 'read+write',
          }),
        )
        expect(Exit.hasDies(exit)).toBe(true)
      }),
  )
})
