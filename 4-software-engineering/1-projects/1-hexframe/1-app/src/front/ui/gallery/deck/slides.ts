// The slides /design-system shows, one at a time, in order: words first, on the ground alone, why
// hexframe exists and the principles its look follows; then the screen as it builds up, the chat,
// then the canvas, then the onboarding, a new account's first visit; then where the two sides
// answer each other, each side's pieces and those they share, each piece on the canvas and its
// words in the chat; then the tokens. A chapter is a slide that shows pieces of the catalogue, by
// tier, one at a time. Which slide shows, and which piece of its chapter, is the URL's. Pure.
import { Schema } from 'effect'

import { m } from '#/paraglide/messages'

import { orDefault, readSearch } from '../../canvas/view/view'
import { folded } from '../../chat/atoms/cut'
import { pieces, type PieceName, type Tier } from '../pieces'

/** The slides, in their order. */
export const slideIds = [
  'why',
  'principles',
  'chat',
  'canvas',
  'onboarding',
  'crossings',
  'chat-pieces',
  'canvas-pieces',
  'shared',
  'tokens',
] as const

export type SlideId = (typeof slideIds)[number]

/** The chapters, the slides that show pieces of the catalogue, and the tiers each shows them from. */
const chapters = {
  crossings: ['crossings'],
  'chat-pieces': ['chat'],
  'canvas-pieces': ['canvas'],
  shared: ['layouts', 'atoms', 'seams'],
} as const satisfies Partial<Record<SlideId, readonly Tier[]>>

export type ChapterId = keyof typeof chapters

/** Whether a slide is a chapter, which shows pieces one at a time. */
export const isChapter = (slide: SlideId): slide is ChapterId => slide in chapters

/** The tiers a chapter shows its pieces from, in the catalogue's order. */
export const tiersOf = (chapter: ChapterId): readonly Tier[] => chapters[chapter]

/** The pieces a chapter shows, in the catalogue's order. */
export function piecesOf(chapter: ChapterId): PieceName[] {
  const tiers = tiersOf(chapter)
  return pieces.filter((piece) => tiers.includes(piece.tier)).map((piece) => piece.name)
}

/** The chapter that shows a piece. Every piece of the catalogue has one, which the test holds. */
export function chapterOf(piece: PieceName): ChapterId {
  const found = (Object.keys(chapters) as ChapterId[]).find((chapter) =>
    piecesOf(chapter).includes(piece),
  )
  if (found === undefined) throw new Error(`${piece} is in no chapter`)
  return found
}

/** The piece a chapter shows: the one asked for if it is the chapter's, else its first. */
export function pieceShown(chapter: ChapterId, asked: string | undefined): PieceName {
  const shown = piecesOf(chapter)
  const first = shown[0]
  if (first === undefined) throw new Error(`${chapter} shows no piece`)
  return shown.find((piece) => piece === asked) ?? first
}

/** The slide after this one; none after the last. */
export function nextOf(slide: SlideId): SlideId | undefined {
  return slideIds[slideIds.indexOf(slide) + 1]
}

/** The slide before this one; none before the first. */
export function previousOf(slide: SlideId): SlideId | undefined {
  const at = slideIds.indexOf(slide)
  return at === 0 ? undefined : slideIds[at - 1]
}

/** Where a slide stands among them, from 1. */
export const placeOf = (slide: SlideId) => slideIds.indexOf(slide) + 1

const titles: Record<SlideId, () => string> = {
  why: m.deck_title_why,
  principles: m.deck_title_principles,
  chat: m.deck_title_chat,
  canvas: m.deck_title_canvas,
  onboarding: m.deck_title_onboarding,
  crossings: m.deck_title_crossings,
  'chat-pieces': m.deck_title_chat_pieces,
  'canvas-pieces': m.deck_title_canvas_pieces,
  shared: m.deck_title_shared,
  tokens: m.deck_title_tokens,
}

/** A slide's title, in the reader's language. */
export const slideTitle = (slide: SlideId) => titles[slide]()

const names: Record<SlideId, () => string> = {
  why: m.deck_name_why,
  principles: m.deck_name_principles,
  chat: m.deck_name_chat,
  canvas: m.deck_name_canvas,
  onboarding: m.deck_name_onboarding,
  crossings: m.deck_name_crossings,
  'chat-pieces': m.deck_name_chat_pieces,
  'canvas-pieces': m.deck_name_canvas_pieces,
  shared: m.deck_name_shared,
  tokens: m.deck_name_tokens,
}

/** What is typed after a `/` in the chat to go to a slide, in the reader's language. */
export const slideName = (slide: SlideId) => names[slide]()

/**
 * The slides a word typed after a `/` finds, in their order: those whose name or title holds it,
 * case and accents aside; every slide for nothing typed.
 */
export function slidesFor(typed: string): SlideId[] {
  const text = folded(typed.trim())
  return slideIds.filter(
    (slide) => folded(slideName(slide)).includes(text) || folded(slideTitle(slide)).includes(text),
  )
}

/** The slide a word names exactly, as `/name` sends it; none for a word no slide answers to. */
export function slideNamed(typed: string): SlideId | undefined {
  const text = folded(typed.trim())
  return slideIds.find((slide) => folded(slideName(slide)) === text)
}

/**
 * The deck's part of the URL: the slide shown, the first when absent, and the piece its chapter
 * shows, the chapter's first when absent or another chapter's.
 */
const DeckSearch = Schema.Struct({
  slide: Schema.optionalKey(orDefault(Schema.Literals(slideIds))),
  piece: Schema.optionalKey(orDefault(Schema.String.check(Schema.isMaxLength(40)))),
})

/** Reads the URL's search params, field by field. */
export const readDeckSearch = readSearch(DeckSearch)
