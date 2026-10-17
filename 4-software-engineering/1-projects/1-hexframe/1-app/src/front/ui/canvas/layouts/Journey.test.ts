// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useJourney } from './Journey'

// The journey from one System to another, over drawings named by hand: what recedes as the System
// changes, for how long, and nothing with reduced motion.

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--duration-journey')
})

/** The journey over a canvas drawing `at`'s System, as `drawing`. */
function render(at: string, drawing: string) {
  return renderHook(
    (props: { at: string; drawing: string }) => useJourney(props.at, props.drawing),
    {
      initialProps: { at, drawing },
    },
  )
}

/** A page whose reader asks for reduced motion, or not. */
function reduced(asked: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: asked && query.includes('reduce') }))
}

describe('a journey', () => {
  it('takes none while the canvas stays on its System, whatever it draws', () => {
    document.documentElement.style.setProperty('--duration-journey', '1.8s')
    reduced(false)
    const { result, rerender } = render('yours', 'your root')
    rerender({ at: 'yours', drawing: 'your root, opened' })
    expect(result.current).toBeUndefined()
  })

  it('leaves the System left as it was last drawn, for --duration-journey', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-journey', '1.8s')
    reduced(false)
    const { result, rerender } = render('yours', 'your root')
    rerender({ at: 'yours', drawing: 'your root, opened' })
    rerender({ at: 'tutorial', drawing: "the tutorial's center" })
    expect(result.current).toEqual({ at: 'yours', drawing: 'your root, opened' })
    settled(() => {
      vi.advanceTimersByTime(1799)
    })
    expect(result.current).toBeDefined()
    settled(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBeUndefined()
  })

  it('leaves from where the canvas is when taken again before the last one ends', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-journey', '1.8s')
    reduced(false)
    const { result, rerender } = render('yours', 'your root')
    rerender({ at: 'tutorial', drawing: "the tutorial's center" })
    settled(() => {
      vi.advanceTimersByTime(900)
    })
    rerender({ at: 'yours', drawing: 'your root' })
    expect(result.current).toEqual({ at: 'tutorial', drawing: "the tutorial's center" })
    settled(() => {
      vi.advanceTimersByTime(1800)
    })
    expect(result.current).toBeUndefined()
  })

  it('is a cut with reduced motion: the next System is simply there', () => {
    document.documentElement.style.setProperty('--duration-journey', '1.8s')
    reduced(true)
    const { result, rerender } = render('yours', 'your root')
    rerender({ at: 'tutorial', drawing: "the tutorial's center" })
    expect(result.current).toBeUndefined()
  })
})
