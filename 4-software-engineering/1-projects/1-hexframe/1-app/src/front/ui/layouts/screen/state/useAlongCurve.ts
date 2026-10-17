// What follows the curve the chat is cut along, wherever the conversation is scrolled to: the curve
// stays on the screen while the conversation slides under it, so each follower is placed again as it
// scrolls, as the screen resizes and as what it sits in grows. Only wide, where the chat's column is
// cut (`data-curve`, the `Screen`'s); on a phone, or off the screen, each stays where its own classes
// put it. It follows one of two ways.
// What rides the curve, a widget's tools, is kept just inside it at its own height, and tells its
// parent how far it reaches into its content (`--along-curve`), so what sits beside it keeps clear.
// What runs to the curve, every row of the chat that reaches its lines' end, is told how much further
// right it may go (`--to-curve`), to the curve's nearest across its own height, the chat's gap short
// of it, and spends it, as a negative margin (`runsToCurve`) or a shift, so the chat's right side is
// the curve's: a message line by line, an event and its time, a receipt, a day's split, the agent's
// thinking, a widget's head, body, actions and rows, the composer's rows and its list. What holds rows
// that run on their own runs as far as the farthest of them, so its box holds them all, and each row
// in it draws back to keep its own gap.
// All of them are measured, then each written, at once: a conversation holds a row per line, and a
// write between two reads would lay the page out again for each.
import { useEffect, useLayoutEffect, type RefObject } from 'react'

import { curveAcross, type Box } from '../curve'

/** How far inside the curve what rides it keeps, in px. */
const inside = 10

/** How far what sits beside it keeps from it, in px. */
const beside = 8

/** How far what runs to the curve keeps from it, in px: the gap of `--screen-clear`. */
const gap = 20

/**
 * How a row its parent's whole width spends `--to-curve`: as its right margin, so it runs on that far,
 * its words wrapping there and what sits at its end going with it.
 */
export const runsToCurve = 'mr-[calc(var(--to-curve,0px)*-1)]'

/**
 * A ref telling its element, as `--to-curve`, how much further right it may run: to the curve's
 * nearest across its own height, the chat's gap short of it, wherever the conversation is scrolled to;
 * less than nothing inside what runs further, so it keeps its own gap; nothing for what stops short of
 * the chat's lines' end, as a field beside another does. Its element spends it all (`runsToCurve`, or
 * a shift): where it ends is read from where it is, less what it ran.
 */
export function toCurve(element: HTMLElement | null) {
  return element === null ? undefined : runTo(element, nearest)
}

/**
 * `toCurve` for what holds rows running to the curve on their own: it runs as far as the curve lets
 * the farthest of them, where it bows out most across its height, so its box, its outline and its
 * click hold them all. What it holds of its own, outside those rows, never reaches its end.
 */
export function toCurveHolding(element: HTMLElement | null) {
  return element === null ? undefined : runTo(element, farthest)
}

/** `toCurve`, for a piece that holds its element's ref already. */
export function useToCurve(element: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => toCurve(element.current), [element])
}

/**
 * Keeps `element`, absolutely placed in its offset parent, just inside the curve at its own height,
 * as the conversation scrolls, the screen resizes or what it sits in grows.
 */
export function useAlongCurve(element: RefObject<HTMLElement | null>) {
  useLayoutEffect(
    () => (element.current === null ? undefined : follow(element.current, ride)),
    [element],
  )
}

/**
 * Whatever follows the curve follows it again as `scroller`, the conversation's, or `content`, what it
 * holds, resizes: either slides what they hold under the curve without a scroll, as the foot below a
 * conversation too short to scroll grows, or a line above the others comes or goes.
 */
export function useCurveFollowed(
  scroller: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const resized = new ResizeObserver(inNextFrame)
    for (const each of [scroller.current, content.current]) if (each !== null) resized.observe(each)
    return () => {
      resized.disconnect()
    }
  }, [scroller, content])
}

/**
 * How a follower follows, given the box of the column it is cut along, none where the chat isn't cut:
 * measured, it hands back what it writes, nothing where all stays as it is.
 */
type Follow = (element: HTMLElement, cut: Box | undefined) => (() => void) | undefined

/** Everything following the curve now, each with how it follows. */
const followers = new Map<HTMLElement, Follow>()

/** Each follower's size, watched while any follows: the server has no observer. */
let resized: ResizeObserver | undefined

/** Runs `element` to where the curve passes `at` across its height, its own reach from the start. */
function runTo(element: HTMLElement, at: Across) {
  // Its own from the start, so it never runs on with what holds it.
  put(element, '--to-curve', '0px')
  return follow(element, (running, cut) => reachCurve(running, cut, at))
}

/** Follows `element` from now on, placed before it shows; what it hands back stops it. */
function follow(element: HTMLElement, how: Follow) {
  if (followers.size === 0) listen()
  followers.set(element, how)
  resized?.observe(element)
  beforeShown()
  return () => {
    followers.delete(element)
    resized?.unobserve(element)
    if (followers.size === 0) stopListening()
    else beforeShown()
  }
}

/** The scroll, the screen's size and each follower's, listened to while any follows. */
function listen() {
  resized = new ResizeObserver(inNextFrame)
  document.addEventListener('scroll', inNextFrame, { capture: true, passive: true })
  window.addEventListener('resize', inNextFrame)
}

function stopListening() {
  resized?.disconnect()
  resized = undefined
  document.removeEventListener('scroll', inNextFrame, { capture: true })
  window.removeEventListener('resize', inNextFrame)
}

let frame = 0

/** Every follower measured again in the next frame, however often it is asked before. */
function inNextFrame() {
  if (frame !== 0) return
  frame = requestAnimationFrame(() => {
    frame = 0
    followAll()
  })
}

let queued = false

/**
 * Every follower measured again before the page is next drawn, once React is done: a row just come is
 * placed before it shows, and so is what it moved, all of a commit's rows in one go.
 */
function beforeShown() {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    followAll()
  })
}

/** Every follower measured first, then each written: one layout for all of them. */
function followAll() {
  const cuts = new Map<Element, Box | undefined>()
  const writes = Array.from(followers, ([element, how]) => how(element, cutOf(element, cuts)))
  for (const write of writes) write?.()
}

/** The box of the column `element` sits in, cut along the curve, read once however many sit there. */
function cutOf(element: HTMLElement, cuts: Map<Element, Box | undefined>) {
  const column = element.closest('[data-curve]')
  if (column === null) return undefined
  if (!cuts.has(column)) {
    const cut = getComputedStyle(column).clipPath !== 'none'
    cuts.set(column, cut ? column.getBoundingClientRect() : undefined)
  }
  return cuts.get(column)
}

/** Sets `property` on `element`, or takes it off for none, unless it holds that already. */
function put(element: HTMLElement, property: string, value: string | undefined) {
  if (element.style.getPropertyValue(property) === (value ?? '')) return
  if (value === undefined) element.style.removeProperty(property)
  else element.style.setProperty(property, value)
}

/** Places `riding` just inside the curve at its height, or hands it back to its classes. */
function ride(riding: HTMLElement, cut: Box | undefined) {
  const parent = riding.offsetParent
  // Hidden, it has nowhere to be placed.
  if (!(parent instanceof HTMLElement)) return undefined
  if (cut === undefined)
    return () => {
      put(riding, 'left', undefined)
      put(riding, 'right', undefined)
      put(parent, '--along-curve', undefined)
    }
  const own = riding.getBoundingClientRect()
  const across = curveAcross(cut, own.top + own.height / 2)
  const left = Math.round(across - inside - own.width - parent.getBoundingClientRect().left)
  // How far it reaches into its parent's content: less than nothing once it rides past its end.
  const content = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingRight)
  const reach = Math.round(content - left + beside)
  return () => {
    put(riding, 'left', `${String(left)}px`)
    put(riding, 'right', 'auto')
    put(parent, '--along-curve', `${String(reach)}px`)
  }
}

/** Where the curve passes across a height, from `top` to `bottom`, in a column cut along it. */
type Across = (cut: Box, top: number, bottom: number) => number

/** Where it is nearest: at the top or the foot, since it bows away from the chat between. */
const nearest: Across = (cut, top, bottom) =>
  Math.min(curveAcross(cut, top), curveAcross(cut, bottom))

/** Where it is farthest: where it bows most, at mid-height, if that is held, else the end nearer it. */
const farthest: Across = (cut, top, bottom) => {
  const middle = cut.top + cut.height / 2
  if (top <= middle && middle <= bottom) return curveAcross(cut, middle)
  return Math.max(curveAcross(cut, top), curveAcross(cut, bottom))
}

/**
 * Tells `running` how much further the curve lets it run, to where it passes `at` across its height,
 * the chat's gap short of it. What stops short of the chat's lines' end runs no further: something is
 * beside it there.
 */
function reachCurve(running: HTMLElement, cut: Box | undefined, at: Across) {
  if (cut === undefined) return reaching(running, 0)
  const own = running.getBoundingClientRect()
  // Hidden, a fold shut over it: it is measured again once it shows.
  if (own.width === 0 && own.height === 0) return reaching(running, 0)
  // Where it would end did it not run on, and where the chat's lines end: the curve's nearest
  // anywhere, at the screen's top and its foot, less the gap.
  const end = own.right - (parseFloat(running.style.getPropertyValue('--to-curve')) || 0)
  const lines = curveAcross(cut, cut.top) - gap
  if (end < lines - 1) return reaching(running, 0)
  return reaching(running, Math.round(at(cut, own.top, own.bottom) - gap - end))
}

/** What tells `running` to run `reach` px further. */
function reaching(running: HTMLElement, reach: number) {
  return () => {
    put(running, '--to-curve', `${String(reach)}px`)
  }
}
