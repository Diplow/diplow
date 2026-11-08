// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { usePageZoom } from './usePageZoom'
import { pageZoomOf } from './zoom'

// The page's zoom: how the drawing beneath the page fades, the page leaving at once where nothing
// plays, and, on a page the browser animates, the zoom out of the hex the drawing framed and back
// into it.

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--duration-camera')
})

describe('usePageZoom', () => {
  const svg = { current: null }
  const framed = { center: { x: 0, y: 0 }, radius: 1 }

  it('keeps the drawing out of reach and faded while the page shows, and in hand otherwise', () => {
    const { result, rerender } = renderHook(({ open }) => usePageZoom({ open, svg, framed }), {
      initialProps: { open: false },
    })
    expect(result.current.fades).toEqual({ under: false, now: false })
    rerender({ open: true })
    expect(result.current.fades).toEqual({ under: true, now: true })
  })

  it('leaves at once where nothing plays, the drawing still faded until the view leaves it', () => {
    const { result } = renderHook(() => usePageZoom({ open: true, svg, framed }))
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    expect(then).toHaveBeenCalledOnce()
    expect(result.current.fades).toEqual({ under: true, now: true })
  })
})

describe("usePageZoom's zoom", () => {
  // The canvas's coordinates on the screen: moved by (10, 20) and twice as large.
  const svg = {
    current: { getScreenCTM: () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }) },
  } as unknown as { current: SVGSVGElement }
  const framed = { center: { x: 50, y: 40 }, radius: 30 }
  // Where the framed hex stands on the screen, and so on the page, which starts at the screen's top left.
  const onScreen = { center: { x: 110, y: 100 }, radius: 60 }
  const box = { width: 800, height: 600 }

  /** The page, as the browser would animate it: each animation it plays, and how each ends. */
  function pageElement() {
    const played: Array<{ cancel: () => void; onfinish: (() => void) | null }> = []
    const element = document.createElement('article')
    element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, ...box })
    const animate = vi.fn(() => {
      const animation = { cancel: vi.fn(), onfinish: null }
      played.push(animation)
      return animation as unknown as Animation
    })
    element.animate = animate
    return { element, animate, played }
  }

  function moving(still = false) {
    document.documentElement.style.setProperty('--duration-camera', '500ms')
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: still && query.includes('reduce') }))
  }

  /** The page opened from the drawing, its element mounted. */
  function opened(page: ReturnType<typeof pageElement>) {
    const hook = renderHook(({ open }) => usePageZoom({ open, svg, framed }), {
      initialProps: { open: false },
    })
    hook.rerender({ open: true })
    settled(() => {
      hook.result.current.page(page.element)
    })
    return hook
  }

  it('grows the page out of the hex the drawing framed before it, where it stood on the screen', () => {
    moving()
    const page = pageElement()
    opened(page)
    expect(page.animate).toHaveBeenCalledOnce()
    expect(page.animate).toHaveBeenCalledWith(pageZoomOf(onScreen, box), {
      duration: 500,
      easing: 'ease-in-out',
      fill: 'none',
    })
  })

  it('plays nothing under reduced motion, nor as it leaves, which it does at once', () => {
    moving(true)
    const page = pageElement()
    const { result } = opened(page)
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    expect(page.animate).not.toHaveBeenCalled()
    expect(then).toHaveBeenCalledOnce()
  })

  it('goes back into the hex as it leaves, the drawing coming back meanwhile, then hands on', () => {
    moving()
    const page = pageElement()
    const { result } = opened(page)
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    expect(page.animate).toHaveBeenLastCalledWith([...pageZoomOf(onScreen, box)].reverse(), {
      duration: 500,
      easing: 'ease-in-out',
      fill: 'forwards',
    })
    expect(page.played[0]?.cancel).toHaveBeenCalled()
    expect(then).not.toHaveBeenCalled()
    expect(result.current.fades).toEqual({ under: true, now: false })
    settled(() => {
      page.played[1]?.onfinish?.()
    })
    expect(then).toHaveBeenCalledOnce()
  })

  it('comes back whole where the view would not leave it', () => {
    moving()
    const page = pageElement()
    const { result } = opened(page)
    settled(() => {
      result.current.leave(() => false)
    })
    settled(() => {
      page.played[1]?.onfinish?.()
    })
    expect(page.played[1]?.cancel).toHaveBeenCalled()
    expect(result.current.fades).toEqual({ under: true, now: true })
  })
})
