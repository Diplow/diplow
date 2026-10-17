// Where the news goes once what asked for a decision is decided and gives its surface back. Decided
// from it, the focus it held moves to the receipt it leaves, so the keyboard never falls back to the
// top of the page; decided elsewhere, in another tab or by a poll, the focus stays where the user is
// and a status says the decision instead. While it asks, the focus counts as inside until it leaves
// for good, so a step of its own that removes what had the focus, which blurs nothing, finds it still
// inside and gives it back. The Proposal and the widgets hand off so (`entries/Receipt.tsx`,
// `UntilDecided`).
import { type FocusEvent, useReducer } from 'react'

/** Whether it still waits for a decision, or it is decided. */
type Standing = 'open' | 'decided'

interface State {
  /** How it stood when last drawn. */
  readonly shown: Standing
  /** The focus is inside it, or in a dialog it opened. */
  readonly focused: boolean
  /** The receipt takes the focus as it comes. */
  readonly handOff: boolean
  /** What the status says: the decision, when the focus does not carry it. */
  readonly status: string
}

type Event =
  | { readonly type: 'focused' }
  | { readonly type: 'left' }
  | { readonly type: 'moved'; readonly to: Standing; readonly decided: string }

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'focused':
      return { ...state, focused: true }
    case 'left':
      return { ...state, focused: false }
    case 'moved':
      if (state.shown === 'open' && event.to === 'decided') {
        const { focused } = state
        return {
          shown: 'decided',
          focused: false,
          handOff: focused,
          status: focused ? '' : event.decided,
        }
      }
      // Open again, or still decided: nothing to hand off, nothing to say.
      return { shown: event.to, focused: false, handOff: false, status: '' }
  }
}

/** The hand-off of a piece that is `open` or decided, which says `decided` once it is. */
export function useHandOffState(standing: Standing, decided: string) {
  const [state, dispatch] = useReducer(reducer, {
    shown: standing,
    focused: false,
    handOff: false,
    status: '',
  })
  // The standing is the caller's: as it moves, the state follows in the same render.
  if (state.shown !== standing) dispatch({ type: 'moved', to: standing, decided })
  return {
    handOff: state.handOff,
    status: state.status,
    /** The focus is inside, or was when what held it went with a step of its own. */
    focused: state.focused,
    onFocus: () => {
      dispatch({ type: 'focused' })
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      // The focus left for good, not for a dialog it opened, which takes the focus next and whose
      // events reach it through React's tree.
      if (!event.currentTarget.contains(event.relatedTarget)) dispatch({ type: 'left' })
    },
  }
}
