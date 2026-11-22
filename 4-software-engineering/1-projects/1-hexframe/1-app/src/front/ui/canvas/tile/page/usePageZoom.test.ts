// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { usePageZoom } from './usePageZoom'
import { flightOf, pageZoomOf } from './zoom'

// The page's zoom: how the drawing beneath the page fades, the page leaving at once where nothing
// plays, and, on a page the browser animates, the zoom out of the hex the drawing framed and back
// into it; and, beside the hex widget, the page's fade and the hex view's flight.

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
    expect(result.current.fades).toEqual({ under: false, now: false, cut: false })
    rerender({ open: true })
    expect(result.current.fades).toEqual({ under: true, now: true, cut: false })
  })

  it('leaves at once where nothing plays, the drawing still faded until the view leaves it', () => {
    const { result } = renderHook(() => usePageZoom({ open: true, svg, framed }))
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    expect(then).toHaveBeenCalledOnce()
    expect(result.current.fades).toEqual({ under: true, now: true, cut: false })
  })
})

describe("usePageZoom's zoom", () => {
  // The canvas's coordinates on the screen: moved by (10, 20) and twice as large.
  const svg = {
    current: {
      getScreenCTM: () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }),
      // On no screen, so beside no hex widget.
      closest: () => null,
    },
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
    expect(result.current.fades).toEqual({ under: true, now: false, cut: false })
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
    expect(result.current.fades).toEqual({ under: true, now: true, cut: false })
  })
})

describe("the hex view's flight into the hex widget", () => {
  const framed = { center: { x: 50, y: 40 }, radius: 30 }
  // Where the canvas frames its center on the screen, its coordinates moved by (10, 20), doubled.
  const onCanvas = { center: { x: 110, y: 100 }, radius: 60 }
  // The widget's drawing, at (500, 400) on the screen, framing its center at (40, 30) at half size.
  const widgetBox = { x: 500, y: 400, width: 300, height: 200 }
  const inWidget = { center: { x: 20, y: 15 }, radius: 10 }

  afterEach(() => {
    document.body.replaceChildren()
  })

  /** The screen: the canvas's drawing, the page, and the chat's hex widget beside them. */
  function screenWith({ phone = false, folded = false } = {}) {
    document.documentElement.style.setProperty('--duration-camera', '500ms')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const screen = document.createElement('div')
    screen.setAttribute('data-screen', '')
    if (phone) screen.setAttribute('data-phone', '')
    const canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.getScreenCTM = () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }) as DOMMatrix
    const widget = document.createElement('div')
    widget.setAttribute('data-hex-widget', '')
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    drawing.setAttribute('data-framed', '40 30 20')
    drawing.getScreenCTM = () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: 500, f: 400 }) as DOMMatrix
    drawing.getBoundingClientRect = () => DOMRect.fromRect(widgetBox)
    drawing.checkVisibility = () => !folded
    widget.append(drawing)
    const page = document.createElement('article')
    page.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 600 })
    screen.append(canvas, page, widget)
    document.body.append(screen)
    const played: Array<{ on: Element; frames: Keyframe[]; animation: Animation }> = []
    vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element, frames) {
      const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation
      played.push({ on: this, frames: frames as Keyframe[], animation })
      return animation
    })
    return { svg: { current: canvas }, page, drawing, screen, played }
  }

  function opened(screen: ReturnType<typeof screenWith>) {
    const hook = renderHook(({ open }) => usePageZoom({ open, svg: screen.svg, framed }), {
      initialProps: { open: false },
    })
    hook.rerender({ open: true })
    settled(() => {
      hook.result.current.page(screen.page)
    })
    return hook
  }

  /** An animation played to its end, as the browser ends it. */
  const finish = (animation: Animation | undefined) => {
    animation?.onfinish?.call(animation, new Event('finish') as AnimationPlaybackEvent)
  }

  const flying = (screen: ReturnType<typeof screenWith>) =>
    screen.played.find(({ on }) => on !== screen.page && on !== screen.drawing)

  it("fades the page in and flies a copy of the widget's drawing from the canvas onto it", () => {
    const screen = screenWith()
    const { result } = opened(screen)
    const fades = screen.played.find(({ on }) => on === screen.page)
    expect(fades?.frames).toEqual([{ opacity: 0 }, { opacity: 1 }])
    const flight = flying(screen)
    expect(flight?.on.parentElement).toBe(screen.screen)
    const local = ({ center, radius }: typeof onCanvas) => ({
      center: { x: center.x - widgetBox.x, y: center.y - widgetBox.y },
      radius,
    })
    expect(flight?.frames).toEqual(flightOf(local(onCanvas), inWidget))
    // The widget's own drawing waits beneath the copy, and the canvas's is gone at once.
    expect(screen.played.some(({ on }) => on === screen.drawing)).toBe(true)
    expect(result.current.fades.cut).toBe(true)
    finish(flight?.animation)
    expect(flight?.on.isConnected).toBe(false)
  })

  it('flies it back out as the page fades away, then hands on', () => {
    const screen = screenWith()
    const { result } = opened(screen)
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    const back = screen.played.findLast(({ on }) => on !== screen.page && on !== screen.drawing)
    const [from, rest] = flightOf(
      { center: { x: onCanvas.center.x - 500, y: onCanvas.center.y - 400 }, radius: 60 },
      inWidget,
    )
    expect(back?.frames).toEqual([
      { ...rest, opacity: 1 },
      { ...from, opacity: 0 },
    ])
    expect(result.current.fades).toEqual({ under: true, now: false, cut: false })
    const fadesOut = screen.played.findLast(({ on }) => on === screen.page)
    settled(() => {
      finish(fadesOut?.animation)
    })
    expect(then).toHaveBeenCalledOnce()
  })

  it('only fades the page while the widget is folded', () => {
    const screen = screenWith({ folded: true })
    const { result } = opened(screen)
    expect(screen.played.map(({ on }) => on)).toEqual([screen.page])
    expect(result.current.fades.cut).toBe(false)
  })

  it('zooms the page out of the hex on a phone, the chat on another side', () => {
    const screen = screenWith({ phone: true })
    opened(screen)
    expect(screen.played).toHaveLength(1)
    expect(screen.played[0]?.frames).toEqual(pageZoomOf(onCanvas, { width: 800, height: 600 }))
  })
})
