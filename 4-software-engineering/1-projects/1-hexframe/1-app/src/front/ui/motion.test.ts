// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { durationOf, easingOf, movingFor, useBeats } from './motion'

// A motion's duration read from its token on the page: in ms or in s, none where it is unset or no
// number, and none for what moves under reduced motion, while a light that only fades keeps its own;
// and the beats of a play, one every `--stagger-beat`, as long with reduced motion.

const root = document.documentElement.style

/** The page asks for reduced motion, or not. */
function reduced(still: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: still && query.includes('reduce') }))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  root.removeProperty('--duration-fold')
  root.removeProperty('--stagger-beat')
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

describe('useBeats', () => {
  /** A play of three beats, two seconds apart, on or off. */
  function play(playing: boolean) {
    vi.useFakeTimers()
    root.setProperty('--stagger-beat', '2s')
    return renderHook((props: { playing: boolean }) => useBeats(3, props.playing), {
      initialProps: { playing },
    })
  }

  /** The clock moved on by `ms`, its beats landed. */
  function after(ms: number) {
    settled(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('reaches one beat every stagger, up to its count', () => {
    const { result } = play(true)
    expect(result.current).toBe(0)
    after(2000)
    expect(result.current).toBe(1)
    after(2000)
    expect(result.current).toBe(2)
    after(6000)
    expect(result.current).toBe(3)
  })

  it('keeps its beats under reduced motion, which show without moving', () => {
    reduced(true)
    const { result } = play(true)
    after(2000)
    expect(result.current).toBe(1)
  })

  it('tells each beat as it comes', () => {
    vi.useFakeTimers()
    root.setProperty('--stagger-beat', '2s')
    const heard: number[] = []
    renderHook(() =>
      useBeats(3, true, (beat) => {
        heard.push(beat)
      }),
    )
    after(4000)
    expect(heard).toEqual([1, 2])
  })

  it('stays at none while it does not play', () => {
    const { result } = play(false)
    after(10_000)
    expect(result.current).toBe(0)
  })

  it('plays from the start again each time it plays anew', () => {
    const { result, rerender } = play(true)
    after(6000)
    rerender({ playing: false })
    expect(result.current).toBe(0)
    rerender({ playing: true })
    expect(result.current).toBe(0)
    after(2000)
    expect(result.current).toBe(1)
  })
})
