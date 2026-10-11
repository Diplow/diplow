// Which side of the screen is in front on a phone: the chat when the screen opens, the canvas once the
// seam brings it forward, the chat once the seam gives it back. The chat pointing at the canvas, a
// Message's link centering its Tile, is a crossing: the canvas comes forward to show it. A wide screen
// shows both sides, so the side in front waits there for the screen to fold.
import { useReducer } from 'react'

import type { Side } from '../Screen'

interface State {
  readonly front: Side
}

interface Turned {
  readonly to: Side
}

const initial: State = { front: 'chat' }

function reducer(state: State, { to }: Turned): State {
  return state.front === to ? state : { front: to }
}

/** The screen's side in front, for `Screen`'s `front` and `onFrontChange`. */
export function useScreenState() {
  const [state, dispatch] = useReducer(reducer, initial)
  return {
    state,
    actions: {
      /** The seam turned the screen: a tap, a drag or the keyboard. */
      turn: (to: Side) => {
        dispatch({ to })
      },
      /** The chat pointed at the canvas: the canvas comes forward to show what it pointed at. */
      cross: () => {
        dispatch({ to: 'canvas' })
      },
    },
  }
}
