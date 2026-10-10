import { expect, layer } from '@effect/vitest'
import { Clock, Effect, Layer, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import { dayAt, type Entry } from '#/domains/assistant/entities'
import { CurrentKey, CurrentSession, issueKey, proven, signUp } from '#/domains/iam/iam'
import { EditTile } from '#/domains/mapping/operations'
import * as MappingService from '#/domains/mapping/mapping'
import { HttpExchange } from '#/repositories/auth/auth'
import { browser, TestAuth } from '#/repositories/auth/testing'
import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { transactional } from '#/repositories/database/database'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'
import { archiveOf } from '#/repositories/zip/testing'
import { layer as zipLayer } from '#/repositories/zip/zip'

import * as Mapping from '../mapping/programs'
import { WaitUntil, serverBus } from '../server/bus'
import { recordedInConversation } from './recording'

// The Conversation recording Mapping's events, over PGlite, with Better Auth for real so a Key has a
// name: a change by a Session, the same by a Key, an import, each landing as an Entry of the acting
// Account's Conversation, labeled as the timeline shows who acted, once its transaction committed;
// and a rolled-back write landing nothing. A write runs as its door runs it, a server function's with
// a Session, an MCP call's with a Key.

const TestLayer = Layer.mergeAll(tilesLayer, conversationsLayer, zipLayer).pipe(
  Layer.provideMerge(TestAuth),
  (repositories) => Layer.provideMerge(serverBus([recordedInConversation]), repositories),
)

let accounts = 0

/** The request an import arrives by, on a site its links read nothing of. */
const exchange = {
  url: 'https://hexframe.test/',
  headers: new Headers(),
  setCookies: () => undefined,
}

/**
 * Someone who just signed up, the request each of their proofs gives, and a Key of theirs, named.
 */
const someone = Effect.gen(function* () {
  accounts += 1
  const device = browser()
  const credentials = {
    email: `recording-${String(accounts)}@example.com`,
    password: 'lovelace1815',
  }
  const account = yield* device.request(signUp(credentials))
  const session = Option.getOrThrow(yield* device.request(proven))
  const bySession = { session: Option.some(session), key: Option.none() }
  const { key } = yield* device.request(
    issueKey('Claude Code').pipe(
      Effect.provideService(CurrentSession, bySession.session),
      Effect.provideService(CurrentKey, Option.none()),
    ),
  )
  const byKey = { session: Option.none(), key: Option.some({ account, keyId: key.id }) }
  return { account, bySession, byKey }
})

type Proofs = Effect.Success<typeof someone>['bySession' | 'byKey']

/**
 * Runs a program on a request these proofs prove, and waits, as the platform does, for the work it
 * handed to waitUntil: the Conversation's recording among it.
 */
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

/**
 * What the Account's Conversation recorded since yesterday, UTC, by the test's clock, which every
 * Entry is dated by: its ids and instants left out.
 */
const recordedFor = (accountId: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const days = [dayAt(new Date(now - 24 * 60 * 60_000), 0), dayAt(new Date(now), 0)]
    const entries = yield* Effect.forEach(days, (day) => Assistant.day(accountId, day))
    return entries.flat().map(({ id: _, at: __, ...content }: Entry) => content)
  })

/** The Root of someone's System, read once so it exists. */
const rootOf = (proofs: Proofs) =>
  Effect.flatMap(asked(Mapping.system, proofs), (exit) => Effect.map(exit, ({ root }) => root.id))

layer(TestLayer)("the Conversation recording Mapping's events, over PGlite", (it) => {
  it.effect('records an edit by a Session as a change by "you", the Tile by its new Title', () =>
    Effect.gen(function* () {
      const { account, bySession } = yield* someone
      const root = yield* rootOf(bySession)
      yield* asked(Mapping.editTile({ id: root, version: 1, title: 'Ada Lovelace' }), bySession)
      expect(yield* recordedFor(account.id)).toEqual([
        {
          _tag: 'Change',
          verb: 'TileEdited',
          tile: { id: root, title: 'Ada Lovelace' },
          actor: { _tag: 'You' },
        },
      ])
    }),
  )

  it.effect('records a write by a Key as a change by that Key, by its name', () =>
    Effect.gen(function* () {
      const { account, byKey } = yield* someone
      const root = yield* rootOf(byKey)
      const content = { title: 'Games', preview: 'What I play.', body: '' }
      const created = yield* Effect.flatten(
        asked(Mapping.createTile({ parent: root, slot: 3, ...content }), byKey),
      )
      yield* asked(Mapping.moveTile({ id: created.id, version: 1, parent: root, slot: 4 }), byKey)
      const byClaude = { _tag: 'Key', name: 'Claude Code' }
      expect(yield* recordedFor(account.id)).toEqual([
        {
          _tag: 'Change',
          verb: 'TileCreated',
          tile: { id: created.id, title: 'Games' },
          actor: byClaude,
        },
        {
          _tag: 'Change',
          verb: 'TileMoved',
          tile: { id: created.id, title: 'Games' },
          actor: byClaude,
        },
      ])
    }),
  )

  it.effect('names a deleted Tile by the Title it had, and both Tiles of a swap', () =>
    Effect.gen(function* () {
      const { account, bySession } = yield* someone
      const root = yield* rootOf(bySession)
      const made = (title: string, slot: 1 | 2) =>
        Effect.flatten(
          asked(
            Mapping.createTile({ parent: root, slot, title, preview: '', body: '' }),
            bySession,
          ),
        )
      const [a, b] = [yield* made('A', 1), yield* made('B', 2)]
      yield* asked(Mapping.swapTiles({ a: a.id, aVersion: 1, b: b.id, bVersion: 1 }), bySession)
      yield* asked(Mapping.deleteTile({ id: a.id, version: 2 }), bySession)
      const you = { _tag: 'You' }
      expect((yield* recordedFor(account.id)).slice(2)).toEqual([
        {
          _tag: 'Change',
          verb: 'TilesSwapped',
          tile: { id: a.id, title: 'A' },
          other: { id: b.id, title: 'B' },
          actor: you,
        },
        { _tag: 'Change', verb: 'TileDeleted', tile: { id: a.id, title: 'A' }, actor: you },
      ])
    }),
  )

  it.effect(
    'records an import as one Entry: the Tile it landed as, and how many came with it',
    () =>
      Effect.gen(function* () {
        const { account, bySession } = yield* someone
        const root = yield* rootOf(bySession)
        const files = {
          'CLAUDE.md': '---\ntitle: Vault\n---\n',
          '1-a/CLAUDE.md': '',
          '2-b/CLAUDE.md': '',
        }
        const imported = yield* Effect.flatten(
          asked(
            Mapping.importTiles({
              upload: new File([archiveOf(files).slice()], 'vault.zip'),
              as: 'Zip',
              place: { _tag: 'Slot', parent: root, slot: 1 },
            }).pipe(Effect.provideService(HttpExchange, exchange)),
            bySession,
          ),
        )
        expect(yield* recordedFor(account.id)).toEqual([
          {
            _tag: 'Import',
            tile: { id: imported.id, title: 'Vault' },
            count: 2,
            actor: { _tag: 'You' },
          },
        ])
      }),
  )

  it.effect('records nothing for a write rolled back, nor for one refused', () =>
    Effect.gen(function* () {
      const { account, bySession } = yield* someone
      const root = yield* rootOf(bySession)
      const edit = new EditTile({ id: root, version: 1, title: 'Never said' })
      const rolledBack = transactional(
        Effect.andThen(MappingService.editTile(account.id, edit), Effect.fail('rolled back')),
      )
      yield* asked(rolledBack, bySession)
      yield* asked(Mapping.editTile({ id: root, version: 9, title: 'Stale' }), bySession)
      expect(yield* recordedFor(account.id)).toEqual([])
    }),
  )
})
