// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useScreenState } from './useScreenState'

// The side in front on a phone as the user turns the seam and the chat points at the canvas.

afterEach(cleanup)

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

  it('keeps its state when turned to the side already in front', () => {
    const { result } = render()
    const before = result.current.state
    act(() => {
      result.current.actions.turn('chat')
    })
    expect(result.current.state).toBe(before)
  })

  it('brings the canvas forward when the chat points at it', () => {
    const { result, front } = render()
    act(() => {
      result.current.actions.cross()
    })
    expect(front()).toBe('canvas')
  })

  it('leaves the canvas in front when the chat points at it again', () => {
    const { result } = render()
    act(() => {
      result.current.actions.cross()
    })
    const before = result.current.state
    act(() => {
      result.current.actions.cross()
    })
    expect(result.current.state).toBe(before)
  })
})
