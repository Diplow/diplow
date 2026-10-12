// Which side of the screen is in front on a phone: the chat when the screen opens, the canvas once the
// seam brings it forward, the chat once the seam gives it back. The chat pointing at the canvas, a
// Message's link centering its Tile, is a crossing: the canvas comes forward to show it, then gives
// the chat back after a glance (`--duration-glance`, HEX-108), unless it was taken meanwhile, by the
// seam or a hand on it. A wide screen shows both sides, so the side in front waits there for the
// screen to fold.
import { useEffect, useReducer } from 'react'

import { durationOf } from '../../../motion'
import type { Side } from '../Screen'

interface State {
  readonly front: Side
  /**
   * The crossing the canvas is in front for, counted, until it gives the chat back; 0 once taken or
   * given back. Another crossing meanwhile starts the glance again.
   */
  readonly glance: number
  /** What the last crossing showed, said to a screen reader, which the chat no longer shows. */
  readonly said: string | undefined
}

type Event =
  | { readonly kind: 'turned'; readonly to: Side }
  | { readonly kind: 'crossed'; readonly said: string | undefined }
  | { readonly kind: 'glanced'; readonly glance: number }

const initial: State = { front: 'chat', glance: 0, said: undefined }

function reducer(state: State, event: Event): State {
  switch (event.kind) {
    case 'turned':
      return state.front === event.to && state.glance === 0
        ? state
        : { ...state, front: event.to, glance: 0 }
    case 'crossed':
      // The canvas taken already stays as it is: a crossing gives back only what it took.
      if (state.front === 'canvas' && state.glance === 0) return { ...state, said: event.said }
      return { front: 'canvas', glance: state.glance + 1, said: event.said }
    case 'glanced':
      return state.glance === event.glance ? { ...state, front: 'chat', glance: 0 } : state
  }
}

/** The screen's side in front, for `Screen`'s `front`, `onFrontChange` and `said`. */
export function useScreenState() {
  const [state, dispatch] = useReducer(reducer, initial)
  const { glance } = state
  useEffect(() => {
    if (glance === 0) return undefined
    const timer = setTimeout(() => {
      dispatch({ kind: 'glanced', glance })
    }, durationOf('--duration-glance'))
    return () => {
      clearTimeout(timer)
    }
  }, [glance])
  return {
    state,
    actions: {
      /** The seam turned the screen, or a hand took the canvas: it stays as it is turned. */
      turn: (to: Side) => {
        dispatch({ kind: 'turned', to })
      },
      /**
       * The chat pointed at the canvas: the canvas comes forward to show what it pointed at, `said` to a
       * screen reader, then gives the chat back.
       */
      cross: (said?: string) => {
        dispatch({ kind: 'crossed', said })
      },
    },
  }
}
