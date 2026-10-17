// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { durationOf, easingOf, movingFor } from './motion'

// A motion's duration read from its token on the page: in ms or in s, none where it is unset or no
// number, and none for what moves under reduced motion, while a light that only fades keeps its own.

const root = document.documentElement.style

/** The page asks for reduced motion, or not. */
function reduced(still: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: still && query.includes('reduce') }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  root.removeProperty('--duration-fold')
})

describe('durationOf', () => {
  it('reads a token in ms or in s', () => {
    root.setProperty('--duration-fold', '500ms')
    expect(durationOf('--duration-fold')).toBe(500)
    root.setProperty('--duration-fold', '1.3s')
    expect(durationOf('--duration-fold')).toBe(1300)
  })

  it('is none where the token is unset or no number', () => {
    expect(durationOf('--duration-fold')).toBe(0)
    root.setProperty('--duration-fold', 'auto')
    expect(durationOf('--duration-fold')).toBe(0)
  })

  it('keeps its duration under reduced motion, for a light that only fades', () => {
    reduced(true)
    root.setProperty('--duration-fold', '1.3s')
    expect(durationOf('--duration-fold')).toBe(1300)
  })
})

describe('movingFor', () => {
  it("is the token's duration, and none under reduced motion", () => {
    root.setProperty('--duration-fold', '500ms')
    reduced(false)
    expect(movingFor('--duration-fold')).toBe(500)
    reduced(true)
    expect(movingFor('--duration-fold')).toBe(0)
  })
})

describe('easingOf', () => {
  it('reads the curve the easing utility on an element sets', () => {
    const element = document.createElement('div')
    element.style.transitionTimingFunction = 'cubic-bezier(0.65, 0, 0.35, 1)'
    document.body.append(element)
    expect(easingOf(element)).toBe('cubic-bezier(0.65, 0, 0.35, 1)')
    element.remove()
  })

  it('eases in and out where the element sets none, or there is none', () => {
    const element = document.createElement('div')
    document.body.append(element)
    expect(easingOf(element)).toBe('ease-in-out')
    expect(easingOf(null)).toBe('ease-in-out')
    element.remove()
  })
})
