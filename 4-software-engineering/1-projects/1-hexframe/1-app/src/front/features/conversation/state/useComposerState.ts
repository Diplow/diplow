// The composer's state on home: what the field holds and where its caret stands, the links picked
// since the last Message, and whether the user left the list. From them, what the caret stands in
// lists, a `/` the commands offered, the language the languages, an `@` the Account's Tiles; what the
// field shows marked; what a pick puts in the field, or the language it goes to; and what a Message
// sent is, a command to run or words for the agent, the field emptied for the next. The reading is
// `../composer/typing.ts`, pure; this hook holds what it reads.
import { useReducer } from 'react'

import type { Command } from '#/front/ui/chat/composer/commands'

import type { Inserted, Mentionable } from '../composer/mention'
import {
  type Field,
  marksOf,
  type Pick,
  pickOf,
  type Sent,
  sentOf,
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
    case 'picked':
      return {
        value: event.value,
        caret: event.caret,
        links: event.link === undefined ? state.links : [...state.links, event.link],
        left: false,
      }
    case 'sent':
      return initial
  }
}

/** The composer over the Account's Tiles, offering `among`, the commands the page runs now. */
export function useComposerState(tiles: ReadonlyArray<Mentionable>, among: ReadonlyArray<Command>) {
  const [state, dispatch] = useReducer(reducer, initial)
  const typing = state.left ? undefined : typingAt(state, tiles, among)
  return {
    state: { value: state.value, typing, marks: marksOf(state, among) },
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
      pick: (row: string): Pick | undefined => {
        if (typing === undefined) return undefined
        const picked = pickOf(state, typing, row, tiles)
        if (!('language' in picked)) dispatch({ type: 'picked', ...picked })
        return picked
      },
      /** What the field sends, a command or a Message, the field then emptied for the next. */
      send: (): Sent => {
        dispatch({ type: 'sent' })
        return sentOf(state, among)
      },
    },
  }
}
