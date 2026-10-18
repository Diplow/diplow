import { expect, layer } from '@effect/vitest'
import { Effect } from 'effect'

import { transactional } from '#/repositories/database/database'
import type { GrantRow } from '#/repositories/database/tiles/grants'
import { granted } from '#/repositories/database/tiles/testing'

import type { Actor, GrantValue } from '../../entities'
import * as Mapping from '../../mapping'
import { type Batched, CreateTile, EditTile } from '..'
import { createReference, createTile, editTile, TestTiles, tree } from '../../testing'

// A Turn on a Tile of someone else's System (HEX-134), as Mapping's service serves it, over PGlite:
// where the agent may run, its *@*; the files its sandbox holds, what the actor may read of the
// System from its star, the Tiles across a gap in a folder of their own; a batch added to, read
// through and found to run as the actor may write there, a Grant taken back since refusing it.

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Sets a Grant on the owner's System, as a Session's write of one does. */
const granting = (owner: string, row: GrantRow) => transactional(granted(owner, row))

/** Ana's System: her star, titled, `Journal` with an `Entry` below it, and `Garden`. */
const scenario = Effect.gen(function* () {
  const ana = crypto.randomUUID()
  const star = (yield* tree(ana)).id
  yield* editTile(ana, star, { title: 'Ana Lima' })
  const journal = yield* createTile(ana, { parent: star, slot: 1, ...content('Journal') })
  const entry = yield* createTile(ana, { parent: journal.id, slot: 1, ...content('Entry') })
  const garden = yield* createTile(ana, { parent: star, slot: 2, ...content('Garden') })
  return { ana, star, journal, entry, garden }
})

/** Bob, acting on Ana's System through his Turn, with no Session, given `value` on a Tile there. */
const bobOn = (owner: string, star: string) => {
  const account = crypto.randomUUID()
  const actor = { account, groups: [], owners: [account], session: false } satisfies Actor
  const grant = (tile: string, value: GrantValue) =>
    granting(owner, { tile, subject: 'account', subjectId: account, value })
  const acting: Mapping.Acting = { actor, system: star }
  return Effect.succeed({ acting, grant })
}

/** A create kept in a batch as `addToBatch` keeps it, under a fresh id. */
const batchedCreate = (parent: string, title: string): Batched => ({
  operation: new CreateTile({ parent, slot: 2, ...content(title) }),
  made: crypto.randomUUID(),
})

layer(TestTiles)('where a Turn may start on someone else’s System', (it) => {
  it.effect('answers the rights at a Tile with @, refuses one without, keeps one unread', () =>
    Effect.gen(function* () {
      const { ana, star, journal, garden } = yield* scenario
      const own = {
        actor: { account: ana, groups: [], owners: [ana], session: true },
        system: star,
      }
      expect(yield* Mapping.agentAt(own, garden.id)).toEqual(['read', 'write', '@'])
      const bob = yield* bobOn(ana, star)
      yield* bob.grant(journal.id, 'read')
      expect((yield* Effect.flip(Mapping.agentAt(bob.acting, journal.id)))._tag).toBe('NotAllowed')
      yield* bob.grant(journal.id, 'read+@')
      expect(yield* Mapping.agentAt(bob.acting, journal.id)).toEqual(['read', '@'])
      // Kept from him, as no Tile at all, and a Reference's id, which names no Tile to run at.
      for (const id of [garden.id, crypto.randomUUID()]) {
        expect((yield* Effect.flip(Mapping.agentAt(bob.acting, id)))._tag).toBe('TileNotFound')
      }
      yield* createReference(ana, { parent: journal.id, slot: -1, target: garden.id })
      const held = yield* Mapping.wholeOf(ana)
      const reference = Object.values(held.tiles).find((placed) => placed._tag === 'Reference')
      if (reference === undefined) return expect.fail('No Reference was made')
      expect((yield* Effect.flip(Mapping.agentAt(own, reference.id)))._tag).toBe('TileNotFound')
    }),
  )
})

layer(TestTiles)('the files a Turn on someone else’s System starts with', (it) => {
  it.effect('hold what Bob may read from her star, and nothing kept from him', () =>
    Effect.gen(function* () {
      const { ana, star, journal } = yield* scenario
      const bob = yield* bobOn(ana, star)
      yield* bob.grant(journal.id, 'read+@')
      const { files, places, across } = yield* Mapping.systemFiles(bob.acting, (id) => `/t/${id}`)
      const written = files.map(({ path, content }) => `${path}\n${content}`).join('\n')
      expect(written).toContain('Journal')
      expect(written).toContain('Entry')
      expect(written).not.toContain('Garden')
      // The star as anyone sees it, its card: its Title and Preview, never its Body.
      expect(written).toContain('Ana Lima')
      expect(written).not.toContain('# Ana Lima')
      expect(places.get(journal.id)).toEqual({ folder: '1-journal', file: '1-journal/CLAUDE.md' })
      expect(across).toBeUndefined()
      // Its owner's are the whole of it, as a Turn at home starts with.
      const own = {
        actor: { account: ana, groups: [], owners: [ana], session: false },
        system: star,
      }
      const whole = yield* Mapping.systemFiles(own, (id) => `/t/${id}`)
      expect(whole.files.map(({ path }) => path)).toEqual(
        expect.arrayContaining(['CLAUDE.md', '1-journal/CLAUDE.md', '2-garden/CLAUDE.md']),
      )
    }),
  )

  it.effect('put a Tile across a gap, with what is below it, in a folder of their own', () =>
    Effect.gen(function* () {
      const { ana, star, entry } = yield* scenario
      const bob = yield* bobOn(ana, star)
      // Entry alone: Journal, above it, is kept from him, so its place is too.
      yield* bob.grant(entry.id, 'read+write+@')
      const { files, places, across } = yield* Mapping.systemFiles(bob.acting, (id) => `/t/${id}`)
      expect(across).toBe('…')
      expect(places.get(entry.id)).toEqual({ folder: '…/1-entry', file: '…/1-entry/CLAUDE.md' })
      const paths = files.map(({ path }) => path)
      expect(paths).toEqual(['CLAUDE.md', '…/1-entry/CLAUDE.md'])
      const [entryFile] = files.filter(({ path }) => path === '…/1-entry/CLAUDE.md')
      // Its file names no parent: where it hangs is kept from him.
      expect(entryFile?.content).toContain('parent: .')
      expect(files.map(({ content }) => content).join('\n')).not.toContain('Journal')
    }),
  )
})

layer(TestTiles)('a batch over someone else’s System, as the actor may write there', (it) => {
  it.effect('takes what Bob may write, refuses the rest as a write would be', () =>
    Effect.gen(function* () {
      const { ana, star, journal, garden } = yield* scenario
      const bob = yield* bobOn(ana, star)
      yield* bob.grant(journal.id, 'read+@')
      const edit = new EditTile({ id: journal.id, version: 1, title: 'Ours' })
      expect((yield* Effect.flip(Mapping.addToBatch(bob.acting, [], edit)))._tag).toBe('NotAllowed')
      const intoGarden = new CreateTile({ parent: garden.id, slot: 1, ...content('Weeds') })
      expect((yield* Effect.flip(Mapping.addToBatch(bob.acting, [], intoGarden)))._tag).toBe(
        'TileNotFound',
      )
      yield* bob.grant(journal.id, 'read+write+@')
      const note = new CreateTile({ parent: journal.id, slot: 2, ...content('Note') })
      const added = yield* Mapping.addToBatch(bob.acting, [], note)
      expect(added.tile).toMatchObject({ title: 'Note' })
      // His reads through it show the Tile it makes, under the one he writes, and nothing else.
      const read = yield* Mapping.readTile(bob.acting, {
        id: journal.id,
        depth: 1,
        fields: ['title'],
        language: 'en',
        over: [added.batched],
      })
      expect(read.tile).toMatchObject({ branches: { 2: { title: 'Note' } } })
      const fromStar = yield* Mapping.readTile(bob.acting, {
        depth: 1,
        fields: ['title'],
        language: 'en',
        over: [added.batched],
      })
      expect(fromStar.tile.branches?.[2]).toBeUndefined()
      // Ana's System holds none of it.
      expect(Object.values((yield* Mapping.wholeOf(ana)).tiles)).toHaveLength(3)
    }),
  )

  it.effect(
    'runs whole as he may write there, refused once a Grant is taken back or a Tile moved',
    () =>
      Effect.gen(function* () {
        const { ana, star, journal } = yield* scenario
        const bob = yield* bobOn(ana, star)
        yield* bob.grant(journal.id, 'read+write')
        const batch = [batchedCreate(journal.id, 'Note')]
        yield* transactional(Mapping.batchAllowed(bob.acting, batch))
        // A later Operation adding to an earlier one's Tile is allowed by what that Tile inherits.
        const below: Batched = {
          operation: new CreateTile({ parent: batch[0]?.made ?? '', slot: 1, ...content('Line') }),
          made: crypto.randomUUID(),
        }
        yield* transactional(Mapping.batchAllowed(bob.acting, [...batch, below]))
        yield* bob.grant(journal.id, 'read')
        expect(
          (yield* Effect.flip(transactional(Mapping.batchAllowed(bob.acting, batch))))._tag,
        ).toBe('NotAllowed')
        yield* bob.grant(journal.id, 'read+write')
        const stale = [{ operation: new EditTile({ id: journal.id, version: 1, title: 'Ours' }) }]
        yield* editTile(ana, journal.id, { title: 'Mine' })
        expect(
          (yield* Effect.flip(transactional(Mapping.batchAllowed(bob.acting, stale))))._tag,
        ).toBe('BatchOutdated')
      }),
  )
})
