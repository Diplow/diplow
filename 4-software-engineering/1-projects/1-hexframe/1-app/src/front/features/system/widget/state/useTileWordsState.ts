// What the user writes in a tile widget: its Title, Preview and Body, and the refusal its last write
// met, on the fields it names. The widget opens on a Tile's words, or blank; a write refused comes
// back with what the user typed and the refusal on its field (`useRefusalState` reopens it), and each
// field's refusal clears as the user changes that field. A refusal arriving again, a later turn,
// puts its words back again.
import { useState } from 'react'

import type { TileWords } from '#/front/ui/chat/widgets/tile/parts'

import { type Refusal, stillRefused } from '../place'

/** A write refused and put back: its turn, what the user had typed, and what the widget shows of it. */
export interface Refilled {
  readonly turn: number
  readonly words: TileWords
  readonly refused: Refusal | undefined
}

interface State {
  readonly words: TileWords
  readonly refused: Refusal | undefined
  /** The refusal last put back, by its turn; none before the first. */
  readonly turn: number | undefined
}

const fromRefill = (refilled: Refilled): State => ({
  words: refilled.words,
  refused: refilled.refused,
  turn: refilled.turn,
})

/** The widget's words, opened on `opened` or on what a refusal put back. */
export function useTileWordsState(opened: TileWords, refilled: Refilled | undefined) {
  const [state, setState] = useState<State>(() =>
    refilled === undefined
      ? { words: opened, refused: undefined, turn: undefined }
      : fromRefill(refilled),
  )
  // A refusal of a later turn puts its words back, over what the widget held.
  const current =
    refilled !== undefined && refilled.turn !== state.turn ? fromRefill(refilled) : state
  if (current !== state) setState(current)
  return {
    state: { words: current.words, refused: current.refused },
    actions: {
      /** The user changed the words: a refusal stays on the fields they left as they were. */
      change: (words: TileWords) => {
        setState((before) => ({
          ...before,
          words,
          refused: stillRefused(before.refused, before.words, words),
        }))
      },
    },
  }
}
