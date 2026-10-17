// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOpenTold } from './HoverCard'

// What a hover card tells its caller of its opening: each time it opens and shuts, and once more as
// it goes while open, so what it lit elsewhere goes out with it.

afterEach(cleanup)

describe('a card telling its caller it opened or shut', () => {
  it('tells each opening and each shutting, once', () => {
    const told = vi.fn()
    const { rerender } = renderHook(
      ({ open }) => {
        useOpenTold(open, told)
      },
      { initialProps: { open: false } },
    )
    expect(told).not.toHaveBeenCalled()
    rerender({ open: true })
    rerender({ open: true })
    rerender({ open: false })
    expect(told.mock.calls).toEqual([[true], [false]])
  })

  it('tells it shut as it goes while open, to the caller it has by then', () => {
    const before = vi.fn()
    const after = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ told }) => {
        useOpenTold(true, told)
      },
      { initialProps: { told: before } },
    )
    rerender({ told: after })
    unmount()
    expect(before.mock.calls).toEqual([[true]])
    expect(after.mock.calls).toEqual([[false]])
  })
})
