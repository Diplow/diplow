// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  aroundUpTo,
  durationOf,
  easingOf,
  movingFor,
  toldUpTo,
  useAround,
  useBeats,
  useTold,
} from './motion'

// A motion's duration read from its token on the page: in ms or in s, none where it is unset or no
// number, and none for what moves under reduced motion, while a light that only fades keeps its own;
// and the beats of a play, one every `--stagger-beat`, as long with reduced motion; and a tile's six
// as they land around it, lit until a flare after the last, and what the agent says of them.

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
  for (const token of ['--duration-bloom', '--stagger-step', '--duration-flare']) {
    root.removeProperty(token)
  }
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

describe('useTold', () => {
  it("tells a tile's title, its preview, then its body, a beat apart, each heard as it comes", () => {
    vi.useFakeTimers()
    root.setProperty('--stagger-beat', '2s')
    const heard: string[] = []
    const { result } = renderHook(() =>
      useTold(true, (part) => {
        heard.push(part)
      }),
    )
    expect(result.current).toBeUndefined()
    settled(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBe('title')
    settled(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current).toBe('body')
    expect(heard).toEqual(['title', 'preview', 'body'])
  })
})

describe('toldUpTo', () => {
  it('lists the parts told so far, in turn, none before the first', () => {
    expect(toldUpTo(undefined)).toEqual([])
    expect(toldUpTo('preview')).toEqual(['title', 'preview'])
    expect(toldUpTo('body')).toEqual(['title', 'preview', 'body'])
  })
})

describe('useAround', () => {
  /** A tile's six around it, or not, on the page's tokens. */
  function around(on: boolean) {
    vi.useFakeTimers()
    root.setProperty('--duration-bloom', '800ms')
    root.setProperty('--stagger-step', '280ms')
    root.setProperty('--duration-flare', '1.3s')
    root.setProperty('--stagger-beat', '2s')
    return renderHook((props: { on: boolean }) => useAround(props.on), { initialProps: { on } })
  }

  /** The clock moved on by `ms`. */
  function after(ms: number) {
    settled(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('lands the six one by one, a step apart after the first bloom, then lets their light fade', () => {
    reduced(false)
    const { result } = around(true)
    expect(result.current.landed).toBe(0)
    after(800)
    expect(result.current.landed).toBe(1)
    after(280)
    expect(result.current.landed).toBe(2)
    after(280 * 4)
    expect(result.current.landed).toBe(6)
    after(1299)
    expect(result.current.landed).toBe(6)
    after(1)
    expect(result.current.landed).toBe(0)
  })

  it('lands them all at once under reduced motion, their light fading as long', () => {
    reduced(true)
    const { result } = around(true)
    after(0)
    expect(result.current.landed).toBe(6)
    after(1300)
    expect(result.current.landed).toBe(0)
  })

  it('says they are the same six, then that yours is waiting, a beat apart', () => {
    reduced(false)
    const { result } = around(true)
    expect(result.current.said).toBeUndefined()
    after(2000)
    expect(result.current.said).toBe('same')
    after(2000)
    expect(result.current.said).toBe('yours')
  })

  it('lands nothing and says nothing while the six are not around, and starts again anew', () => {
    reduced(false)
    const { result, rerender } = around(false)
    after(10_000)
    expect(result.current).toEqual({ landed: 0, said: undefined })
    rerender({ on: true })
    after(4000)
    rerender({ on: false })
    expect(result.current).toEqual({ landed: 0, said: undefined })
    rerender({ on: true })
    after(800)
    expect(result.current).toEqual({ landed: 1, said: undefined })
  })
})

describe('aroundUpTo', () => {
  it('lists what was said around a tile so far, in turn, none before the first', () => {
    expect(aroundUpTo(undefined)).toEqual([])
    expect(aroundUpTo('same')).toEqual(['same'])
    expect(aroundUpTo('yours')).toEqual(['same', 'yours'])
  })
})
