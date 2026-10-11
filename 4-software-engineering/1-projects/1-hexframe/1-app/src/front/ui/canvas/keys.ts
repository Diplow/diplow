// The keys of an SVG shape that stands for a button (`role="button"`), which the browser does not give
// it: Enter acts as it goes down, once per press, not once per repeat; Space acts as it comes up, and
// going down it only keeps the page from scrolling.
import type { KeyboardEvent } from 'react'

interface Press {
  /** Enter, gone down; the event says which modifier was held. */
  readonly onEnter: (event: KeyboardEvent) => void
  /** Space, come up. */
  readonly onSpace: (event: KeyboardEvent) => void
}

/** The `onKeyDown` and `onKeyUp` handlers that make a shape press like a button. */
export function buttonKeys({ onEnter, onSpace }: Press) {
  return {
    onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      if (event.key === 'Enter' && !event.repeat) onEnter(event)
    },
    onKeyUp(event: KeyboardEvent) {
      if (event.key !== ' ') return
      event.preventDefault()
      onSpace(event)
    },
  }
}
