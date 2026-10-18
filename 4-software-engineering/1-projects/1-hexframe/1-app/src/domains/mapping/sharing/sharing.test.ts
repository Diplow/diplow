import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { Bus, type DomainEvent } from '#/domains/bus'
import { transactional } from '#/repositories/database/database'

import type { Actor, Choice } from '../entities'
import * as Mapping from '../mapping'
import { actingOnOwn, createReference, createTile, held, TestTiles, tree } from '../testing'
import { grant, TileShared, whoReaches } from './sharing'

// Who reaches a Tile, set and read by its owner over PGlite: Everyone set to read on a Tile, then to
// none below it, then back to inherit, each read back with where it comes from and seen by a
// stranger; an Account named by its star given any value, reading what it opens, told once when a
// Grant first opens a Tile to them and never by a change after, listed by its star's card; nobody
// else, nor the owner without a Session, changing or reading it; no shipped Tile, no Reference, no
// star that names nothing, no Tile that is no star, nor the owner's own; and no count of the
// System's changes moved. Who reaches, on a System made by hand, is
// `../entities/rights/reach.test.ts`'s; who may share, `../operations/rights/may.test.ts`'s.

const everyone = { _tag: 'Everyone' } as const

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Ana's System: her star, `Journal` with an `Entry` below it, and `Garden`. */
const anasSystem = Effect.gen(function* () {
  const ana = crypto.randomUUID()
  const own = yield* actingOnOwn(ana)
  const journal = yield* createTile(ana, { parent: own.system, slot: 1, ...content('Journal') })
  const entry = yield* createTile(ana, { parent: journal.id, slot: 1, ...content('Entry') })
  const garden = yield* createTile(ana, { parent: own.system, slot: 2, ...content('Garden') })
  return { ana, own, star: own.system, journal, entry, garden }
})

/** Ana, setting Everyone's value on a Tile, as the API layer runs it, in the transaction it opens. */
const setting = (acting: Mapping.Acting, tile: string, value: 'read' | 'none' | 'inherit') =>
  transactional(grant(acting, { tile, subject: everyone, value }))

/** Ana, setting the value of the Account a star stands for, as `setting` sets Everyone's. */
const sharing = (acting: Mapping.Acting, tile: string, star: string, value: Choice) =>
  transactional(grant(acting, { tile, subject: { _tag: 'Account', star }, value }))

/** What a program published on the bus, kept in order, once it ran. */
const heardFrom = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const heard: DomainEvent[] = []
    const publish = (event: DomainEvent) =>
      Effect.sync(() => {
        heard.push(event)
      })
    yield* Effect.provideService(program, Bus, { publish })
    return heard
  })

/** Someone who owns nothing of the System, from a Session. */
const stranger = (system: string): Mapping.Acting => {
  const account = crypto.randomUUID()
  const actor: Actor = { account, groups: [], owners: [account], session: true }
  return { actor, system }
}

/** What the stranger reads of the System, by id. */
const readBy = (acting: Mapping.Acting) =>
  Effect.map(Mapping.system(acting), (seen) => Object.keys(seen.tiles).sort())

layer(TestTiles)('who reaches a Tile, set by its owner, over PGlite', (it) => {
  it.effect('opens a Tile to Everyone, keeps one below it, then lets it inherit again', () =>
    Effect.gen(function* () {
      const { own, star, journal, entry, garden } = yield* anasSystem
      const passer = stranger(star)
      expect(yield* readBy(passer)).toEqual([])

      yield* setting(own, journal.id, 'read')
      expect(yield* readBy(passer)).toEqual([entry.id, journal.id].sort())
      expect((yield* whoReaches(own, entry.id)).everyone).toEqual({
        subject: everyone,
        value: 'read',
        from: journal.id,
      })

      yield* setting(own, entry.id, 'none')
      expect(yield* readBy(passer)).toEqual([journal.id])
      expect((yield* whoReaches(own, entry.id)).everyone).toEqual({
        subject: everyone,
        value: 'none',
        from: entry.id,
      })

      yield* setting(own, entry.id, 'inherit')
      expect((yield* whoReaches(own, entry.id)).everyone).toEqual({
        subject: everyone,
        value: 'read',
        from: journal.id,
      })
      yield* setting(own, journal.id, 'inherit')
      expect(yield* readBy(passer)).toEqual([])
      expect((yield* whoReaches(own, garden.id)).everyone).toEqual({
        subject: everyone,
        value: 'none',
        from: null,
      })
      // A second inherit, where nothing is set, changes nothing.
      yield* setting(own, journal.id, 'inherit')
    }),
  )

  it.effect('opens the whole System from its star, and counts no change of it', () =>
    Effect.gen(function* () {
      const { ana, own, star, journal, entry, garden } = yield* anasSystem
      const before = yield* Mapping.systemVersion(own)
      yield* setting(own, star, 'read')
      expect(yield* readBy(stranger(star))).toEqual([journal.id, entry.id, garden.id].sort())
      expect((yield* whoReaches(own, garden.id)).everyone).toEqual({
        subject: everyone,
        value: 'read',
        from: star,
      })
      expect(yield* Mapping.systemVersion(own)).toBe(before)
      expect((yield* tree(ana)).id).toBe(star)
    }),
  )

  it.effect(
    'refuses anyone but its owner, and the owner without a Session, and changes nothing',
    () =>
      Effect.gen(function* () {
        const { own, star, journal, entry, garden } = yield* anasSystem
        yield* setting(own, journal.id, 'read')
        const passer = stranger(star)
        const keyed: Mapping.Acting = { ...own, actor: { ...own.actor, session: false } }
        const refusals = [
          // A Tile the stranger reads: NotAllowed, which says nothing of who else does.
          [passer, journal.id, 'NotAllowed'],
          // One kept from them: no Tile at all.
          [passer, garden.id, 'TileNotFound'],
          // The owner through a Key, a Turn's Key or an agent.
          [keyed, garden.id, 'NotAllowed'],
        ] as const
        for (const [acting, tile, refused] of refusals) {
          expect(yield* Effect.flip(setting(acting, tile, 'read'))).toMatchObject({ _tag: refused })
          expect(yield* Effect.flip(whoReaches(acting, tile))).toMatchObject({ _tag: refused })
        }
        expect(yield* readBy(passer)).toEqual([entry.id, journal.id].sort())
      }),
  )

  it.effect('refuses a Tile hexframe ships, a Reference and an id the System holds none of', () =>
    Effect.gen(function* () {
      const { ana, own, journal, garden } = yield* anasSystem
      yield* createReference(ana, { parent: garden.id, slot: -1, target: journal.id })
      const pinned = Object.values((yield* held(ana)).tiles).find(
        (placed) => placed._tag === 'Reference',
      )?.id
      expect(pinned).toBeDefined()
      expect(yield* Effect.flip(setting(own, 'help/3', 'read'))).toMatchObject({
        _tag: 'ShippedReadOnly',
      })
      for (const tile of [pinned ?? '', crypto.randomUUID()]) {
        expect(yield* Effect.flip(setting(own, tile, 'read'))).toMatchObject({
          _tag: 'TileNotFound',
        })
      }
    }),
  )

  it.effect('shares a Tile with an Account by its star, who reads it then, told once', () =>
    Effect.gen(function* () {
      const { own, star, journal, entry, garden } = yield* anasSystem
      const bob = yield* actingOnOwn(crypto.randomUUID())
      const bobs = { ...bob, system: star }
      expect(yield* readBy(bobs)).toEqual([])

      expect(yield* heardFrom(sharing(own, journal.id, bob.system, 'read'))).toEqual([
        new TileShared({
          tile: journal.id,
          title: 'Journal',
          account: bob.actor.account ?? '',
          value: 'read',
        }),
      ])
      expect(yield* readBy(bobs)).toEqual([entry.id, journal.id].sort())

      // A change of a value that lets Bob read already, a removal, says nothing.
      for (const value of ['read+write', 'inherit'] as const) {
        expect(yield* heardFrom(sharing(own, journal.id, bob.system, value))).toEqual([])
      }
      expect(yield* readBy(bobs)).toEqual([])
      // Nor does none, and the read that follows it opens the Tile, so it is told.
      expect(yield* heardFrom(sharing(own, garden.id, bob.system, 'none'))).toEqual([])
      expect(yield* heardFrom(sharing(own, garden.id, bob.system, 'read+@'))).toMatchObject([
        { _tag: 'TileShared', tile: garden.id, title: 'Garden', value: 'read+@' },
      ])
      expect((yield* whoReaches(own, garden.id)).others).toEqual([
        {
          subject: { _tag: 'Account', id: bob.actor.account },
          value: 'read+@',
          from: garden.id,
          star: { id: bob.system, title: '', preview: '' },
        },
      ])
    }),
  )

  it.effect('refuses a star that names nothing, a Tile that is no star, and the owner’s own', () =>
    Effect.gen(function* () {
      const { own, star, journal, entry } = yield* anasSystem
      const bob = yield* actingOnOwn(crypto.randomUUID())
      const refusals = [
        [crypto.randomUUID(), 'TileNotFound'],
        [entry.id, 'TileNotFound'],
        [star, 'NotAllowed'],
      ] as const
      for (const [named, refused] of refusals) {
        expect(yield* Effect.flip(sharing(own, journal.id, named, 'read'))).toMatchObject({
          _tag: refused,
        })
      }
      // Bob, reading Journal by his Grant, shares it with nobody, himself included.
      yield* sharing(own, journal.id, bob.system, 'read+write')
      expect(
        yield* Effect.flip(sharing({ ...bob, system: star }, journal.id, bob.system, 'read+write+@')),
      ).toMatchObject({ _tag: 'NotAllowed' })
      expect((yield* whoReaches(own, journal.id)).others).toMatchObject([
        { value: 'read+write', from: journal.id },
      ])
    }),
  )
})
