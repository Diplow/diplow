// What rides the curve: an element of the conversation kept just inside the curve the chat is cut
// along, wherever it is scrolled to, so it slides along the curve as the conversation scrolls. Only
// wide, where the chat's column is cut (`data-curve`, the `Screen`'s); elsewhere, on a phone or off
// the screen, it stays where its own classes put it. How far it reaches into its parent's content it
// tells the parent as `--along-curve`, so what sits beside it there keeps clear of it and no further.
// And what runs up to the curve: an element told how much further right it may go, as `--to-curve`,
// to the curve's nearest across its own height, then the gap the chat keeps everywhere: a widget's
// body, or a line's time, so the times stack up along the curve.
import { useLayoutEffect, type RefObject } from 'react'

import { curveAcross } from '../curve'

/** How far inside the curve what rides it keeps, in px. */
const inside = 10

/** How far what sits beside it keeps from it, in px. */
const beside = 8

/** How far what runs up to the curve keeps from it, in px: the gap of `--screen-clear`. */
const gap = 20

/**
 * Keeps `element`, absolutely placed in its offset parent, just inside the curve at its own height,
 * as the conversation scrolls, the screen resizes or its parent grows.
 */
export function useAlongCurve(element: RefObject<HTMLElement | null>) {
  useFollowingCurve(element, ride)
}

/**
 * Tells `element`, as `--to-curve`, how much further right than its offset parent's content it may
 * run, to the curve's nearest across its height less the chat's gap, as the conversation scrolls, the
 * screen resizes or it grows. Its caller spends it, as a negative margin or a shift.
 */
export function useToCurve(element: RefObject<HTMLElement | null>) {
  useFollowingCurve(element, reachCurve)
}

/** What follows the curve measures where it is, then hands back what it writes. */
type Follow = (element: HTMLElement, parent: HTMLElement) => () => void

/** Those due in the next frame, each its measure. */
const due = new Set<() => () => void>()
let frame = 0

/**
 * Every follower due measured first, then each written, in one frame: a conversation holds a time
 * per line, and a write between two reads would lay the page out again for each.
 */
function followInFrame(measure: () => () => void) {
  due.add(measure)
  if (frame !== 0) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const writes = Array.from(due, (each) => each())
    due.clear()
    for (const write of writes) write()
  })
}

/**
 * Runs `follow` on `element` and its offset parent now, then each time the curve may have moved. The
 * parent is found at each turn, so what a fold hid at first follows once it shows.
 */
function useFollowingCurve(element: RefObject<HTMLElement | null>, follow: Follow) {
  useLayoutEffect(() => {
    const riding = element.current
    if (!riding) return
    const measure = () => {
      const parent = riding.offsetParent
      return parent instanceof HTMLElement ? follow(riding, parent) : () => undefined
    }
    const place = () => {
      followInFrame(measure)
    }
    measure()()
    const resized = new ResizeObserver(place)
    resized.observe(riding)
    if (riding.offsetParent) resized.observe(riding.offsetParent)
    document.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', place)
    return () => {
      due.delete(measure)
      resized.disconnect()
      document.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
    }
  }, [element, follow])
}

/** The column the chat is cut along, should it be: none on a phone, nor off the screen. */
function cutColumn(element: HTMLElement) {
  const column = element.closest('[data-curve]')
  return column === null || getComputedStyle(column).clipPath === 'none' ? undefined : column
}

/** Places `riding` just inside the curve at its height, or hands it back to its classes. */
function ride(riding: HTMLElement, parent: HTMLElement) {
  const column = cutColumn(riding)
  if (column === undefined)
    return () => {
      riding.style.removeProperty('left')
      riding.style.removeProperty('right')
      parent.style.removeProperty('--along-curve')
    }
  const own = riding.getBoundingClientRect()
  const across = curveAcross(column.getBoundingClientRect(), own.top + own.height / 2)
  const left = across - inside - own.width - parent.getBoundingClientRect().left
  // Where the parent's content ends, past which nothing beside it needs to keep clear.
  const content = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingRight)
  const reach = Math.max(0, Math.round(content - left + beside))
  return () => {
    riding.style.left = `${String(Math.round(left))}px`
    riding.style.right = 'auto'
    parent.style.setProperty('--along-curve', `${String(reach)}px`)
  }
}

/**
 * Tells `running` how far past its parent's content the curve lets it run: to where the curve is
 * nearest across its height, its top or its foot, since the curve bows away from the chat between.
 */
function reachCurve(running: HTMLElement, parent: HTMLElement) {
  const column = cutColumn(running)
  if (column === undefined)
    return () => {
      running.style.removeProperty('--to-curve')
    }
  const own = running.getBoundingClientRect()
  const cut = column.getBoundingClientRect()
  const nearest = Math.min(curveAcross(cut, own.top), curveAcross(cut, own.bottom))
  const box = parent.getBoundingClientRect()
  const content = box.right - parseFloat(getComputedStyle(parent).paddingRight)
  const reach = Math.max(0, Math.round(nearest - gap - content))
  return () => {
    running.style.setProperty('--to-curve', `${String(reach)}px`)
  }
}
