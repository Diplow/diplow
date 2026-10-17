// How long a motion lasts, read from its token on the page, so the code waiting on it follows the
// stylesheet: `--duration-fold`, `--duration-glide`, `--duration-flare`, the camera's
// `--duration-camera` and `--duration-camera-level`, a journey's `--duration-journey`, and how long
// the canvas stays in front on a phone after a crossing, `--duration-glance`; and how a motion eases,
// read off the element its utility eases (`ease-camera`). What moves waits for nothing with reduced
// motion; a light that only fades, the flare, and a glance, last as long either way. And the clock
// of a play in beats, one every `--stagger-beat`, and the parts the tutorial tells a tile's words in
// by it, lit on the canvas and said in the chat at once (HEX-120); and a tile's six as they land
// around it, which the chat lights its body's lines by, and what the agent says of them then
// (HEX-122). Both sides and the screen read it, so it sits beside the theme.
import { useEffect, useEffectEvent, useState } from 'react'

/**
 * A duration token's value in milliseconds, `500ms` or `1.3s`, as the page's root sets it, a stagger's
 * too; 0 off a page, or where the token is unset.
 */
export function durationOf(token: `--duration-${string}` | `--stagger-${string}`): number {
  if (typeof window === 'undefined') return 0
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const amount = parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('ms') ? amount : amount * 1000
}

/**
 * How long a motion that moves something lasts, or how far apart its steps are: its token's
 * duration, none with reduced motion.
 */
export function movingFor(token: `--duration-${string}` | `--stagger-${string}`): number {
  if (typeof window === 'undefined') return 0
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationOf(token)
}

/**
 * How an element's motion eases, as the easing utility on it (`ease-camera`) sets it, the token's
 * own curve: `@theme inline` leaves no variable on the page to read it from. `ease-in-out` off a
 * page, or where the element sets none.
 */
export function easingOf(element: Element | null): string {
  if (typeof window === 'undefined' || element === null) return 'ease-in-out'
  const easing = getComputedStyle(element).transitionTimingFunction.trim()
  return easing === '' || easing === 'ease' ? 'ease-in-out' : easing
}

/**
 * The beat a play has reached, one every `--stagger-beat` once `playing` turns on, up to `count`: 0
 * before the first, and again from the start each time `playing` turns on anew; `onBeat` hears each
 * as it comes. A beat only lights and says something, so it lasts as long with reduced motion: what
 * it shows comes without moving.
 */
export function useBeats(count: number, playing: boolean, onBeat?: (beat: number) => void): number {
  const [beat, setBeat] = useState(0)
  const heard = useEffectEvent((reached: number) => {
    onBeat?.(reached)
  })
  useEffect(() => {
    if (!playing) return
    const every = durationOf('--stagger-beat')
    const timers = Array.from({ length: count }, (_, index) => {
      const reached = index + 1
      return setTimeout(() => {
        setBeat(reached)
        heard(reached)
      }, every * reached)
    })
    return () => {
      timers.forEach(clearTimeout)
      setBeat(0)
    }
  }, [count, playing])
  return playing ? beat : 0
}

/**
 * What the agent tells of a tile, one part at each beat: its title, its preview, then its body. Both
 * sides read it: the canvas lights the part told, the chat says it (HEX-120).
 */
const toldInTurn = ['title', 'preview', 'body'] as const

export type ToldPart = (typeof toldInTurn)[number]

/**
 * The part of a tile's words the agent has told so far, a beat at a time while `telling`, from the
 * start each time it tells anew; none before the first; `onTold` hears each part as it comes.
 */
export function useTold(telling: boolean, onTold?: (part: ToldPart) => void): ToldPart | undefined {
  const beat = useBeats(toldInTurn.length, telling, (reached) => {
    const part = toldInTurn[reached - 1]
    if (part !== undefined) onTold?.(part)
  })
  return toldInTurn[beat - 1]
}

/** The parts of a play said up to `part`, in turn: none before the first. */
const upTo = <Part>(parts: readonly Part[], part: Part | undefined): readonly Part[] =>
  part === undefined ? [] : parts.slice(0, parts.indexOf(part) + 1)

/** The parts told up to `told`, in turn: none before the first. */
export const toldUpTo = (told: ToldPart | undefined): readonly ToldPart[] => upTo(toldInTurn, told)

/**
 * What the agent says once a tile's six are around it, a beat at a time: that they are the same six
 * as its body's lines, then where it stops, the user's own System waiting (HEX-122).
 */
const aroundInTurn = ['same', 'yours'] as const

export type AroundPart = (typeof aroundInTurn)[number]

/** The parts said around a tile up to `said`, in turn: none before the first. */
export const aroundUpTo = (said: AroundPart | undefined): readonly AroundPart[] =>
  upTo(aroundInTurn, said)

/** A tile's six around it as they land, and what the agent has said of them so far. */
interface Around {
  /**
   * How many of the six have landed, in their order from the top left, while their landing is lit:
   * none before the first, and none again once it has faded.
   */
  landed: number
  said: AroundPart | undefined
}

/**
 * A tile's six around it, from the start each time `around` turns on (HEX-122): how many have landed
 * as they arrive one by one, as the canvas blooms them where it introduces opening, the first a
 * `--duration-bloom` after the opening and each a `--stagger-step` after the one before, all at once
 * with reduced motion, their landing lit until a `--duration-flare` after the last, which fades as
 * long either way; and what the agent says of them, a beat at a time, as long with reduced motion.
 */
export function useAround(around: boolean): Around {
  const landed = useLanded(around)
  const beat = useBeats(aroundInTurn.length, around)
  return { landed, said: aroundInTurn[beat - 1] }
}

/** How many tiles there are around one: its six. */
const six = 6

/** How many of a tile's six have landed while `landing`, lit until a flare after the last. */
function useLanded(landing: boolean): number {
  const [landed, setLanded] = useState(0)
  useEffect(() => {
    if (!landing) return
    const first = movingFor('--duration-bloom')
    const step = movingFor('--stagger-step')
    const timers = Array.from({ length: six }, (_, index) =>
      setTimeout(() => {
        setLanded(index + 1)
      }, first + step * index),
    )
    const faded = first + step * (six - 1) + durationOf('--duration-flare')
    timers.push(
      setTimeout(() => {
        setLanded(0)
      }, faded),
    )
    return () => {
      timers.forEach(clearTimeout)
      setLanded(0)
    }
  }, [landing])
  return landing ? landed : 0
}
