// The composer's state on home: what the field holds and where its caret stands, the links picked
// since the last Message, and whether the user left the list. From them, what the caret stands in
// lists, a `/` the commands offered, the language the languages, an `@` the Account's Tiles; what the
// field shows marked; what a pick puts in the field, or the language it goes to; and what the field
// submits, a command to run, words for the agent, or a language to go to, the field emptied for the
// next; a Tile named from outside, at the caret or first; and where the next Turn works, the field's
// Message read as Assistant reads it, the canvas centered where the page says. The reading is `../composer/typing.ts` and, for what the field shows marked, ui's
// `fieldMarksOf`, both pure; this hook holds what they read.
import { useReducer } from 'react'

import { type Command, fieldMarksOf } from '#/front/ui/chat/composer/commands'

import type { Edited, Inserted, Mentionable } from '../composer/mention'
import {
  type Field,
  type FieldPick,
  namedIn,
  type NameAt,
  pickOf,
  placeOf,
  type Submitted,
  submittedOf,
  typingAt,
} from '../composer/typing'

interface State extends Field {
  /** The list left, by Escape or the field's blur, until the field changes or the caret moves. */
  readonly left: boolean
}

type Event =
  | { readonly type: 'changed'; readonly value: string; readonly caret: number }
  | { readonly type: 'left' }
  | {
      readonly type: 'picked'
      readonly value: string
      readonly caret: number
      readonly link?: Inserted
    }
  | { readonly type: 'sent' }

const initial: State = { value: '', caret: 0, links: [], left: false }

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'changed':
      return { ...state, value: event.value, caret: event.caret, left: false }
    case 'left':
      return { ...state, left: true }
    case 'picked': {
      const { link } = event
      // A Tile named again where the field already shows it keeps its one link.
      const kept =
        link === undefined ||
        state.links.some(({ id, shown }) => id === link.id && shown === link.shown)
      return {
        value: event.value,
        caret: event.caret,
        links: kept ? state.links : [...state.links, link],
        left: false,
      }
    }
    case 'sent':
      return initial
  }
}

/**
 * The composer over the Account's Tiles, offering `among`, the commands the page runs now, the canvas
 * centered on `center`; none while the page can't say.
 */
export function useComposerState(
  tiles: ReadonlyArray<Mentionable>,
  among: ReadonlyArray<Command>,
  center?: string,
) {
  const [state, dispatch] = useReducer(reducer, initial)
  const typing = state.left ? undefined : typingAt(state, tiles, among)
  return {
    state: {
      value: state.value,
      typing,
      marks: fieldMarksOf(state.value, state.links, among),
      /** Where the next Turn works, the Tile the Message opens with, `first`, else the centered one. */
      place: center === undefined ? undefined : placeOf(state, center, tiles),
    },
    actions: {
      /** The field changed, or its caret moved. */
      change: (value: string, caret: number) => {
        dispatch({ type: 'changed', value, caret })
      },
      /** The list left, until the field changes. */
      leave: () => {
        dispatch({ type: 'left' })
      },
      /**
       * A row taken, by its id: the field's next value and where its caret goes, for the composer to
       * set, or the language to go to. None while nothing is listed.
       */
      pick: (row: string): FieldPick | undefined => {
        if (typing === undefined) return undefined
        const picked = pickOf(state, typing, row, tiles)
        if (!('language' in picked)) dispatch({ type: 'picked', ...picked })
        return picked
      },
      /**
       * A Tile named from outside, by its id: the field's next value and where its caret goes, for the
       * composer to set; none for a Tile the page can't name.
       */
      name: (tile: string, where: NameAt): (Edited & { readonly link: Inserted }) | undefined => {
        const found = tiles.find(({ id }) => id === tile)
        if (found === undefined) return undefined
        const named = namedIn(state, found, where)
        dispatch({ type: 'picked', ...named })
        return named
      },
      /**
       * What the field submits, a command or a Message, the field then emptied for the next; none,
       * the field kept, when it names a language hexframe is not in.
       */
      submit: (): Submitted | undefined => {
        const submitted = submittedOf(state, among)
        if (submitted !== undefined) dispatch({ type: 'sent' })
        return submitted
      },
    },
  }
}
