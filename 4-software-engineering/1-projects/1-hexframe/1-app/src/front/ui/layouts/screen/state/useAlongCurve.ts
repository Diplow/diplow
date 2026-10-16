// What rides the curve: an element of the conversation kept just inside the curve the chat is cut
// along, wherever it is scrolled to, so it slides along the curve as the conversation scrolls. Only
// wide, where the chat's column is cut (`data-curve`, the `Screen`'s); elsewhere, on a phone or off
// the screen, it stays where its own classes put it. How far it reaches into its parent's content it
// tells the parent as `--along-curve`, so what sits beside it there keeps clear of it and no further.
import { useLayoutEffect, type RefObject } from 'react'

import { curveAcross } from '../curve'

/** How far inside the curve what rides it keeps, in px. */
const inside = 10

/** How far what sits beside it keeps from it, in px. */
const beside = 8

/**
 * Keeps `element`, absolutely placed in its offset parent, just inside the curve at its own height,
 * as the conversation scrolls, the screen resizes or its parent grows.
 */
export function useAlongCurve(element: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const riding = element.current
    const parent = riding?.offsetParent
    if (!riding || !(parent instanceof HTMLElement)) return
    let frame = 0
    const place = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        ride(riding, parent)
      })
    }
    ride(riding, parent)
    const resized = new ResizeObserver(place)
    resized.observe(parent)
    document.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      document.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
    }
  }, [element])
}

/** Places `riding` just inside the curve at its height, or hands it back to its classes. */
function ride(riding: HTMLElement, parent: HTMLElement) {
  const column = riding.closest('[data-curve]')
  if (column === null || getComputedStyle(column).clipPath === 'none') {
    riding.style.removeProperty('left')
    riding.style.removeProperty('right')
    parent.style.removeProperty('--along-curve')
    return
  }
  const own = riding.getBoundingClientRect()
  const across = curveAcross(column.getBoundingClientRect(), own.top + own.height / 2)
  const left = across - inside - own.width - parent.getBoundingClientRect().left
  riding.style.left = `${String(Math.round(left))}px`
  riding.style.right = 'auto'
  // Where the parent's content ends, past which nothing beside it needs to keep clear.
  const content = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingRight)
  const reach = Math.max(0, Math.round(content - left + beside))
  parent.style.setProperty('--along-curve', `${String(reach)}px`)
}
