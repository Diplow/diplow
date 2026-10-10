// The composer's `@`: the search the caret stands in, opened as the user types an `@` and offering the
// Account's Tiles whose Title holds what follows it; the Tile offered first, which the arrows move;
// Enter or Tab picking it, Escape closing the search until another `@`; and the links picked, which the
// Message is sent with, each by its Tile's id. The input's value stays the form's: an action that
// changes it answers the next value and where the caret goes, for the composer to set.
import { useReducer } from 'react'

import {
  type Edited,
  encoded,
  type Inserted,
  inserted,
  matching,
  type Mentionable,
  type Query,
  queryAt,
  shownOf,
  showsLink,
} from '../composer/mention'

interface State {
  /** The search the caret stands in, none when it stands in none or it was closed. */
  readonly query: Query | undefined
  /** The `@` whose search Escape closed, by its index: it stays closed while the caret is in it. */
  readonly closed: number | undefined
  /** Which of the Tiles offered is active, by its rank. */
  readonly active: number
  /** The links picked since the last Message. */
  readonly links: ReadonlyArray<Inserted>
}

type Event =
  | { readonly type: 'typed'; readonly value: string; readonly caret: number }
  | { readonly type: 'moved'; readonly by: 1 | -1; readonly offered: number }
  | { readonly type: 'closed' }
  | { readonly type: 'picked'; readonly link: Inserted }
  | { readonly type: 'sent' }

const initial: State = { query: undefined, closed: undefined, active: 0, links: [] }

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'typed': {
      const found = queryAt(event.value, event.caret)
      // The `@` of a link picked, the input still showing it whole, opens no search of its own.
      const query =
        found === undefined || showsLink(event.value, found.at, state.links) ? undefined : found
      if (query === undefined) return { ...state, query, closed: undefined, active: 0 }
      if (query.at === state.closed) return { ...state, query: undefined }
      const same = query.at === state.query?.at && query.text === state.query.text
      return { ...state, query, closed: undefined, active: same ? state.active : 0 }
    }
    case 'moved':
      return { ...state, active: (state.active + event.by + event.offered) % event.offered }
    case 'closed':
      // Closed twice, by the list and by the field's key, it stays closed at its `@`.
      if (state.query === undefined) return state
      return { ...state, query: undefined, closed: state.query.at, active: 0 }
    case 'picked':
      return { ...state, query: undefined, active: 0, links: [...state.links, event.link] }
    case 'sent':
      return initial
  }
}

/** The Account's Tiles a composer offers to `@`. */
export function useMentionState(tiles: ReadonlyArray<Mentionable>) {
  const [state, dispatch] = useReducer(reducer, initial)
  const { query } = state
  const offered = query === undefined ? [] : matching(tiles, query.text)
  const open = offered.length > 0
  const active = offered[Math.min(state.active, offered.length - 1)]

  /** The input's value with `tile` picked for the search under way. */
  const pick = (value: string, tile: Mentionable): Edited | undefined => {
    if (query === undefined) return undefined
    const shown = shownOf(tile, state.links)
    dispatch({ type: 'picked', link: { id: tile.id, shown } })
    return inserted(value, query, shown)
  }

  return {
    state: { open, offered, active: open ? active : undefined },
    actions: {
      /**
       * The input's value, and where its caret stands, changed by the user: the `@` of a link picked
       * opens no search, the input still showing it whole.
       */
      typed: (value: string, caret: number) => {
        dispatch({ type: 'typed', value, caret })
      },
      /**
       * A key pressed in the input: whether the search took it, the arrows moving the active Tile,
       * Escape closing the search, Enter and Tab picking the active Tile, the next value then answered.
       */
      key: (key: string, value: string): { readonly taken: boolean; readonly edited?: Edited } => {
        if (!open) return { taken: false }
        switch (key) {
          case 'ArrowDown':
          case 'ArrowUp':
            dispatch({ type: 'moved', by: key === 'ArrowDown' ? 1 : -1, offered: offered.length })
            return { taken: true }
          case 'Escape':
            dispatch({ type: 'closed' })
            return { taken: true }
          case 'Enter':
          case 'Tab': {
            const edited = active === undefined ? undefined : pick(value, active)
            return edited === undefined ? { taken: true } : { taken: true, edited }
          }
          default:
            return { taken: false }
        }
      },
      /** A Tile picked with the pointer, the next value answered. */
      pick,
      /** Closes the search under way, until another `@`. */
      close: () => {
        dispatch({ type: 'closed' })
      },
      /** The Message the input sends, each link picked by its Tile's id; the links forgotten. */
      sent: (value: string): string => {
        dispatch({ type: 'sent' })
        return encoded(value, state.links)
      },
    },
  }
}
