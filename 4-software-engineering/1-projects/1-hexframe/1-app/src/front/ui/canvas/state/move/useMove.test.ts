// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Point } from '../../geometry/geometry'
import type { TileWrite } from '../../tile/Tile'

import { useMove, type Target } from './useMove'

// A tile on the move over a frame drawn by hand: a drag that starts the move with its caller, lights
// the place under it and lands there, or nowhere; Escape and Stop; the glide before the landing is
// sent, a swap's partner gliding the other way; a refusal flaring where it went, then gliding back;
// and a tile carried off the canvas, past x = 200. The canvas's units are the screen's, and a glide
// lasts 600ms.

const glide = 600

beforeEach(() => {
  vi.useFakeTimers()
  document.documentElement.style.setProperty('--duration-glide', `${String(glide)}ms`)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--duration-glide')
})

const home: Point = { x: 0, y: 0 }
const east: Point = { x: 100, y: 0 }

/** A free slot to the east, and the place a drag there lands on. */
function slot(land = vi.fn()): Target {
  return { key: 'east', center: east, land }
}

interface Props {
  moving: string | undefined
  centers: Record<string, Point>
  writes?: Record<string, TileWrite>
}

function render(
  initial: Props,
  targets: { at: Point; target: Target }[] = [],
  { carries = false } = {},
) {
  const onStart = vi.fn()
  const onStop = vi.fn()
  const onCarry = vi.fn()
  const hook = renderHook(
    ({ moving, centers, writes = {} }: Props) =>
      useMove({
        units: (point) => point,
        moving,
        onStart,
        onStop,
        centerOf: (id) => centers[id],
        dropAt: (point) =>
          targets.find(({ at }) => Math.hypot(at.x - point.x, at.y - point.y) < 40)?.target,
        writeOf: (id) => writes[id],
        ...(carries && { offCanvas: ({ x }: Point) => x > 200, onCarry }),
      }),
    { initialProps: initial },
  )
  return { ...hook, onStart, onStop, onCarry }
}

/** A mouse going down on a tile, as React hands it over. */
const down = (pointerType = 'mouse') =>
  ({ pointerType, button: 0, clientX: 0, clientY: 0 }) as PointerEvent

function send(type: 'pointermove' | 'pointerup', { x, y }: Point) {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }))
  })
}

const after = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('a drag', () => {
  it('starts the move with its caller, follows the pointer and lights the place under it', () => {
    const target = slot()
    const { result, onStart } = render({ moving: undefined, centers: { a: home } }, [
      { at: east, target },
    ])
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: 50, y: 0 })
    expect(onStart).toHaveBeenCalledExactlyOnceWith('a')
    expect(result.current.dragging).toBe('a')
    expect(result.current.shiftOf('a')).toEqual({ by: { x: 50, y: 0 }, glides: false })
    expect(result.current.over).toBeUndefined()
    send('pointermove', { x: 95, y: 5 })
    expect(result.current.over).toBe('east')
  })

  it('lands where it is let go, gliding there before the landing is sent', () => {
    const target = slot()
    const { result } = render({ moving: 'a', centers: { a: home } }, [{ at: east, target }])
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: 100, y: 0 })
    send('pointerup', { x: 100, y: 0 })
    expect(result.current.landing).toBe('glide')
    expect(result.current.shiftOf('a')).toEqual({ by: east, glides: true })
    expect(target.land).not.toHaveBeenCalled()
    after(glide + 40)
    expect(target.land).toHaveBeenCalledOnce()
  })

  it('lands a drop let go before its caller put the move in place, once it has', () => {
    const target = slot()
    const { result, rerender } = render({ moving: undefined, centers: { a: home } }, [
      { at: east, target },
    ])
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: 100, y: 0 })
    send('pointerup', { x: 100, y: 0 })
    expect(result.current.landing).toBeUndefined()
    rerender({ moving: 'a', centers: { a: home } })
    expect(result.current.landing).toBe('glide')
    after(glide + 40)
    expect(target.land).toHaveBeenCalledOnce()
  })

  it('lands nowhere let go over no place, the move going on', () => {
    const { result, onStop } = render({ moving: 'a', centers: { a: home } })
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: -80, y: 0 })
    send('pointerup', { x: -80, y: 0 })
    expect(result.current.landing).toBeUndefined()
    expect(result.current.shiftOf('a')).toEqual({ by: home, glides: false })
    expect(onStop).not.toHaveBeenCalled()
  })

  it('takes no other tile while one moves, and no finger', () => {
    const { result, onStart } = render({ moving: 'a', centers: { a: home, b: east } })
    act(() => {
      result.current.press('b', down())
    })
    send('pointermove', { x: 50, y: 0 })
    expect(result.current.dragging).toBeUndefined()
    const still = render({ moving: undefined, centers: { a: home } })
    act(() => {
      still.result.current.press('a', down('touch'))
    })
    send('pointermove', { x: 50, y: 0 })
    expect(still.onStart).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
  })
})

describe('stopping', () => {
  it('stops on Escape, wherever the focus is', () => {
    const { onStop } = render({ moving: 'a', centers: { a: home } })
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('leaves Escape to a menu open meanwhile, which it closes', () => {
    const { onStop } = render({ moving: 'a', centers: { a: home } })
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    menu.remove()
    expect(onStop).not.toHaveBeenCalled()
  })

  it('hears no Escape while nothing moves, and cancels a drag under way', () => {
    const idle = render({ moving: undefined, centers: { a: home } })
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(idle.onStop).not.toHaveBeenCalled()
    const target = slot()
    const { result, onStop } = render({ moving: 'a', centers: { a: home } }, [{ at: east, target }])
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: 100, y: 0 })
    act(() => {
      result.current.stop()
    })
    send('pointerup', { x: 100, y: 0 })
    expect(onStop).toHaveBeenCalledOnce()
    expect(target.land).not.toHaveBeenCalled()
    expect(result.current.dragging).toBeUndefined()
  })
})

describe('a landing', () => {
  it("glides a swap's partner the other way, both drawn there once their caller moved them", () => {
    const target: Target = { key: 'b', center: east, partner: 'b', land: vi.fn() }
    const { result, rerender } = render({ moving: 'a', centers: { a: home, b: east } })
    act(() => {
      result.current.land(target)
    })
    expect(result.current.shiftOf('b')).toEqual({ by: { x: -100, y: 0 }, glides: true })
    after(glide + 40)
    expect(result.current.shiftOf('a')).toEqual({ by: east, glides: false })
    rerender({ moving: undefined, centers: { a: east, b: home } })
    expect(result.current.shiftOf('a')).toEqual({ by: home, glides: false })
    expect(result.current.shiftOf('b')).toEqual({ by: home, glides: false })
  })

  it('is sent at once for a tile out of sight, with nothing to glide', () => {
    const target = slot()
    const { result } = render({ moving: 'a', centers: {} })
    act(() => {
      result.current.land(target)
    })
    expect(target.land).toHaveBeenCalledOnce()
    expect(result.current.landing).toBeUndefined()
  })

  it('ends once its write, seen on its way, is no longer', () => {
    const { result, rerender } = render({ moving: 'a', centers: { a: home } })
    act(() => {
      result.current.land(slot())
    })
    after(glide + 40)
    rerender({ moving: undefined, centers: { a: east }, writes: { a: 'pending' } })
    expect(result.current.landing).toBe('landed')
    rerender({ moving: undefined, centers: { a: east } })
    expect(result.current.landing).toBeUndefined()
  })

  it('refused, flares where it went, then glides back', () => {
    const { result, rerender } = render({ moving: 'a', centers: { a: home } })
    act(() => {
      result.current.land(slot())
    })
    after(glide + 40)
    rerender({ moving: undefined, centers: { a: east }, writes: { a: 'pending' } })
    // The refusal puts it back where it was: drawn there, it is still shown where it went.
    rerender({ moving: 'a', centers: { a: home }, writes: { a: 'refused' } })
    expect(result.current.landing).toBe('refused')
    expect(result.current.shiftOf('a')).toEqual({ by: east, glides: false })
    after(450)
    expect(result.current.shiftOf('a')).toEqual({ by: home, glides: true })
    after(glide + 40)
    expect(result.current.landing).toBeUndefined()
  })

  it('refused once the canvas shows it elsewhere, only flares there', () => {
    const { result, rerender } = render({ moving: 'a', centers: { a: home } })
    act(() => {
      result.current.land(slot())
    })
    after(glide + 40)
    rerender({ moving: undefined, centers: { a: { x: 0, y: 300 } }, writes: { a: 'refused' } })
    expect(result.current.landing).toBeUndefined()
    expect(result.current.shiftOf('a')).toEqual({ by: home, glides: false })
  })
})

describe('a tile carried off the canvas', () => {
  const off: Point = { x: 260, y: 30 }

  it('follows the pointer over the page, landing on no place, and is no longer once back', () => {
    const target = slot()
    const { result, onCarry } = render(
      { moving: 'a', centers: { a: home } },
      [{ at: east, target }],
      { carries: true },
    )
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', { x: 100, y: 0 })
    expect(result.current.over).toBe('east')
    send('pointermove', off)
    send('pointermove', { x: 280, y: 40 })
    expect(onCarry).toHaveBeenCalledExactlyOnceWith('a')
    expect(result.current.carried).toEqual({ id: 'a', at: { x: 280, y: 40 } })
    expect(result.current.over).toBeUndefined()
    expect(result.current.shiftOf('a')).toEqual({ by: home, glides: false })
    send('pointermove', { x: 100, y: 0 })
    expect(onCarry).toHaveBeenLastCalledWith(undefined)
    expect(result.current.carried).toBeUndefined()
    expect(result.current.over).toBe('east')
  })

  it('let go off the canvas, lands nowhere and ends its move', () => {
    const target = slot()
    const { result, onCarry, onStop } = render(
      { moving: 'a', centers: { a: home } },
      [{ at: east, target }],
      { carries: true },
    )
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', off)
    send('pointerup', off)
    expect(onCarry).toHaveBeenLastCalledWith(undefined)
    expect(result.current.carried).toBeUndefined()
    expect(onStop).toHaveBeenCalledOnce()
    expect(result.current.landing).toBeUndefined()
    after(glide + 40)
    expect(target.land).not.toHaveBeenCalled()
  })

  it('let go off the canvas before its caller put the move in place, ends it once it has', () => {
    const { result, rerender, onStop } = render({ moving: undefined, centers: { a: home } }, [], {
      carries: true,
    })
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', off)
    send('pointerup', off)
    expect(onStop).not.toHaveBeenCalled()
    rerender({ moving: 'a', centers: { a: home } })
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('is carried no more once the move stops, and never without a page to carry it', () => {
    const { result, onCarry } = render({ moving: 'a', centers: { a: home } }, [], {
      carries: true,
    })
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', off)
    act(() => {
      result.current.stop()
    })
    expect(onCarry).toHaveBeenLastCalledWith(undefined)
    expect(result.current.carried).toBeUndefined()
    const kept = render({ moving: 'a', centers: { a: home } })
    act(() => {
      kept.result.current.press('a', down())
    })
    send('pointermove', off)
    expect(kept.result.current.carried).toBeUndefined()
    expect(kept.onCarry).not.toHaveBeenCalled()
  })

  it('is carried no more once the canvas goes', () => {
    const { result, unmount, onCarry } = render({ moving: 'a', centers: { a: home } }, [], {
      carries: true,
    })
    act(() => {
      result.current.press('a', down())
    })
    send('pointermove', off)
    unmount()
    expect(onCarry).toHaveBeenLastCalledWith(undefined)
  })
})
