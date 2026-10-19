// The keys of an SVG shape that stands for a button (`role="button"`), which the browser does not give
// it: Enter acts as it goes down, once per press, not once per repeat; Space acts as it comes up, and
// going down it only keeps the page from scrolling. ⇧↵ is no click: on a tile it goes in, which is
// its caller's, or its menu's. And the canvas's own key, C, which cycles the center's views from
// anywhere on the page but a field, a menu or a dialog.
import type { Slot } from 'radix-ui'
import { useEffect, useRef, type ComponentProps, type KeyboardEvent, type RefObject } from 'react'

/** What a click on a shape that stands for a button does, and its name for a screen reader. */
export interface Action {
  readonly label: string
  readonly onSelect: () => void
}

interface Press {
  /** Enter, gone down, without Shift. */
  readonly onEnter: () => void
  /** Space, come up. */
  readonly onSpace: () => void
  /** ⇧↵, gone down; without it, the key is left to whatever listens around the shape. */
  readonly onShiftEnter?: () => void
}

/** The `onKeyDown` and `onKeyUp` handlers that make a shape press like a button. */
export function buttonKeys({ onEnter, onSpace, onShiftEnter }: Press) {
  return {
    onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.key === 'Enter' && event.shiftKey) {
        if (onShiftEnter === undefined) return
        event.preventDefault()
        if (!event.repeat) onShiftEnter()
        return
      }
      event.preventDefault()
      if (event.key === 'Enter' && !event.repeat) onEnter()
    },
    onKeyUp(event: KeyboardEvent) {
      if (event.key !== ' ') return
      event.preventDefault()
      onSpace()
    },
  }
}

/**
 * What a trigger hands the shape it opens on, a menu's or a hover card's: its ref, its handlers and
 * its attributes, composed with the shape's own by Radix's `Slot`, so both run. Radix types them for
 * an HTML element; they hold on an SVG group alike.
 */
export type Hand = ComponentProps<typeof Slot.Root>

/** Where a key is typed, or belongs to what holds it: a field, a menu or a dialog. */
const heldElsewhere = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]',
  ) !== null

/**
 * The C key, pressed anywhere on the page but where it is typed or held (`heldElsewhere`), once per
 * press and with no modifier but Shift: `onCycle`, the center's next view. Not while the canvas is
 * inert, the one a journey leaves behind, nor once another listener took the key. Without `onCycle`,
 * the key is left alone.
 */
export function useCycleKey(canvas: RefObject<Element | null>, onCycle: (() => void) | undefined) {
  const latest = useRef(onCycle)
  useEffect(() => {
    latest.current = onCycle
  })
  const listens = onCycle !== undefined
  useEffect(() => {
    if (!listens) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c' || event.repeat || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey || heldElsewhere(event.target)) return
      if (canvas.current === null || canvas.current.closest('[inert]') !== null) return
      event.preventDefault()
      latest.current?.()
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
    }
  }, [listens, canvas])
}
