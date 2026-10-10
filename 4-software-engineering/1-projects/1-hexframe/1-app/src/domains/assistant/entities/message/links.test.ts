import { describe, expect, it } from 'vitest'

import type { Entry } from '../entry'
import { namedTiles } from '../entry'
import { leadingLink, linksOf, linkTo, mostLinks, partsOf } from './links'

// A Message's links, on texts written by hand: each Tile kept by its id in the text, read back in
// pieces, the one opening the Message told apart, and the Tiles a day names joined from its Messages
// and its navigations.

const games = '0b5c0d9e-4c8f-4f43-9d55-7f6a4b8e2a11'
const notes = 'notes_2'

describe("a Message's links", () => {
  it('reads a text back in pieces, its words as written and each link by its id', () => {
    const text = `${linkTo(games)} tidy this, then look at ${linkTo(notes)}.`
    expect(partsOf(text)).toEqual([
      { _tag: 'Link', tile: games },
      { _tag: 'Text', text: ' tidy this, then look at ' },
      { _tag: 'Link', tile: notes },
      { _tag: 'Text', text: '.' },
    ])
  })

  it('reads a text without a link as one piece, and an empty one as none', () => {
    expect(partsOf('Write to me @ noon, at [home].')).toEqual([
      { _tag: 'Text', text: 'Write to me @ noon, at [home].' },
    ])
    expect(partsOf('')).toEqual([])
  })

  it('reads what no id is made of as words: spaces, other signs, nothing, past 100 characters', () => {
    const text = `@[two words] @[a/b] @[] @[${'x'.repeat(101)}]`
    expect(partsOf(text)).toEqual([{ _tag: 'Text', text }])
  })

  it('names the Tiles a Message links, each once, in the order it first links them', () => {
    const text = `${linkTo(notes)} and ${linkTo(games)}, then ${linkTo(notes)} again`
    expect(linksOf(text)).toEqual([notes, games])
    expect(linksOf('no link')).toEqual([])
  })

  it(`reads its first ${String(mostLinks)} links, the rest as written`, () => {
    const ids = Array.from({ length: mostLinks + 2 }, (_, n) => `tile-${String(n)}`)
    const text = ids.map(linkTo).join(' ')
    expect(linksOf(text)).toEqual(ids.slice(0, mostLinks))
    expect(partsOf(text).at(-1)).toEqual({
      _tag: 'Text',
      text: ` ${ids.slice(mostLinks).map(linkTo).join(' ')}`,
    })
  })

  it('tells the Tile a Message opens with, where its Turn starts, and none otherwise', () => {
    expect(leadingLink(`${linkTo(games)} tidy this`)).toBe(games)
    expect(leadingLink(`Tidy ${linkTo(games)}`)).toBeUndefined()
    expect(leadingLink('Tidy this')).toBeUndefined()
  })
})

describe('the Tiles some Entries name', () => {
  const at = new Date('2026-10-11T09:00:00Z')
  const entries: ReadonlyArray<Entry> = [
    { id: '1', at, _tag: 'Message', author: 'user', text: `${linkTo(games)} and ${linkTo(notes)}` },
    {
      id: '2',
      at,
      _tag: 'Navigation',
      steps: [
        { gesture: 'center', tile: 'root' },
        { gesture: 'expand', tile: games },
      ],
      gestures: 2,
    },
    { id: '3', at, _tag: 'Message', author: 'agent', text: `Done in ${linkTo('elsewhere')}.` },
    { id: '4', at, _tag: 'TurnEnded', how: 'stopped' },
  ]

  it('joins the Tiles their Messages link and their navigations went to, each once', () => {
    expect(namedTiles(entries)).toEqual([games, notes, 'root', 'elsewhere'])
  })
})
