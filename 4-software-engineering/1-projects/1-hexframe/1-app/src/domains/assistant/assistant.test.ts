import { expect, layer } from '@effect/vitest'
import { Effect, Layer, Struct } from 'effect'
import { TestClock } from 'effect/testing'

import { layer as conversationsLayer } from '#/repositories/database/conversations/conversations'
import { transactional } from '#/repositories/database/database'
import { TestDatabase } from '#/repositories/database/testing'

import { day, postMessage, recordChange, recordNavigation } from './assistant'
import type { EntryContent, Navigation, Summarized } from './entities'

// The Conversation over the conversations repository, for real, over PGlite: Entries recorded as the
// API layer records them, in a transaction, then read back a day at a time, in their reader's day.
// The clock is the test's, so every instant is the one written.

const TestLayer = conversationsLayer.pipe(Layer.provideMerge(TestDatabase))

/** An Account no other test uses. */
const someone = () => crypto.randomUUID()

const said = (text: string): EntryContent => ({ _tag: 'Message', author: 'user', text })

/**
 * Records an Entry as the API layer does, in a transaction, through the operation its kind has: a
 * navigation `ago` milliseconds before now, anything else now.
 */
const recorded = (accountId: string, content: EntryContent, ago = 0) =>
  transactional(
    content._tag === 'Message'
      ? postMessage(accountId, content.text)
      : content._tag === 'Navigation'
        ? recordNavigation(accountId, content, ago)
        : recordChange(accountId, summarizedOf(content), content.actor),
  )

/** A change or an import as Mapping would have summarized it, who acted left out. */
const summarizedOf = (content: Extract<EntryContent, { _tag: 'Change' | 'Import' }>): Summarized =>
  content._tag === 'Change' ? Struct.omit(content, ['actor']) : Struct.omit(content, ['actor'])

/** A navigation of one gesture, centering this Tile. */
const went = (tile: string): Navigation => ({
  _tag: 'Navigation',
  steps: [{ gesture: 'center', tile }],
  gestures: 1,
})

/** Sets the test's clock to an instant. */
const at = (iso: string) => TestClock.setTime(Date.parse(iso))

/** The texts of a day's Messages, in the order the day reads them. */
const textsOn = (accountId: string, date: string, offset = 0) =>
  Effect.map(day(accountId, { date, offset }), (entries) =>
    entries.map((entry) => (entry._tag === 'Message' ? entry.text : entry._tag)),
  )

layer(TestLayer)('the Conversation, over PGlite', (it) => {
  it.effect(
    'records an Entry and reads it back, as it was said, at the instant it dates from',
    () =>
      Effect.gen(function* () {
        const account = someone()
        yield* at('2026-10-10T09:00:00Z')
        const entry = yield* recorded(account, said('Help me lay out my vault.'))
        expect(entry).toMatchObject({
          _tag: 'Message',
          author: 'user',
          text: 'Help me lay out my vault.',
          at: new Date('2026-10-10T09:00:00Z'),
        })
        expect(yield* day(account, { date: '2026-10-10', offset: 0 })).toEqual([entry])
      }),
  )

  it.effect('reads every kind of Entry back as it was recorded', () =>
    Effect.gen(function* () {
      const account = someone()
      yield* at('2026-10-10T10:00:00Z')
      const tile = { id: crypto.randomUUID(), title: 'Games' }
      const kinds: ReadonlyArray<EntryContent> = [
        said('What would you add to Games?'),
        { _tag: 'Change', verb: 'TileMoved', tile, actor: { _tag: 'You' } },
        {
          _tag: 'Change',
          verb: 'TilesSwapped',
          tile,
          other: { id: crypto.randomUUID(), title: 'Politics' },
          actor: { _tag: 'Key', name: 'Claude Code' },
        },
        { _tag: 'Change', verb: 'TileDeleted', tile, actor: { _tag: 'Key' } },
        { _tag: 'Import', tile, count: 12, actor: { _tag: 'You' } },
        {
          _tag: 'Navigation',
          steps: [{ gesture: 'center', tile: tile.id }],
          gestures: 3,
        },
      ]
      for (const content of kinds) yield* recorded(account, content)
      const read = yield* day(account, { date: '2026-10-10', offset: 0 })
      expect(read.map((entry) => Struct.omit(entry, ['id', 'at']))).toEqual(kinds)
    }),
  )

  it.effect('reads a day from its reader’s midnight to the next, the Entries oldest first', () =>
    Effect.gen(function* () {
      const account = someone()
      yield* at('2026-10-10T21:59:00Z')
      yield* recorded(account, said('late, in Paris'))
      yield* at('2026-10-10T22:01:00Z')
      yield* recorded(account, said('past midnight, in Paris'))
      yield* recorded(account, said('the same instant, written second'))
      yield* recorded(account, went('before midnight, sent late'), 90_000)
      expect(yield* textsOn(account, '2026-10-10', 120)).toEqual(['late, in Paris', 'Navigation'])
      expect(yield* textsOn(account, '2026-10-11', 120)).toEqual([
        'past midnight, in Paris',
        'the same instant, written second',
      ])
      expect(yield* textsOn(account, '2026-10-10', 0)).toEqual([
        'late, in Paris',
        'Navigation',
        'past midnight, in Paris',
        'the same instant, written second',
      ])
    }),
  )

  it.effect('dates an Entry back a day at most, and never ahead of now', () =>
    Effect.gen(function* () {
      const account = someone()
      yield* at('2026-10-10T12:00:00Z')
      const long = yield* recorded(account, went('long ago'), 3 * 24 * 60 * 60_000)
      const ahead = yield* recorded(account, went('ahead'), -60_000)
      expect(long.at).toEqual(new Date('2026-10-09T12:00:00Z'))
      expect(ahead.at).toEqual(new Date('2026-10-10T12:00:00Z'))
    }),
  )

  it.effect('reads an Account’s own Conversation only, and an empty day before the first', () =>
    Effect.gen(function* () {
      const [account, other] = [someone(), someone()]
      yield* at('2026-10-10T08:00:00Z')
      yield* recorded(account, said('mine'))
      expect(yield* textsOn(other, '2026-10-10')).toEqual([])
      expect(yield* textsOn(account, '2026-10-09')).toEqual([])
      expect(yield* textsOn(account, '2026-10-10')).toEqual(['mine'])
    }),
  )
})
