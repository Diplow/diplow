import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'

import { type Actor, sightVersion, systemOf } from '../../entities'
import * as Mapping from '../../mapping'
import {
  actingOnOwn,
  createReference,
  createTile,
  editTile,
  held,
  TestTiles,
  tree,
} from '../../testing'

// A System read as the actor may see it, from its star, over PGlite: the owner's read as it always
// was, whole; a stranger's of a star with no Grant, its card; and Bob's of Ana's System, on the
// grill's scenario, exactly what it lets him read, each Tile with his rights on it. What the read is
// made of, on Systems made by hand, is `../../entities/rights/seen.test.ts`'s.

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

/**
 * Ana's System as the grill tells it, named: her star, `Journal` with an `Entry` below it, and
 * `Garden`; Everyone reads the star, not `Journal`, and the Group `Family` reads the star.
 */
const scenario = Effect.gen(function* () {
  const ana = crypto.randomUUID()
  const star = (yield* tree(ana)).id
  yield* editTile(ana, star, content('Ana'))
  const journal = yield* createTile(ana, { parent: star, slot: 1, ...content('Journal') })
  const entry = yield* createTile(ana, { parent: journal.id, slot: 1, ...content('Entry') })
  const garden = yield* createTile(ana, { parent: star, slot: 2, ...content('Garden') })
  const grants = {
    everyone: { tile: star, subject: 'everyone', subjectId: null, value: 'read' },
    journalHidden: { tile: journal.id, subject: 'everyone', subjectId: null, value: 'none' },
    family: { tile: star, subject: 'group', subjectId: 'family', value: 'read' },
  } as const
  return { ana, star, journal, entry, garden, grants }
})

/** The Titles a read holds, by id, its star's first. */
const titlesIn = (seen: Mapping.Acting) =>
  Effect.map(Mapping.system(seen), (read) => ({
    star: read.root.title,
    tiles: Object.fromEntries(
      Object.values(read.tiles).flatMap((placed) =>
        placed._tag === 'Tile' ? [[placed.id, placed.title] as const] : [],
      ),
    ),
  }))

layer(TestTiles)('a System read as its owner sees it, over PGlite', (it) => {
  it.effect('reads it whole, as before, every right on every Tile and no gap', () =>
    Effect.gen(function* () {
      const { ana, star, journal, entry, garden, grants } = yield* scenario
      yield* granting(ana, grants.everyone, grants.journalHidden, grants.family)
      const read = yield* Mapping.system(yield* actingOnOwn(ana))
      expect(read).toMatchObject({ root: { id: star, title: 'Ana', body: '# Ana' }, gaps: {} })
      expect(Object.keys(read.tiles).sort()).toEqual([journal.id, entry.id, garden.id].sort())
      expect(read.tiles[entry.id]).toMatchObject({ body: '# Entry', parent: journal.id })
      for (const id of [star, journal.id, entry.id, garden.id]) {
        expect(read.rights[id]).toEqual(['read', 'write', '@'])
      }
      // Beside the rights and gaps it is shown, the System as Mapping holds it.
      expect(yield* held(ana)).toMatchObject({ root: read.root, tiles: read.tiles })
    }),
  )
})

layer(TestTiles)('a System read as someone else sees it, over PGlite', (it) => {
  it.effect('gives a stranger reading a star with no Grant its card only', () =>
    Effect.gen(function* () {
      const { star } = yield* scenario
      const stranger = visitor(star)
      const read = yield* Mapping.system(stranger)
      expect(read.root).toEqual({
        _tag: 'Tile',
        id: star,
        title: 'Ana',
        preview: 'Ana, in short.',
        body: '',
        version: 1,
      })
      expect(read).toMatchObject({ tiles: {}, rights: { [star]: [] }, gaps: {} })
      // No count of the System's changes: how what the stranger sees stands, which its poll reads.
      expect(read.version).toBe(sightVersion(read))
      expect(yield* Mapping.systemVersion(stranger)).toBe(read.version)
      const opened = yield* Mapping.openTile(stranger, {
        fields: ['title', 'body'],
        language: 'en',
      })
      expect(opened).toMatchObject({
        tile: { id: star, title: 'Ana', body: '' },
        branches: {},
        context: {},
      })
      const mapped = yield* Mapping.readTile(stranger, {
        depth: 2,
        fields: ['title', 'preview', 'body'],
        language: 'en',
      })
      expect(mapped.tile).toEqual({
        _tag: 'Tile',
        id: star,
        version: 1,
        title: 'Ana',
        preview: 'Ana, in short.',
        body: '',
        branches: {},
        leaves: {},
        context: {},
      })
    }),
  )

  it.effect(
    'holds exactly what the grill’s scenario lets Bob, in Family, and a stranger read',
    () =>
      Effect.gen(function* () {
        const { ana, star, journal, entry, garden, grants } = yield* scenario
        yield* granting(ana, grants.everyone, grants.journalHidden, grants.family)
        const bob = visitor(star, ['family'])
        expect(yield* titlesIn(bob)).toEqual({
          star: 'Ana',
          tiles: { [journal.id]: 'Journal', [entry.id]: 'Entry', [garden.id]: 'Garden' },
        })
        const bobs = yield* Mapping.system(bob)
        expect(bobs.root.body).toBe('# Ana')
        expect(bobs.rights).toEqual({
          [star]: ['read'],
          [journal.id]: ['read'],
          [entry.id]: ['read'],
          [garden.id]: ['read'],
        })
        expect(systemOf(bobs).branches[1]?.branches[1]?.title).toBe('Entry')
        expect(yield* titlesIn(visitor(star))).toEqual({
          star: 'Ana',
          tiles: { [garden.id]: 'Garden' },
        })
      }),
  )

  it.effect('hangs a Tile read below one kept from the reader from the star, across a gap', () =>
    Effect.gen(function* () {
      const { ana, star, journal, entry, garden, grants } = yield* scenario
      yield* granting(ana, grants.everyone, grants.journalHidden, {
        tile: entry.id,
        subject: 'everyone',
        subjectId: null,
        value: 'read',
      })
      const read = yield* Mapping.system(visitor(star))
      expect(read.gaps).toEqual({ [entry.id]: { _tag: 'Tile', ...entry } })
      expect(Object.keys(read.tiles)).toEqual([garden.id])
      // Journal's id is nowhere in what the stranger reads.
      expect(JSON.stringify(read)).not.toContain(journal.id)
      // Entry is none of the star's Children: the star's tree leaves it out.
      expect(systemOf(read).branches[1]).toBeUndefined()
    }),
  )

  it.effect('says nothing of a Tile kept from the reader through a Reference to it', () =>
    Effect.gen(function* () {
      const { ana, star, journal, garden, grants } = yield* scenario
      yield* granting(ana, grants.everyone, grants.journalHidden)
      yield* createReference(ana, { parent: garden.id, slot: -1, target: journal.id })
      yield* createReference(ana, { parent: garden.id, slot: -2, target: star })
      const stranger = visitor(star)
      const opened = yield* Mapping.openTile(stranger, {
        id: garden.id,
        fields: ['title'],
        language: 'en',
      })
      // The Reference to the star stays, its card anyone's; the one to Journal shows unavailable,
      // as one whose Tile was deleted, with no id.
      expect(Object.keys(opened.context).sort()).toEqual(['-1', '-2'])
      expect(opened.context[-1]).toEqual({ _tag: 'BrokenReference', target: '' })
      expect(JSON.stringify(opened)).not.toContain(journal.id)
      const read = yield* Mapping.system(stranger)
      expect(JSON.stringify(read)).not.toContain(journal.id)
    }),
  )

  it.effect('reads no System, nor any Tile, from a star that names none', () =>
    Effect.gen(function* () {
      const nowhere = visitor(crypto.randomUUID())
      expect(yield* Effect.flip(Mapping.system(nowhere))).toMatchObject({ _tag: 'TileNotFound' })
      const fromStar = Mapping.readTile(nowhere, { depth: 1, fields: ['title'], language: 'en' })
      expect(yield* Effect.flip(fromStar)).toMatchObject({ _tag: 'TileNotFound' })
    }),
  )
})
