import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import { pieces, tiers } from '../pieces'
import {
  chapterOf,
  isChapter,
  nextOf,
  pieceShown,
  piecesOf,
  previousOf,
  readDeckSearch,
  slideIds,
  slideNamed,
  slidesFor,
  type ChapterId,
} from './slides'

// The deck /design-system shows: every piece of the catalogue in one chapter, in the catalogue's
// order, the slides one after another, and what the URL and a `/` in the chat say of them.

const chapters = slideIds.filter(isChapter)

describe('the chapters', () => {
  it('show every piece of the catalogue once, each in the chapter of its tier', () => {
    const shown = chapters.flatMap((chapter) => piecesOf(chapter))
    expect(shown).toEqual(pieces.map(({ name }) => name))
    for (const { name } of pieces) expect(piecesOf(chapterOf(name))).toContain(name)
  })

  it('cover every tier, in the catalogue’s order', () => {
    const tierOrder = pieces.map(({ tier }) => tier).filter((tier, at, all) => all[at - 1] !== tier)
    expect(tierOrder).toEqual([...tiers])
  })

  it('show the piece asked for when it is theirs, else their first', () => {
    expect(pieceShown('chat-pieces', 'Message')).toBe('Message')
    expect(pieceShown('chat-pieces', 'Canvas')).toBe(piecesOf('chat-pieces')[0])
    expect(pieceShown('shared', undefined)).toBe('Screen')
  })

  it('are the slides that show pieces, and no other', () => {
    expect(chapters).toEqual<ChapterId[]>(['crossings', 'chat-pieces', 'canvas-pieces', 'shared'])
  })
})

describe('the slides, one after another', () => {
  it('go from the first to the last, none beyond either end', () => {
    expect(previousOf('why')).toBeUndefined()
    expect(nextOf('why')).toBe('principles')
    expect(previousOf('chat')).toBe('principles')
    expect(nextOf('tokens')).toBeUndefined()
  })
})

describe('what a `/` in the chat finds', () => {
  it('finds every slide for nothing typed, and those a word holds, by name or by title', () => {
    expect(slidesFor('')).toEqual([...slideIds])
    expect(slidesFor('can')).toEqual(['canvas', 'canvas-pieces'])
    expect(slidesFor(m.deck_title_tokens().toUpperCase())).toEqual(['tokens'])
  })

  it('goes to the slide a word names, case aside, and to none for another word', () => {
    expect(slideNamed(` ${m.deck_name_chat().toUpperCase()} `)).toBe('chat')
    expect(slideNamed('nowhere')).toBeUndefined()
  })
})

describe('the URL', () => {
  it('reads the slide and the piece, each falling back when it cannot be read', () => {
    expect(readDeckSearch({ slide: 'chat', piece: 'Message' })).toEqual({
      slide: 'chat',
      piece: 'Message',
    })
    expect(readDeckSearch({ slide: 'nowhere', piece: 3 })).toStrictEqual({
      slide: undefined,
      piece: undefined,
    })
  })
})
