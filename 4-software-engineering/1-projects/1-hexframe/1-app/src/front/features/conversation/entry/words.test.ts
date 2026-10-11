import { describe, expect, it } from 'vitest'

import { type Entry, linkTo } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import type { Word } from '#/front/ui/chat/text/words'

import { blocksOf, happenedOf, messageWords, type Naming, proposedOf, type Told } from './words'

// What an Entry says as the chat's pieces take it, over Entries made by hand: who a line is by, a Tile
// named as it stands now, a Message's links woven in, a Proposal's draft, and a day cut into blocks.

const at = new Date(2026, 9, 12, 10, 0)
const games = { id: 'games', title: 'Games' }
const drafts = { id: 'drafts', title: 'Drafts' }
const naming: Naming = { titles: { games: 'Games now' }, system: new Map([['games', 'Games now']]) }

/** A Tile named, as it stands, without the click that centers it. */
const tile = (word: Word | undefined) =>
  typeof word === 'object' && 'tile' in word
    ? { title: word.tile.title, standing: word.tile.standing ?? 'live' }
    : word

type Changed = Extract<Told, { _tag: 'Change' }>

const change = (actor: Changed['actor'], verb = 'TileEdited'): Changed => ({
  _tag: 'Change',
  id: 'c',
  at,
  verb,
  tile: games,
  actor,
})

describe('happenedOf', () => {
  it('tells a change by who made it, the agent without its name', () => {
    const mine = happenedOf(change({ _tag: 'You' }), naming)
    expect(mine.who).toBe('human')
    expect(mine.words[0]).toBe(m.conversation_edited({ title: '' }))
    const agents = happenedOf(change({ _tag: 'Assistant' }), naming)
    expect(agents.who).toBe('agent')
    expect(agents.words[0]).toBe(m.conversation_edited_agent({ title: '' }))
    const keys = happenedOf(change({ _tag: 'Key', name: 'laptop' }), naming)
    expect(keys.who).toBe('key')
    expect(keys.words[0]).toEqual({ name: m.conversation_key({ name: 'laptop' }) })
    expect(happenedOf(change({ _tag: 'Key' }), naming).words[0]).toBe(m.conversation_revoked_key())
  })

  it('names a Tile by the Title it had: there, deleted since, or plain before the System is read', () => {
    expect(tile(happenedOf(change({ _tag: 'You' }), naming).words.at(-1))).toEqual({
      title: 'Games',
      standing: 'live',
    })
    const deleted: Changed = { ...change({ _tag: 'You' }, 'TileDeleted'), tile: drafts }
    expect(tile(happenedOf(deleted, naming).words.at(-1))).toEqual({
      title: 'Drafts',
      standing: 'gone',
    })
    expect(tile(happenedOf(deleted, { titles: {} }).words.at(-1))).toEqual({
      title: 'Drafts',
      standing: 'live',
    })
  })

  it('tells a navigation by its last gesture on its Tile now, and how many it merged', () => {
    const navigation: Told = {
      _tag: 'Navigation',
      id: 'n',
      at,
      steps: [
        { gesture: 'expand', tile: 'drafts' },
        { gesture: 'center', tile: 'games' },
      ],
      gestures: 3,
    }
    const told = happenedOf(navigation, naming)
    expect(told.who).toBe('human')
    expect(tile(told.words.at(-1))).toEqual({ title: 'Games now', standing: 'live' })
    expect(told.detail).toBe(m.conversation_gestures({ count: 3 }))
    const gone = { ...navigation, steps: [{ gesture: 'center' as const, tile: 'drafts' }] }
    expect(happenedOf(gone, naming).words.at(-1)).toBe(m.conversation_tile_gone())
  })

  it('tells a Turn stopped by the user, and one its sandbox failed as a failure', () => {
    const ended = (how: 'stopped' | 'sandbox'): Told => ({ _tag: 'TurnEnded', id: 'e', at, how })
    expect(happenedOf(ended('stopped'), naming)).toMatchObject({ who: 'human' })
    expect(happenedOf(ended('sandbox'), naming)).toMatchObject({ who: 'app', state: 'failed' })
  })
})

describe('messageWords', () => {
  it('weaves each link in as its Tile now, a deleted one struck through', () => {
    const words = messageWords(`Look at ${linkTo('games')} and ${linkTo('drafts')}.`, naming)
    expect(words.map(tile)).toEqual([
      'Look at ',
      { title: 'Games now', standing: 'live' },
      ' and ',
      { title: m.conversation_link_broken(), standing: 'gone' },
      '.',
    ])
  })
})

describe('proposedOf', () => {
  const created = { _tag: 'Change' as const, verb: 'TileCreated', tile: drafts }

  it('draws a Tile a Proposal creates as the agent’s draft until it is accepted', () => {
    expect(tile(proposedOf(created, naming, false).words.at(-1))).toEqual({
      title: 'Drafts',
      standing: 'draft',
    })
    expect(tile(proposedOf(created, naming, true).words.at(-1))).toEqual({
      title: 'Drafts',
      standing: 'gone',
    })
  })

  it('says a verb this page does not know plainly', () => {
    const unknown = { _tag: 'Change' as const, verb: 'TileGrown', tile: games }
    expect(proposedOf(unknown, naming, false).words[0]).toBe(
      m.conversation_proposal_change({ title: '' }),
    )
  })
})

describe('blocksOf', () => {
  const message = (id: string, author: 'user' | 'agent'): Entry => ({
    _tag: 'Message',
    id,
    at,
    author,
    text: id,
  })

  it('runs the lines together, and marks an agent’s Message following another', () => {
    const blocks = blocksOf([
      change({ _tag: 'You' }),
      { ...change({ _tag: 'Assistant' }), id: 'c2' },
      message('m1', 'agent'),
      message('m2', 'agent'),
      message('m3', 'user'),
      { _tag: 'TurnApplied', id: 'a', at, turn: 't', changes: 2, undone: false },
    ])
    expect(blocks.map((block) => block.kind)).toEqual([
      'lines',
      'message',
      'message',
      'message',
      'applied',
    ])
    expect(blocks[0]?.kind === 'lines' && blocks[0].entries.length).toBe(2)
    expect(blocks.map((block) => block.kind === 'message' && block.continued)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ])
  })
})
