import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { transactional } from '#/repositories/database/database'

import type { Actor, GrantChange } from '../entities'
import * as Mapping from '../mapping'
import { actingOnOwn, createReference, createTile, held, TestTiles, tree } from '../testing'
import { grant, whoReaches } from './sharing'

// Who reaches a Tile, set and read by its owner over PGlite: Everyone set to read on a Tile, then to
// none below it, then back to inherit, each read back with where it comes from and seen by a
// stranger; nobody else, nor the owner without a Session, changing or reading it; no shipped Tile, no
// Reference; and no count of the System's changes moved. Who reaches, on a System made by hand, is
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
const setting = (acting: Mapping.Acting, tile: string, value: GrantChange['value']) =>
  transactional(grant(acting, { tile, subject: everyone, value }))

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
      expect(yield* whoReaches(own, entry.id)).toEqual([
        { subject: everyone, value: 'read', from: journal.id },
      ])

      yield* setting(own, entry.id, 'none')
      expect(yield* readBy(passer)).toEqual([journal.id])
      expect(yield* whoReaches(own, entry.id)).toEqual([
        { subject: everyone, value: 'none', from: entry.id },
      ])

      yield* setting(own, entry.id, 'inherit')
      expect(yield* whoReaches(own, entry.id)).toEqual([
        { subject: everyone, value: 'read', from: journal.id },
      ])
      yield* setting(own, journal.id, 'inherit')
      expect(yield* readBy(passer)).toEqual([])
      expect(yield* whoReaches(own, garden.id)).toEqual([
        { subject: everyone, value: 'none', from: null },
      ])
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
      expect(yield* whoReaches(own, garden.id)).toEqual([
        { subject: everyone, value: 'read', from: star },
      ])
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
})
