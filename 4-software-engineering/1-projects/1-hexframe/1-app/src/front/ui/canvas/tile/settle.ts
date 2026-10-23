// A tile's own motion: the bloom and the fold its caller asks for, the stylesheet's, out of its
// parent's heart and back, and, as its hex changes under it, the center settling at its heart as its
// Context shows inside it, or back as it hides, and a Branch settling at its heart as it opens in
// place, or back as it closes, measured against the hex it was drawn in; and a fold given up, played
// back to rest. What moves as its hex changes is played on the page's own animations.
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { cn } from 'cn'

import type { Hex, Point } from '../geometry/geometry'
import { easingOf, movingFor } from '../../motion'
import type { TileMotion, TilePlace } from './Tile'

/** Where a tile settles as its hex changes under it, at the heart of a ring shown or hidden in it. */
const settles = (was: TilePlace, place: TilePlace) =>
  (was === 'center' && place === 'center') ||
  (was === 'ring' && place === 'heart') ||
  (was === 'heart' && place === 'ring')

/**
 * A tile settling as a ring shows or hides inside its hex, from the size it was drawn at to the one
 * it is drawn at now, about its heart, for `--duration-bloom`: the center as its Context blooms
 * around it or folds back, a Branch as its six bloom out of it or once they folded back into it, the
 * ring around it staying where it is; only where its hex stays where it was, since the camera
 * carries a tile as the center changes, opens from alone or folds back. Or, where its caller says
 * how much larger it was drawn as the world goes (`grown`), opened or folded as the camera moved,
 * from that size. None with reduced motion.
 */
export function useSettle(hex: Hex, place: TilePlace, grown?: number) {
  const settling = useRef<SVGGElement>(null)
  const last = useRef({ hex, place })
  useLayoutEffect(() => {
    const was = last.current
    last.current = { hex, place }
    const duration = movingFor('--duration-bloom')
    if (duration === 0) return
    const moved = Math.hypot(was.hex.center.x - hex.center.x, was.hex.center.y - hex.center.y)
    const resized = Math.abs(was.hex.radius - hex.radius) > 1e-6
    // Nothing changed under it: a render that only redraws it is no reason to settle.
    if (moved < 1e-6 && !resized && was.place === place) return
    const stays = settles(was.place, place) && moved < 1e-6
    const from = grown ?? (stays ? was.hex.radius / hex.radius : 1)
    if (Math.abs(from - 1) < 1e-6) return
    settling.current?.animate([{ transform: `scale(${String(from)})` }, { transform: 'none' }], {
      duration,
      easing: easingOf(settling.current),
    })
    // `grown` is said of the change that brings it: read with it, never a reason to settle again.
  }, [hex, place])
  return settling
}

/** A fold under way, the stylesheet's: its animation, how it eases, when it started, where it folds to. */
interface Folding {
  animation: CSSAnimation
  easing: string
  since: number
  origin: string
}

/**
 * A fold given up before it ended, as a centering gives it up: played back to rest from where it
 * stood, for as long as a fold lasts, rather than jumping there. The fold is the stylesheet's
 * (`animate-fold`), read off the element as it starts; a fold that ends takes its tile away, so only
 * one given up comes back. None with reduced motion, which folds nothing.
 */
export function useFoldGivenUp(folding: boolean) {
  const moved = useRef<SVGGElement>(null)
  const fold = useRef<Folding>(undefined)
  useLayoutEffect(() => {
    const element = moved.current
    if (element === null) return
    if (folding) {
      const animation = element
        .getAnimations()
        .find(
          (one): one is CSSAnimation => one instanceof CSSAnimation && one.animationName === 'fold',
        )
      const { transformOrigin: origin, animationTimingFunction: easing } = getComputedStyle(element)
      if (animation !== undefined) {
        fold.current ??= { animation, easing, since: performance.now(), origin }
      }
      return
    }
    const was = fold.current
    fold.current = undefined
    if (was === undefined || !(was.animation.effect instanceof KeyframeEffect)) return
    const ran = performance.now() - was.since
    const { duration } = was.animation.effect.getComputedTiming()
    if (typeof duration !== 'number' || ran <= 0 || ran >= duration) return
    // Where the fold stood: the same fold, eased as it was, sought to the time it had run, read, then
    // dropped. Its keyframes are the stylesheet's, each eased as the animation is.
    const keyframes = was.animation.effect
      .getKeyframes()
      .map((keyframe) => ({ ...keyframe, easing: 'linear', transformOrigin: was.origin }))
    const { easing } = was
    const probe = element.animate(keyframes, { duration, easing })
    probe.pause()
    probe.currentTime = ran
    const { opacity, transform } = getComputedStyle(element)
    probe.cancel()
    element.animate(
      [
        { opacity, transform, transformOrigin: was.origin },
        { opacity: 1, transform: 'none', transformOrigin: was.origin },
      ],
      { duration, easing },
    )
  }, [folding])
  return moved
}

/**
 * A hex blooming out of its parent's heart or folding back into it, a tile or a free slot: its
 * animation, and where it starts.
 */
export function movedAs(motion: TileMotion | undefined) {
  return {
    className: cn(
      motion?.way === 'bloom' && 'motion-safe:animate-bloom',
      motion?.way === 'fold' && 'motion-safe:animate-fold motion-reduce:opacity-0',
    ),
    style: motion && origin(motion.from, motion.order, motion.paced),
  }
}

/**
 * Where a transform starts, in the canvas's own coordinates, and how many siblings it waits for, each
 * a bloom's stagger apart, or a step's where it is paced.
 */
export function origin({ x, y }: Point, order?: number, paced = false): CSSProperties {
  const stagger = paced ? '--stagger-step' : '--stagger-bloom'
  return {
    transformOrigin: `${String(x)}px ${String(y)}px`,
    transformBox: 'view-box',
    ...(order !== undefined && { animationDelay: `calc(var(${stagger}) * ${String(order)})` }),
  }
}
