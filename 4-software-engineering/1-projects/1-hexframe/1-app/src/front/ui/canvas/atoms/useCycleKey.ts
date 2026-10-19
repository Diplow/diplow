// The canvas's own key, C, which cycles the center's views from anywhere on the page but a field, a
// menu or a dialog: listened for on the window, since the canvas holds no focus of its own.
import { useEffect, useRef, type RefObject } from 'react'

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
    const onKey = (event: KeyboardEvent) => {
      // An autofill's keydown carries no key, and a key composing a character is the field's.
      if (typeof event.key !== 'string' || event.isComposing) return
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
