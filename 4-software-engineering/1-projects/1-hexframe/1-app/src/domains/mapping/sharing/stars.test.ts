import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { transactional } from '#/repositories/database/database'

import { starQueryOf, starsFoundAtMost } from '../entities'
import type * as Mapping from '../mapping'
import { actingOnOwn, createTile, editTile, TestTiles } from '../testing'
import { grant } from './sharing'
import { starShowing, starsTitled } from './stars'

// A star found over PGlite: by its Title, whatever its case, those it starts first, by its card
// alone, a private System's too, never a Tile below a star, the finder's own left out, a few at most,
// a query's wildcards read as themselves; and by a link, the star of the System holding a Tile its
// reader is shown, none for a Tile kept from them. Every Title holds a word of its own, so the stars
// other tests make never match.

/** A word no other test's Titles hold. */
const word = () => `q${crypto.randomUUID().slice(0, 8)}`

/** Someone's System, its star titled so, with a Preview of its own, and a Tile below it. */
const starTitled = (title: string, below = 'Journal') =>
  Effect.gen(function* () {
    const owner = crypto.randomUUID()
    const own = yield* actingOnOwn(owner)
    yield* editTile(owner, own.system, { title, preview: `${title}, in short.`, body: '# Mine' })
    const tile = yield* createTile(owner, {
      parent: own.system,
      slot: 1,
      title: below,
      preview: `${below}, in short.`,
      body: `# ${below}`,
    })
    return { owner, own, star: own.system, tile }
  })

/** Someone else, from a Session, acting on their own System, who owns nothing of the others. */
const finder = Effect.map(starTitled('Finder'), ({ own }) => own)

/** The ids of the stars found, in their order. */
const found = (acting: Mapping.Acting, query: string) =>
  Effect.map(starsTitled(acting, query), (stars) => stars.map(({ id }) => id))

layer(TestTiles)('a star found by its Title or by a link, over PGlite', (it) => {
  it.effect('finds stars by their Title, whatever its case, those it starts first', () =>
    Effect.gen(function* () {
      const typed = word()
      const inside = yield* starTitled(`Ana ${typed.toUpperCase()}`)
      const starting = yield* starTitled(`${typed} Bob`)
      yield* starTitled('Nobody at all')
      const me = yield* finder
      expect(yield* found(me, typed)).toEqual([starting.star, inside.star])
      expect(yield* starsTitled(me, typed)).toEqual([
        { id: starting.star, title: `${typed} Bob`, preview: `${typed} Bob, in short.` },
        {
          id: inside.star,
          title: `Ana ${typed.toUpperCase()}`,
          preview: `Ana ${typed.toUpperCase()}, in short.`,
        },
      ])
    }),
  )

  it.effect('finds a private System’s star by its card, and never a Tile below a star', () =>
    Effect.gen(function* () {
      const typed = word()
      const kept = yield* starTitled(`Ana ${typed}`, `Journal ${typed}`)
      const me = yield* finder
      expect(yield* found(me, typed)).toEqual([kept.star])
      const [card] = yield* starsTitled(me, typed)
      expect(card).toEqual({
        id: kept.star,
        title: `Ana ${typed}`,
        preview: `Ana ${typed}, in short.`,
      })
      expect(JSON.stringify(card)).not.toContain('# Mine')
    }),
  )

  it.effect('leaves the finder’s own star out', () =>
    Effect.gen(function* () {
      const typed = word()
      const mine = yield* starTitled(`Me ${typed}`)
      const theirs = yield* starTitled(`Them ${typed}`)
      expect(yield* found(mine.own, typed)).toEqual([theirs.star])
    }),
  )

  it.effect('finds a few at most, those whose Title starts with the query first', () =>
    Effect.gen(function* () {
      const typed = word()
      const inside = yield* Effect.forEach([1, 2, 3], (n) => starTitled(`${String(n)} ${typed}`))
      const starting = yield* Effect.forEach([1, 2, 3, 4, 5], (n) =>
        starTitled(`${typed} ${String(n)}`),
      )
      const me = yield* finder
      const stars = yield* found(me, typed)
      expect(stars).toHaveLength(starsFoundAtMost)
      expect(stars).toEqual([...starting, ...inside.slice(0, 1)].map(({ star }) => star))
    }),
  )

  it.effect('reads a query’s wildcards as themselves', () =>
    Effect.gen(function* () {
      const typed = word()
      const percent = yield* starTitled(`${typed} 100% sure`)
      const underscore = yield* starTitled(`${typed} a_b`)
      yield* starTitled(`${typed} 100 sure`)
      yield* starTitled(`${typed} axb`)
      const me = yield* finder
      expect(yield* found(me, `${typed} 100%`)).toEqual([percent.star])
      expect(yield* found(me, 'a_b')).toContain(underscore.star)
      expect(yield* found(me, `${typed} a_b`)).toEqual([underscore.star])
      expect(yield* found(me, `${typed}\\`)).toEqual([])
    }),
  )

  it.effect('leads a link to a Tile its reader is shown to the star holding it, by its card', () =>
    Effect.gen(function* () {
      const ana = yield* starTitled('Ana')
      const deep = yield* createTile(ana.owner, {
        parent: ana.tile.id,
        slot: 2,
        title: 'Entry',
        preview: 'Entry, in short.',
        body: '# Entry',
      })
      const me = yield* finder
      const onAnas: Mapping.Acting = { ...me, system: ana.star }
      const card = { id: ana.star, title: 'Ana', preview: 'Ana, in short.' }
      // Her star, whose card anyone sees, though her System is private.
      expect(yield* starShowing(onAnas, ana.star)).toEqual(card)
      // A deep Tile kept from them: no Tile at all.
      expect(yield* Effect.flip(starShowing(onAnas, deep.id))).toMatchObject({
        _tag: 'TileNotFound',
      })
      // Once Everyone may read it, the same link leads to her star.
      const everyone = { _tag: 'Everyone' } as const
      yield* transactional(grant(ana.own, { tile: ana.tile.id, subject: everyone, value: 'read' }))
      expect(yield* starShowing(onAnas, deep.id)).toEqual(card)
      // A Tile her System holds none of.
      expect(yield* Effect.flip(starShowing(onAnas, crypto.randomUUID()))).toMatchObject({
        _tag: 'TileNotFound',
      })
    }),
  )

  it('asks for a query long enough, trimmed, never one too long', () => {
    expect(starQueryOf('  An ')).toBe('An')
    expect(starQueryOf(' A ')).toBeUndefined()
    expect(starQueryOf('')).toBeUndefined()
    expect(starQueryOf('a'.repeat(101))).toBeUndefined()
  })
})
