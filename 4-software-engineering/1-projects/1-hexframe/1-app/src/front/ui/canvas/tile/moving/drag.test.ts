// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PointerEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDrag, type Dragged } from './drag'

afterEach(cleanup)

/** The canvas's units, here the screen's own. */
const units = (point: { x: number; y: number }) => point

/** A pointer going down on a tile, as React hands it over. */
const down = (pointerType = 'mouse', button = 0, x = 0, y = 0) =>
  ({ pointerType, button, clientX: x, clientY: y }) as PointerEvent

/** A pointer event on the window, where the drag listens once pressed. */
function send(type: 'pointermove' | 'pointerup' | 'pointercancel', x = 0, y = 0) {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }))
  })
}

function pressed(event = down()) {
  const handlers = { onStart: vi.fn(), onMove: vi.fn(), onDrop: vi.fn() }
  const hook = renderHook(() => useDrag(units))
  act(() => {
    hook.result.current.press(event, handlers)
  })
  return { ...handlers, hook }
}

describe('a drag', () => {
  it('starts past a few units, follows the pointer, and lands where it is let go', () => {
    const { onStart, onMove, onDrop, hook } = pressed()
    send('pointermove', 4, 0)
    expect(onStart).not.toHaveBeenCalled()
    send('pointermove', 30, 40)
    expect(onStart).toHaveBeenCalledOnce()
    const there: Dragged = { offset: { x: 30, y: 40 }, at: { x: 30, y: 40 } }
    expect(onMove).toHaveBeenLastCalledWith(there)
    expect(hook.result.current.dragged).toEqual(there)
    send('pointerup', 30, 40)
    expect(onDrop).toHaveBeenCalledWith(there)
    expect(hook.result.current.dragged).toBeUndefined()
  })

  it('is a click while it stays put: let go, nothing starts nor drops', () => {
    const { onStart, onDrop } = pressed()
    send('pointermove', 3, 3)
    send('pointerup', 3, 3)
    expect(onStart).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('lands nowhere once cancelled', () => {
    const { onDrop } = pressed()
    send('pointermove', 50, 0)
    send('pointercancel')
    expect(onDrop).toHaveBeenCalledWith(undefined)
  })

  it('never starts under a finger, nor from another button than the main one', () => {
    for (const event of [down('touch'), down('mouse', 2)]) {
      const { onStart } = pressed(event)
      send('pointermove', 50, 0)
      expect(onStart).not.toHaveBeenCalled()
    }
  })

  it('stops listening once let go, and once the hook is gone', () => {
    const first = pressed()
    send('pointermove', 50, 0)
    send('pointerup', 50, 0)
    send('pointermove', 90, 0)
    expect(first.onMove).toHaveBeenCalledOnce()
    const second = pressed()
    second.hook.unmount()
    send('pointermove', 50, 0)
    expect(second.onStart).not.toHaveBeenCalled()
  })
})
