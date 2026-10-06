// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useLeaveGuard } from './useLeaveGuard'

afterEach(cleanup)

/** Whether leaving the page now would ask first: a `beforeunload` a listener prevented. */
function asks() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('the leave guard', () => {
  it('asks before leaving while active, and no longer once it is not', () => {
    const { rerender } = renderHook(
      ({ active }) => {
        useLeaveGuard(active)
      },
      { initialProps: { active: true } },
    )
    expect(asks()).toBe(true)
    rerender({ active: false })
    expect(asks()).toBe(false)
  })

  it('never asks while inactive, nor once unmounted', () => {
    const { rerender, unmount } = renderHook(
      ({ active }) => {
        useLeaveGuard(active)
      },
      { initialProps: { active: false } },
    )
    expect(asks()).toBe(false)
    rerender({ active: true })
    unmount()
    expect(asks()).toBe(false)
  })
})
