// Where the keyboard's focus goes back once what held it goes: what had the focus as a piece opened,
// noted, then given it back if it is still on the page. The dialog, the widgets and the screen give it
// back so, so it sits beside the motion, which both sides and the screen read too.

/** What holds the focus now, as something the focus can be given back to; none off a page. */
export function focusHeld(): HTMLElement | SVGElement | null {
  if (typeof document === 'undefined') return null
  const held = document.activeElement
  return held instanceof HTMLElement || held instanceof SVGElement ? held : null
}

/** Whether the focus fell to the page, nothing holding it. */
export const focusLost = () =>
  document.activeElement === null || document.activeElement === document.body

/** Gives the focus back to what had it, if it is still on the page; whether it did. */
export function giveFocusBack(
  to: HTMLElement | SVGElement | null,
  options?: FocusOptions,
): boolean {
  if (to?.isConnected !== true) return false
  to.focus(options)
  return true
}
