import { expect, layer } from '@effect/vitest'
import { Clock, Effect, Exit, Layer, Option, Struct } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import { dayAt, type Entry } from '#/domains/assistant/entities'
import {
  CurrentKey,
  CurrentSession,
  type KeyProof,
  issueKey,
  proven,
  signUp,
} from '#/domains/iam/iam'
import type { Choice } from '#/domains/mapping/entities'
import { browser, TestAuth } from '#/repositories/auth/testing'
import { layer as appliedLayer } from '#/repositories/database/conversations/applied'
import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { layer as proposalsLayer } from '#/repositories/database/conversations/proposals'
import { layer as turnsLayer } from '#/repositories/database/conversations/turns'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'
import { layer as zipLayer } from '#/repositories/zip/zip'

import * as Mapping from '../../mapping/programs'
import { WaitUntil, serverBus } from '../../server/bus'
import { latest, latestOf } from '../programs'
import { undo } from '../proposal/programs'
import { recordedInConversation } from '../recording'

// A write in someone else's System (HEX-132), through the programs a server function and an MCP
// write run, over PGlite, Better Auth for real so a Key has a name, on the grill's scenario: Ana
// shares her Journal with Bob, who writes there. Both timelines tell it, his as his own, made
// elsewhere, hers by his star and who of his acted, offering its Undo; Ana undoes it once, as her own
// change, refused once a Tile it touched changed since, and Bob never through her Entry. What Mapping
// lets him do there, his Key and his Turn's Key, and the Version his poll follows.

const TestLayer = Layer.mergeAll(
  tilesLayer,
  conversationsLayer,
  proposalsLayer,
  appliedLayer,
  turnsLayer,
  zipLayer,
).pipe(Layer.provideMerge(TestAuth), (repositories) =>
  Layer.provideMerge(serverBus([recordedInConversation]), repositories),
)

let accounts = 0

/** Someone who just signed up, the request each of their proofs gives, a Key of theirs named. */
const someone = Effect.gen(function* () {
  accounts += 1
  const device = browser()
  const credentials = { email: `someone-${String(accounts)}@example.com`, password: 'lovelace1815' }
  const account = yield* device.request(signUp(credentials))
  const session = Option.getOrThrow(yield* device.request(proven))
  const bySession = { session: Option.some(session), key: Option.none() }
  const { key } = yield* device.request(
    issueKey('Claude Code').pipe(
      Effect.provideService(CurrentSession, bySession.session),
      Effect.provideService(CurrentKey, Option.none()),
    ),
  )
  const byKey = {
    session: Option.none(),
    key: Option.some<KeyProof>({ account, by: { _tag: 'Key', keyId: key.id } }),
  }
  const byTurnKey = {
    session: Option.none(),
    key: Option.some<KeyProof>({ account, by: { _tag: 'TurnKey', turnId: crypto.randomUUID() } }),
  }
  return { account, bySession, byKey, byTurnKey }
})

type Proofs = Effect.Success<typeof someone>['bySession' | 'byKey' | 'byTurnKey']

/** Runs a program on a request these proofs prove, the bus's work waited for as the platform does. */
const asked = <A, E, R>(program: Effect.Effect<A, E, R>, { session, key }: Proofs) =>
  Effect.gen(function* () {
    const kept: Array<Effect.Effect<void>> = []
    const exit = yield* program.pipe(
      Effect.provideService(CurrentSession, session),
      Effect.provideService(CurrentKey, key),
      Effect.provideService(WaitUntil, (work) => void kept.push(work)),
      Effect.exit,
    )
    yield* Effect.all(kept, { discard: true })
    return exit
  })

/** The refusal a program met, by its tag; none when it succeeded. */
const refusalOf = <A, E extends { readonly _tag: string }, R>(
  program: Effect.Effect<A, E, R>,
  proofs: Proofs,
) =>
  Effect.map(asked(program, proofs), (exit) =>
    Exit.isFailure(exit) ? Option.getOrUndefined(Exit.findErrorOption(exit))?._tag : undefined,
  )

/** What the Account's Conversation recorded today and yesterday, UTC, ids and instants left out. */
const recordedFor = (accountId: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const days = [dayAt(new Date(now - 24 * 60 * 60_000), 0), dayAt(new Date(now), 0)]
    const entries = yield* Effect.forEach(days, (day) => Assistant.day(accountId, day))
    return entries.flat()
  })

const said = (entries: ReadonlyArray<Entry>) =>
  entries.map((entry) => Struct.omit(entry, ['id', 'at']))

/** The Root of someone's System, read once so it exists. */
const rootOf = (proofs: Proofs) =>
  Effect.flatMap(asked(Mapping.system, proofs), (exit) => Effect.map(exit, ({ root }) => root.id))

/**
 * The grill's scenario: Ana Lima's System holding Journal, with Entry below it, and Garden beside it,
 * Bob Martin's star named, and Journal shared with him at `value`.
 */
const shared = (value: Choice) =>
  Effect.gen(function* () {
    const ana = yield* someone
    const bob = yield* someone
    const star = yield* rootOf(ana.bySession)
    const bobStar = yield* rootOf(bob.bySession)
    yield* asked(Mapping.editTile({ id: star, version: 1, title: 'Ana Lima' }), ana.bySession)
    yield* asked(Mapping.editTile({ id: bobStar, version: 1, title: 'Bob Martin' }), bob.bySession)
    const create = (parent: string, slot: 1 | 2, title: string) =>
      Effect.flatten(
        asked(Mapping.createTile({ parent, slot, title, preview: '', body: '' }), ana.bySession),
      )
    const journal = yield* create(star, 1, 'Journal')
    const entry = yield* create(journal.id, 1, 'Entry')
    const garden = yield* create(star, 2, 'Garden')
    const toBob = { _tag: 'Account', star: bobStar } as const
    yield* Effect.flatten(
      asked(Mapping.setGrant({ tile: journal.id, subject: toBob, value }), ana.bySession),
    )
    return { ana, bob, star, journal, entry, garden }
  })

/** The Entries of someone else's changes in the Account's timeline. */
const theirs = (entries: ReadonlyArray<Entry>) =>
  entries.filter((entry) => entry._tag === 'Change' && entry.actor._tag === 'Someone')

layer(TestLayer)("a write in someone else's System, over PGlite", (it) => {
  it.effect("tells Bob's edit in both timelines: his own, made elsewhere; Ana's by his star", () =>
    Effect.gen(function* () {
      const { ana, bob, journal } = yield* shared('read+write')
      const edited = yield* Effect.flatten(
        asked(
          Mapping.editTile({ id: journal.id, version: 1, title: 'Our journal' }),
          bob.bySession,
        ),
      )
      expect(edited).toMatchObject({ id: journal.id, title: 'Our journal', version: 2 })
      const change = {
        _tag: 'Change',
        verb: 'TileEdited',
        tile: { id: journal.id, title: 'Our journal' },
      }
      expect(said(yield* recordedFor(bob.account.id)).at(-1)).toEqual({
        ...change,
        actor: { _tag: 'You' },
        elsewhere: true,
      })
      expect(said(theirs(yield* recordedFor(ana.account.id)))).toEqual([
        {
          ...change,
          actor: { _tag: 'Someone', star: 'Bob Martin', by: { _tag: 'You' } },
          undone: false,
        },
      ])
      // Ana's own System holds it, read as she reads it.
      const held = yield* Effect.flatten(asked(Mapping.system, ana.bySession))
      expect(held.tiles[journal.id]).toMatchObject({ title: 'Our journal', version: 2 })
    }),
  )

  it.effect("labels a write by Bob's Key in Ana's timeline as his Key, by its name", () =>
    Effect.gen(function* () {
      const { ana, bob, journal } = yield* shared('read+write')
      const made = yield* Effect.flatten(
        asked(
          Mapping.createTile({ parent: journal.id, slot: 2, title: 'Note', preview: '', body: '' }),
          bob.byKey,
        ),
      )
      expect(said(theirs(yield* recordedFor(ana.account.id)))).toEqual([
        {
          _tag: 'Change',
          verb: 'TileCreated',
          tile: { id: made.id, title: 'Note' },
          actor: { _tag: 'Someone', star: 'Bob Martin', by: { _tag: 'Key', name: 'Claude Code' } },
          undone: false,
        },
      ])
      expect(said(yield* recordedFor(bob.account.id)).at(-1)).toMatchObject({
        actor: { _tag: 'Key', name: 'Claude Code' },
        elsewhere: true,
      })
    }),
  )

  it.effect('lets Ana undo it once, as her own change, and never Bob through her Entry', () =>
    Effect.gen(function* () {
      const { ana, bob, journal } = yield* shared('read+write')
      yield* asked(
        Mapping.editTile({ id: journal.id, version: 1, title: 'Our journal' }),
        bob.bySession,
      )
      const [offered] = theirs(yield* recordedFor(ana.account.id))
      if (offered === undefined) return expect.fail('Ana was told nothing')
      expect(yield* refusalOf(undo({ applied: offered.id }), bob.bySession)).toBe('NothingToUndo')
      expect(yield* refusalOf(undo({ applied: offered.id }), ana.byKey)).toBe('SessionRequired')
      expect(yield* refusalOf(undo({ applied: offered.id }), ana.bySession)).toBeUndefined()
      const held = yield* Effect.flatten(asked(Mapping.system, ana.bySession))
      expect(held.tiles[journal.id]).toMatchObject({ title: 'Journal', version: 3 })
      const told = yield* recordedFor(ana.account.id)
      expect(said(theirs(told))).toMatchObject([{ undone: true }])
      // Her undo is her own change, by "you".
      expect(said(told).at(-1)).toEqual({
        _tag: 'Change',
        verb: 'TileEdited',
        tile: { id: journal.id, title: 'Journal' },
        actor: { _tag: 'You' },
      })
      expect(yield* refusalOf(undo({ applied: offered.id }), ana.bySession)).toBe('NothingToUndo')
    }),
  )

  it.effect('refuses the undo whole once a Tile it touched changed since, offering it still', () =>
    Effect.gen(function* () {
      const { ana, bob, journal } = yield* shared('read+write')
      yield* asked(
        Mapping.editTile({ id: journal.id, version: 1, title: 'Our journal' }),
        bob.bySession,
      )
      yield* asked(Mapping.editTile({ id: journal.id, version: 2, title: 'Mine' }), ana.bySession)
      const [offered] = theirs(yield* recordedFor(ana.account.id))
      if (offered === undefined) return expect.fail('Ana was told nothing')
      expect(yield* refusalOf(undo({ applied: offered.id }), ana.bySession)).toBe('BatchOutdated')
      expect(said(theirs(yield* recordedFor(ana.account.id)))).toMatchObject([{ undone: false }])
      const held = yield* Effect.flatten(asked(Mapping.system, ana.bySession))
      expect(held.tiles[journal.id]).toMatchObject({ title: 'Mine' })
    }),
  )
})

layer(TestLayer)("what Bob may do in Ana's System, and what his page follows of it", (it) => {
  it.effect('lets Bob write only where his Grant lets him, refusals telling nobody', () =>
    Effect.gen(function* () {
      const { ana, bob, star, journal, entry, garden } = yield* shared('read')
      // Read alone: Journal is his to read, not to write; Garden is kept from him.
      const edit = (id: string, version = 1) =>
        Mapping.editTile({ id, version, title: 'Bob was here' })
      expect(yield* refusalOf(edit(journal.id), bob.bySession)).toBe('NotAllowed')
      expect(yield* refusalOf(edit(garden.id), bob.bySession)).toBe('TileNotFound')
      expect(yield* refusalOf(edit(star), bob.bySession)).toBe('TileNotFound')
      // A Version he read before Ana's change is stale, across Systems too.
      const toBob = { _tag: 'Account', star: yield* rootOf(bob.bySession) } as const
      yield* asked(
        Mapping.setGrant({ tile: journal.id, subject: toBob, value: 'read+write' }),
        ana.bySession,
      )
      yield* asked(
        Mapping.editTile({ id: entry.id, version: 1, title: 'Ana first' }),
        ana.bySession,
      )
      expect(yield* refusalOf(edit(entry.id, 1), bob.bySession)).toBe('TileChanged')
      // Journal carries his Grant: deleting it would bring it back open on an undo.
      expect(
        yield* refusalOf(Mapping.deleteTile({ id: journal.id, version: 1 }), bob.bySession),
      ).toBe('NotAllowed')
      expect(theirs(yield* recordedFor(ana.account.id))).toEqual([])
      // Below it, his to delete.
      expect(
        yield* refusalOf(Mapping.deleteTile({ id: entry.id, version: 2 }), bob.bySession),
      ).toBeUndefined()
      expect(said(theirs(yield* recordedFor(ana.account.id)))).toMatchObject([
        { verb: 'TileDeleted', tile: { id: entry.id, title: 'Ana first' } },
      ])
    }),
  )

  it.effect("keeps Bob's Turn's Key in his own System, and an id taken refused", () =>
    Effect.gen(function* () {
      const { ana, bob, journal } = yield* shared('read+write')
      const note = (id?: string, slot: 2 | 3 = 2) =>
        Mapping.createTile({
          ...(id !== undefined && { id }),
          parent: journal.id,
          slot,
          title: 'Note',
          preview: '',
          body: '',
        })
      expect(yield* refusalOf(note(), bob.byTurnKey)).toBe('TileNotFound')
      const chosen = crypto.randomUUID()
      expect(yield* refusalOf(note(chosen), bob.bySession)).toBeUndefined()
      expect(yield* refusalOf(note(chosen, 3), bob.bySession)).toBe('TileIdTaken')
      expect(said(theirs(yield* recordedFor(ana.account.id)))).toMatchObject([
        { verb: 'TileCreated', tile: { id: chosen } },
      ])
    }),
  )

  it.effect("polls the Version Bob is shown of Ana's System, moving only for what he sees", () =>
    Effect.gen(function* () {
      const { ana, bob, star, journal, garden } = yield* shared('read+write')
      const visited = Effect.map(
        Effect.flatten(asked(latestOf({ visiting: star }), bob.bySession)),
        (now) => now.visited,
      )
      const seen = yield* Effect.flatten(asked(Mapping.systemAt(star), bob.bySession))
      const before = yield* visited
      expect(before).toBe(seen.version)
      // A change kept from him leaves it; one he sees moves it.
      yield* asked(Mapping.editTile({ id: garden.id, version: 1, title: 'Orchard' }), ana.bySession)
      expect(yield* visited).toBe(before)
      yield* asked(Mapping.editTile({ id: journal.id, version: 1, title: 'Ours' }), ana.bySession)
      expect(yield* visited).not.toBe(before)
      // His own System's Version is the count it always was; none is asked of his own star.
      const own = yield* Effect.flatten(asked(latest, bob.bySession))
      expect(own).not.toHaveProperty('visited')
      const ownStar = yield* rootOf(bob.bySession)
      const asOwn = yield* Effect.flatten(asked(latestOf({ visiting: ownStar }), bob.bySession))
      expect(asOwn).not.toHaveProperty('visited')
    }),
  )
})
