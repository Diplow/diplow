// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useScale } from './useScale'

// The screen px per unit of an <svg>, over a stand-in for the ResizeObserver the browser gives: 1
// before it is measured, then the smaller of its two ratios, and nothing watched once it is gone.

/** The ResizeObserver the hook made: its element resized, and whether it stopped watching. */
const observed: { resize: (width: number, height: number) => void; disconnect: () => void } = {
  resize: () => undefined,
  disconnect: vi.fn(),
}

vi.stubGlobal(
  'ResizeObserver',
  class {
    constructor(callback: ResizeObserverCallback) {
      observed.resize = (width, height) => {
        callback(
          [{ contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
    }
    observe() {}
    disconnect() {
      observed.disconnect()
    }
  },
)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function render() {
  const svg = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }
  return renderHook(() => useScale(svg, { width: 600, height: 400 }))
}

describe('useScale', () => {
  it('is 1 until the <svg> is measured', () => {
    expect(render().result.current).toBe(1)
  })

  it('takes the smaller ratio, the one the viewBox fits by, wide or tall', () => {
    const { result } = render()
    act(() => {
      observed.resize(1200, 400)
    })
    expect(result.current).toBe(1)
    act(() => {
      observed.resize(300, 800)
    })
    expect(result.current).toBe(0.5)
  })

  it('stops watching once it is gone', () => {
    render().unmount()
    expect(observed.disconnect).toHaveBeenCalledOnce()
  })
})
