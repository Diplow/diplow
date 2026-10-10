import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { dayAt } from '#/domains/assistant/entities'
import type { SessionRequired, SignedOut } from '#/domains/iam/errors'
import type { KeyProof, Session } from '#/domains/iam/iam'

import * as Mapping from '../mapping/programs'
import type { Failure } from '../report/errors/failure'
import { noKey, run, type Services, type StartContext } from '../server/run'
import { DayAsked, MergedNavigation, NewMessage } from './assistant'
import * as Assistant from './programs'

// Assistant's server functions, as their handlers run them: the program, through the helper, on the
// runtime's repositories, over PGlite, the bus's subscriptions included, waited for as the platform
// waits for them. Start's validation runs before a handler; the schemas are checked on their own below.

/** Any of Assistant's programs, as the helper takes it. */
type Program = Effect.Effect<unknown, Failure, Services>

/**
 * A request from someone signed in as an Account no other test uses, by a Session or by one of their
 * Keys, or from nobody, with the work it hands to waitUntil, to wait for.
 */
function request(signedIn: boolean | 'by key' = true) {
  const account = { id: crypto.randomUUID(), email: 'someone@example.com' }
  const session: Session = { account, expiresAt: new Date(Date.now() + 60_000) }
  const key: KeyProof = { account, keyId: 'key-1' }
  const pending: Array<Promise<unknown>> = []
  const context: StartContext = {
    requestId: 'req-assistant',
    scope: 'test',
    waitUntil: (promise) => void pending.push(promise),
    exchange: {
      url: 'http://localhost/_serverFn',
      headers: new Headers(),
      setCookies: () => undefined,
    },
    session: Exit.succeed(signedIn === true ? Option.some(session) : Option.none()),
    key: signedIn === 'by key' ? Exit.succeed(Option.some(key)) : noKey,
  }
  /** Runs a program for this request, and waits for what it handed to waitUntil. */
  const call = async <A, E extends Failure>(program: Effect.Effect<A, E, Services>) => {
    const outcome = await run(context, program)
    await Promise.all(pending)
    return outcome
  }
  return { context, call }
}

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** Today, by the server's clock, for a reader at UTC. */
const today = () => dayAt(new Date(), 0)

describe("Assistant's server functions", () => {
  it.each<readonly [string, Program]>([
    ['conversationDay', Assistant.conversationDay({ offset: 0 })],
    ['latest', Assistant.latest],
    ['postMessage', Assistant.postMessage({ text: 'Hello' })],
    [
      'recordNavigation',
      Assistant.recordNavigation({
        navigation: { _tag: 'Navigation', steps: [{ gesture: 'center', tile: 't' }], gestures: 1 },
        sinceLast: 0,
      }),
    ],
  ])(
    '%s asks for a Session: SignedOut for nobody, SessionRequired for a Key',
    async (_, program) => {
      expect(await request(false).call(program)).toMatchObject({
        ok: false,
        failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
      })
      expect(await request('by key').call(program)).toMatchObject({
        ok: false,
        failure: { _tag: 'SessionRequired', kind: 'Forbidden' },
      })
    },
  )

  it('posts a Message and reads it back in today’s Conversation, an empty one before', async () => {
    const { call } = request()
    expect(await value(call(Assistant.conversationDay({ offset: 0 })))).toEqual({
      day: today(),
      entries: [],
      titles: {},
    })
    const posted = await value(call(Assistant.postMessage({ text: 'Help me lay out my vault.' })))
    expect(posted).toMatchObject({
      _tag: 'Message',
      author: 'user',
      text: 'Help me lay out my vault.',
    })
    const read = await value(call(Assistant.conversationDay({ offset: 0 })))
    expect(read.entries).toEqual([posted])
    expect(await value(call(Assistant.conversationDay(today())))).toEqual(read)
  })

  it('reads a day of the reader’s calendar, another day holding none of today’s', async () => {
    const { call } = request()
    const posted = await value(call(Assistant.postMessage({ text: 'Today' })))
    const yesterday = dayAt(new Date(Date.now() - 24 * 60 * 60_000), 0)
    const read = await value(call(Assistant.conversationDay(yesterday)))
    expect(read).toEqual({ day: yesterday, entries: [], titles: {}, lastEntry: posted.id })
  })

  it('says where the latest Entry before a day is, for a reader scrolling back', async () => {
    const { call } = request()
    expect(await value(call(Assistant.conversationDay({ offset: 0 })))).not.toHaveProperty(
      'earlier',
    )
    const posted = await value(call(Assistant.postMessage({ text: 'Today' })))
    const tomorrow = dayAt(new Date(Date.now() + 24 * 60 * 60_000), 0)
    const read = await value(call(Assistant.conversationDay(tomorrow)))
    expect(read).toMatchObject({ entries: [], earlier: posted.at })
    expect(await value(call(Assistant.conversationDay({ offset: 0 })))).not.toHaveProperty(
      'earlier',
    )
  })

  it('answers the System’s Version and the Entry last recorded, which every write moves', async () => {
    const { call } = request()
    expect(await value(call(Assistant.latest))).toEqual({ version: 0 })
    const posted = await value(call(Assistant.postMessage({ text: 'Name me' })))
    expect(await value(call(Assistant.latest))).toEqual({ version: 0, lastEntry: posted.id })
    const { root } = await value(call(Mapping.system))
    await value(call(Mapping.editTile({ id: root.id, version: 1, title: 'Ada' })))
    const latest = await value(call(Assistant.latest))
    const { entries } = await value(call(Assistant.conversationDay({ offset: 0 })))
    expect(latest).toEqual({ version: 1, lastEntry: entries.at(-1)?.id })
    expect(latest.lastEntry).not.toBe(posted.id)
  })

  it('moves the System’s Version one per change, and not for a refused one', async () => {
    const { call } = request()
    const { root } = await value(call(Mapping.system))
    await value(
      call(Mapping.createTile({ parent: root.id, slot: 1, title: 'One', preview: '', body: '' })),
    )
    expect(await value(call(Assistant.latest))).toMatchObject({ version: 1 })
    const refused = await call(
      Mapping.moveTile({ id: root.id, version: 1, parent: root.id, slot: 2 }),
    )
    expect(refused.ok).toBe(false)
    expect(await value(call(Assistant.latest))).toMatchObject({ version: 1 })
  })

  it('records a merged navigation dated from its last gesture, its Tiles named as they are now', async () => {
    const { call } = request()
    const { root } = await value(call(Mapping.system))
    const games = await value(
      call(Mapping.createTile({ parent: root.id, slot: 3, title: 'Games', preview: '', body: '' })),
    )
    await value(call(Mapping.deleteTile({ id: games.id, version: 1 })))
    const kept = await value(
      call(Mapping.createTile({ parent: root.id, slot: 4, title: 'Kept', preview: '', body: '' })),
    )
    const navigation = {
      _tag: 'Navigation' as const,
      steps: [
        { gesture: 'center', tile: games.id },
        { gesture: 'show-context', tile: kept.id },
      ],
      gestures: 5,
    }
    const before = Date.now()
    const recorded = await value(
      call(Assistant.recordNavigation({ navigation, sinceLast: 60_000 })),
    )
    expect(recorded).toMatchObject(navigation)
    expect(recorded.at.getTime()).toBeLessThanOrEqual(before - 60_000 + 1_000)
    expect(recorded.at.getTime()).toBeGreaterThanOrEqual(before - 60_000 - 1_000)
    const { entries, titles } = await value(call(Assistant.conversationDay(dayAt(recorded.at, 0))))
    expect(entries.filter(({ _tag }) => _tag === 'Navigation')).toEqual([recorded])
    // The deleted Tile has no Title any more; the Root is named by none of the navigation's steps.
    expect(titles).toEqual({ [kept.id]: 'Kept' })
  })

  it('records the writes it follows beside the Messages, in the order they came', async () => {
    const { call } = request()
    const { root } = await value(call(Mapping.system))
    await value(call(Assistant.postMessage({ text: 'Name me' })))
    await value(call(Mapping.editTile({ id: root.id, version: 1, title: 'Ada' })))
    const { entries } = await value(call(Assistant.conversationDay({ offset: 0 })))
    expect(entries.map(({ _tag }) => _tag)).toEqual(['Message', 'Change'])
    expect(entries[1]).toMatchObject({ verb: 'TileEdited', tile: { id: root.id, title: 'Ada' } })
  })

  it('lists, by its type, the errors each server function can fail with', () => {
    type Errors<P> = P extends Effect.Effect<unknown, infer E, unknown> ? E : never
    expectTypeOf<Errors<ReturnType<typeof Assistant.postMessage>>>().toEqualTypeOf<
      SignedOut | SessionRequired
    >()
    expectTypeOf<Errors<ReturnType<typeof Assistant.conversationDay>>>().toEqualTypeOf<
      SignedOut | SessionRequired
    >()
    expectTypeOf<Errors<typeof Assistant.latest>>().toEqualTypeOf<SignedOut | SessionRequired>()
  })
})

describe("Assistant's schemas", () => {
  const takes = (schema: Schema.Top, input: unknown) =>
    Schema.decodeUnknownResult(schema as Schema.Codec<unknown>)(input)._tag === 'Success'

  it('takes a day by its date and offset, the date left out for today', () => {
    expect(takes(DayAsked, { offset: 120 })).toBe(true)
    expect(takes(DayAsked, { date: '2026-10-10', offset: -300 })).toBe(true)
    expect(takes(DayAsked, { date: '2026-02-30', offset: 0 })).toBe(false)
    expect(takes(DayAsked, { date: '2026-10-10' })).toBe(false)
  })

  it('takes a Message trimmed, never empty, at most 10,000 characters', () => {
    expect(takes(NewMessage, { text: 'Hello' })).toBe(true)
    expect(takes(NewMessage, { text: 'x'.repeat(10_000) })).toBe(true)
    for (const text of ['', ' Hello', 'Hello\n', 'x'.repeat(10_001)]) {
      expect(takes(NewMessage, { text }), JSON.stringify(text)).toBe(false)
    }
  })

  it('takes a merged navigation sent a day after its last gesture at most', () => {
    const navigation = {
      _tag: 'Navigation',
      steps: [{ gesture: 'center', tile: 't' }],
      gestures: 1,
    }
    expect(takes(MergedNavigation, { navigation, sinceLast: 0 })).toBe(true)
    expect(takes(MergedNavigation, { navigation, sinceLast: 24 * 60 * 60_000 })).toBe(true)
    expect(takes(MergedNavigation, { navigation, sinceLast: 24 * 60 * 60_000 + 1 })).toBe(false)
    expect(takes(MergedNavigation, { navigation, sinceLast: -1 })).toBe(false)
    expect(
      takes(MergedNavigation, { navigation: { ...navigation, steps: [] }, sinceLast: 0 }),
    ).toBe(false)
  })
})
