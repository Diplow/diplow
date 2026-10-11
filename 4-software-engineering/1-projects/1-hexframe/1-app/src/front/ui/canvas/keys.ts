// The keys of an SVG shape that stands for a button (`role="button"`), which the browser does not give
// it: Enter acts as it goes down, once per press, not once per repeat; Space acts as it comes up, and
// going down it only keeps the page from scrolling.
import type { Slot } from 'radix-ui'
import type { ComponentProps, KeyboardEvent } from 'react'

/** What a click on a shape that stands for a button does, and its name for a screen reader. */
export interface Action {
  readonly label: string
  readonly onSelect: () => void
}

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

/**
 * What a trigger hands the shape it opens on, a menu's or a hover card's: its ref, its handlers and
 * its attributes, composed with the shape's own by Radix's `Slot`, so both run. Radix types them for
 * an HTML element; they hold on an SVG group alike.
 */
export type Hand = ComponentProps<typeof Slot.Root>
