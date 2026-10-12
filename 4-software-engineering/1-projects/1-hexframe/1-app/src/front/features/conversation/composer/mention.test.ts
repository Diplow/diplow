import { describe, expect, it } from 'vitest'

import { linkTo, partsOf } from '#/domains/assistant/entities'
import type { SystemTile } from '#/domains/mapping/entities'

import {
  encoded,
  inserted,
  matching,
  type Mentionable,
  mentionablesOf,
  mostOffered,
  queryAt,
  shownOf,
} from './mention'

// The composer's `@`, on a System and texts made by hand: the Tiles it offers, the search the caret
// stands in, what it finds, the link it inserts, and the Message it sends, each link by its Tile's id.

const tile = (
  id: string,
  title: string,
  below: Partial<Pick<SystemTile, 'branches' | 'leaves' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title,
  preview: '',
  body: '',
  version: 1,
  branches: {},
  leaves: {},
  context: {},
  ...below,
})

const system = tile('root', '', {
  branches: {
    1: tile('work', 'Work', { branches: { 2: tile('team', 'Team') } }),
    4: tile('games', 'Jeux vidéo'),
  },
  leaves: { 3: tile('notes', 'Notes') },
  context: {
    [-1]: tile('why', 'Why I work'),
    [-2]: { _tag: 'Reference', tile: { id: 'team', title: 'Team', preview: '', body: '' } },
    [-3]: { _tag: 'BrokenReference', target: 'gone' },
  },
})

const tiles = mentionablesOf(system, 'Untitled')
const ids = (found: ReadonlyArray<Mentionable>) => found.map(({ id }) => id)

describe('the Tiles the user may @', () => {
  it('lists every Tile from the Root down, a generation after the other, never a Reference', () => {
    expect(ids(tiles)).toEqual(['root', 'work', 'why', 'notes', 'games', 'team'])
  })

  it('names an untitled one so, and tells each by the Titles above it', () => {
    expect(tiles.find(({ id }) => id === 'root')).toEqual({
      id: 'root',
      title: 'Untitled',
      trail: [],
    })
    expect(tiles.find(({ id }) => id === 'team')).toEqual({
      id: 'team',
      title: 'Team',
      trail: ['Untitled', 'Work'],
    })
  })
})

describe('the search the caret stands in', () => {
  it('opens at an `@` opening a word, with what was typed since', () => {
    expect(queryAt('@', 1)).toEqual({ at: 0, text: '' })
    expect(queryAt('Ask @tea', 8)).toEqual({ at: 4, text: 'tea' })
    expect(queryAt('Ask @jeux vi', 12)).toEqual({ at: 4, text: 'jeux vi' })
    expect(queryAt('Ask @team now', 9)).toEqual({ at: 4, text: 'team' })
  })

  it('opens at none inside a word, past a line break, a space first, or a long sentence', () => {
    expect(queryAt('me@home', 7)).toBeUndefined()
    expect(queryAt('no at', 5)).toBeUndefined()
    expect(queryAt('@team\nand', 9)).toBeUndefined()
    expect(queryAt('@ team', 6)).toBeUndefined()
    expect(queryAt(`@${'word '.repeat(9)}`, 46)).toBeUndefined()
  })
})

describe('what a search finds', () => {
  it('offers the Tiles starting with it, then a word starting with it, then holding it', () => {
    const found = [
      { id: 'a', title: 'Teamwork', trail: [] },
      { id: 'b', title: 'Steam', trail: [] },
      { id: 'c', title: 'My team', trail: [] },
      { id: 'd', title: 'Notes', trail: [] },
    ]
    expect(ids(matching(found, 'team'))).toEqual(['a', 'c', 'b'])
  })

  it('reads a Title as a reader would, its case and accents aside', () => {
    expect(ids(matching(tiles, 'VIDEO'))).toEqual(['games'])
    expect(ids(matching(tiles, 'work'))).toEqual(['work', 'why'])
  })

  it(`offers the nearest the Root with nothing typed, ${String(mostOffered)} at most`, () => {
    const many = Array.from({ length: mostOffered + 2 }, (_, n) => ({
      id: String(n),
      title: `Tile ${String(n)}`,
      trail: [],
    }))
    expect(ids(matching(many, ''))).toEqual(ids(many.slice(0, mostOffered)))
    expect(matching(many, 'nothing like it')).toEqual([])
  })
})

describe('the link the composer inserts, and the Message it sends', () => {
  const work = { id: 'work', title: 'Work', trail: ['Ada'] }

  it('replaces the `@` and what was typed with the link as it shows, the caret after it', () => {
    expect(inserted('Ask @tea', { at: 4, text: 'tea' }, '@Team')).toEqual({
      value: 'Ask @Team ',
      caret: 10,
    })
    expect(inserted('@wo then', { at: 0, text: 'wo' }, '@Work')).toEqual({
      value: '@Work then',
      caret: 6,
    })
  })

  it('shows a link as `@` and the Title, the same again for the same Tile', () => {
    expect(shownOf(work, [])).toBe('@Work')
    expect(shownOf(work, [{ id: 'work', shown: '@Work' }])).toBe('@Work')
  })

  it('tells a Tile of a Title another one picked shows by the Titles above it, then a number', () => {
    const picked = [{ id: 'notes', shown: '@Notes' }]
    const other = { id: 'notes-2', title: 'Notes', trail: ['Ada', 'Work'] }
    expect(shownOf(other, picked)).toBe('@Work / Notes')
    const deeper = { id: 'notes-3', title: 'Notes', trail: ['Ada', 'Games', 'Work'] }
    expect(shownOf(deeper, [...picked, { id: 'notes-2', shown: '@Work / Notes' }])).toBe(
      '@Ada / Games / Work / Notes',
    )
    const twin = { id: 'notes-4', title: 'Notes', trail: ['Ada', 'Work'] }
    expect(
      shownOf(twin, [
        ...picked,
        { id: 'notes-2', shown: '@Work / Notes' },
        { id: 'notes-5', shown: '@Ada / Work / Notes' },
      ]),
    ).toBe('@Notes (2)')
  })

  it('sends each link it inserted by its Tile’s id, wherever the input still shows it whole', () => {
    const links = [
      { id: 'work', shown: '@Work' },
      { id: 'team', shown: '@Work team' },
    ]
    const sent = encoded('@Work team first, then @Work, not @Workshop, me@Work nor @Wor', links)
    expect(sent).toBe(
      `${linkTo('team')} first, then ${linkTo('work')}, not @Workshop, me@Work nor @Wor`,
    )
    expect(partsOf(sent).filter(({ _tag }) => _tag === 'Link')).toHaveLength(2)
  })

  it('sends two Tiles of one Title each by its own id', () => {
    const links = [
      { id: 'notes', shown: '@Notes' },
      { id: 'notes-2', shown: '@Work / Notes' },
    ]
    expect(encoded('@Notes and @Work / Notes', links)).toBe(
      `${linkTo('notes')} and ${linkTo('notes-2')}`,
    )
  })

  it('sends a link to a Title holding signs a pattern reads as its own, as written', () => {
    const links = [{ id: 'q', shown: '@What? (1+1)' }]
    expect(encoded('@What? (1+1) now', links)).toBe(`${linkTo('q')} now`)
    expect(encoded('nothing inserted', [])).toBe('nothing inserted')
  })
})
