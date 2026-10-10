import { expect, layer } from '@effect/vitest'
import { Effect, Exit, Layer, Option } from 'effect'

import { CurrentKey, CurrentSession } from '#/domains/iam/iam'
import { MappingEvent, TileCreated, TileEdited } from '#/domains/mapping/operations'
import { TestDatabase } from '#/repositories/database/testing'
import { layer as tilesLayer } from '#/repositories/database/tiles/tiles'

import { type Envelope, WaitUntil, on, serverBus } from '../server/bus'
import * as Mapping from './programs'

// Mapping's events as the API layer's bus carries them, over PGlite: every change publishes the
// events `decide` made, once its transaction commits, with who acted on the envelope. A server
// function and an MCP write run these same programs (../server/mcp/tools.ts), proven by a Session
// at the one door and by a Key at the other.

/** Every envelope the bus carried since a test last asked. */
const heard: Array<Envelope> = []

const keep = on(MappingEvent, (event, actor) =>
  Effect.sync(() => void heard.push({ event, actor })),
)

const TestLayer = Layer.merge(tilesLayer.pipe(Layer.provideMerge(TestDatabase)), serverBus([keep]))

/** Someone no other test uses, and the request each of their two proofs gives. */
function someone() {
  const account = { id: crypto.randomUUID(), email: 'ada@example.com' }
  const session = { account, expiresAt: new Date(Date.now() + 60_000) }
  return {
    account,
    bySession: { session: Option.some(session), key: Option.none() },
    byKey: (keyId: string) => ({ session: Option.none(), key: Option.some({ account, keyId }) }),
  }
}

type Proofs =
  ReturnType<typeof someone>['bySession'] | ReturnType<ReturnType<typeof someone>['byKey']>

/**
 * Runs a program on a request these proofs prove, waits as the platform does for the work it handed
 * to waitUntil, and answers its exit with what the bus carried meanwhile.
 */
const asked = <A, E, R>(program: Effect.Effect<A, E, R>, { session, key }: Proofs) =>
  Effect.gen(function* () {
    heard.length = 0
    const kept: Array<Effect.Effect<void>> = []
    const exit = yield* program.pipe(
      Effect.provideService(CurrentSession, session),
      Effect.provideService(CurrentKey, key),
      Effect.provideService(WaitUntil, (work) => void kept.push(work)),
      Effect.exit,
    )
    yield* Effect.all(kept, { discard: true })
    return { exit, heard: [...heard] }
  })

/** The Root of someone's System, read once so it exists. */
const rootOf = (proofs: Proofs) =>
  Effect.flatMap(asked(Mapping.system, proofs), ({ exit }) =>
    Effect.map(exit, ({ root }) => root.id),
  )

layer(TestLayer)("Mapping's events on the bus, over PGlite", (it) => {
  it.effect(
    'publishes the same event for a write by a Session and by a Key, each with its actor',
    () =>
      Effect.gen(function* () {
        const { account, bySession, byKey } = someone()
        const root = yield* rootOf(bySession)
        // The second writer read the Root once the first had named it.
        const edit = (version: number) =>
          Mapping.editTile({ id: root, version, title: 'Ada Lovelace' })
        const event = new TileEdited({ id: root, title: 'Ada Lovelace' })
        expect((yield* asked(edit(1), bySession)).heard).toEqual([
          { event, actor: Option.some({ account, by: { _tag: 'Session' } }) },
        ])
        expect((yield* asked(edit(2), byKey('key-1'))).heard).toEqual([
          { event, actor: Option.some({ account, by: { _tag: 'Key', keyId: 'key-1' } }) },
        ])
      }),
  )

  it.effect('publishes the event a create made, of the Tile it answers', () =>
    Effect.gen(function* () {
      const { bySession } = someone()
      const root = yield* rootOf(bySession)
      const content = { title: 'Child', preview: 'A Child.', body: '# Child' }
      const { exit, heard: carried } = yield* asked(
        Mapping.createTile({ parent: root, slot: 1, ...content }),
        bySession,
      )
      const { id } = yield* exit
      expect(carried.map(({ event }) => event)).toEqual([
        new TileCreated({ id, parent: root, slot: 1, ...content }),
      ])
    }),
  )

  it.effect('publishes nothing for a refused write, nor for one that changes nothing', () =>
    Effect.gen(function* () {
      const { byKey } = someone()
      const proofs = byKey('key-2')
      const root = yield* rootOf(proofs)
      const refused = yield* asked(
        Mapping.moveTile({ id: root, version: 1, parent: root, slot: 1 }),
        proofs,
      )
      expect([Exit.isFailure(refused.exit), refused.heard]).toEqual([true, []])
      const stale = yield* asked(Mapping.editTile({ id: root, version: 2, title: 'Ahead' }), proofs)
      expect([Exit.isFailure(stale.exit), stale.heard]).toEqual([true, []])
      const unchanged = yield* asked(Mapping.editTile({ id: root, version: 1 }), proofs)
      expect([Exit.isSuccess(unchanged.exit), unchanged.heard]).toEqual([true, []])
    }),
  )
})
