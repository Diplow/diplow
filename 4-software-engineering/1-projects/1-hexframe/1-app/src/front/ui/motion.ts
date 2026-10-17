// How long a motion lasts, read from its token on the page, so the code waiting on it follows the
// stylesheet: `--duration-fold`, `--duration-glide`, `--duration-flare`, the camera's
// `--duration-camera` and `--duration-camera-level`, a journey's `--duration-journey`, and how long
// the canvas stays in front on a phone after a crossing, `--duration-glance`; and how a motion eases,
// read off the element its utility eases (`ease-camera`). What moves waits for nothing with reduced
// motion; a light that only fades, the flare, and a glance, last as long either way. Both sides and
// the screen read it, so it sits beside the theme.

/**
 * A duration token's value in milliseconds, `500ms` or `1.3s`, as the page's root sets it; 0 off a
 * page, or where the token is unset.
 */
export function durationOf(token: `--duration-${string}`): number {
  if (typeof window === 'undefined') return 0
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const amount = parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('ms') ? amount : amount * 1000
}

/** How long a motion that moves something lasts: its token's duration, none with reduced motion. */
export function movingFor(token: `--duration-${string}`): number {
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
