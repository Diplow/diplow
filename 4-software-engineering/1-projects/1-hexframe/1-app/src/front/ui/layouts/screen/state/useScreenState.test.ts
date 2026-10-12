// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScreenState } from './useScreenState'

// The side in front on a phone as the user turns the seam and the chat points at the canvas, which
// comes forward for a glance, then gives the chat back unless it was taken meanwhile.

/** How long the page says a glance lasts. */
const glance = 2800

beforeEach(() => {
  vi.useFakeTimers()
  document.documentElement.style.setProperty('--duration-glance', `${String(glance)}ms`)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--duration-glance')
})

/** Time passing, in ms. */
function after(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function render() {
  const { result } = renderHook(() => useScreenState())
  const front = () => result.current.state.front
  return { result, front }
}

describe('the side in front', () => {
  it('is the chat when the screen opens', () => {
    expect(render().front()).toBe('chat')
  })

  it('turns with the seam, to the canvas and back to the chat', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.turn('canvas')
    })
    expect(front()).toBe('canvas')
    act(() => {
      result.current.actions.turn('chat')
    })
    expect(front()).toBe('chat')
  })

  it('stays when turned to the side already in front', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.turn('chat')
    })
    expect(front()).toBe('chat')
  })

  it('brings the canvas forward when the chat points at it', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    expect(front()).toBe('canvas')
  })

  it('leaves the canvas in front when the chat points at it again', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    act(() => {
      result.current.actions.cross()
    })
    expect(front()).toBe('canvas')
  })

  it('gives the chat back after a crossing once the seam turns', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    act(() => {
      result.current.actions.turn('chat')
    })
    expect(front()).toBe('chat')
  })
})

describe('a crossing', () => {
  it('gives the chat back once its glance is over, and not before', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    after(glance - 1)
    expect(front()).toBe('canvas')
    after(1)
    expect(front()).toBe('chat')
  })

  it('keeps the canvas a hand took meanwhile', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    after(glance / 2)
    act(() => {
      result.current.actions.turn('canvas')
    })
    after(glance)
    expect(front()).toBe('canvas')
  })

  it('looks again from the start when the chat points again meanwhile', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    after(glance - 100)
    act(() => {
      result.current.actions.cross()
    })
    after(200)
    expect(front()).toBe('canvas')
    after(glance)
    expect(front()).toBe('chat')
  })

  it('gives back only what it took: a canvas already in front stays', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.turn('canvas')
    })
    act(() => {
      result.current.actions.cross()
    })
    after(glance * 2)
    expect(front()).toBe('canvas')
  })

  it('says what it showed, for a screen reader', () => {
    const { result } = render()
    act(() => {
      result.current.actions.cross('Projects, on the canvas')
    })
    expect(result.current.state.said).toBe('Projects, on the canvas')
  })
})
