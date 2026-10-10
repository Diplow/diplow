// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'

import { useFollowSystem } from './follow'
import { useSystem } from './queries'

// Following the System over stand-ins for the server functions: its Version polled on focus, and
// every 2 s while the page follows closely, the System read again only once the Version moved past
// the one the cache holds. The server functions themselves are src/api/mapping/mapping.test.ts's.
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn(), systemVersion: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

/** The System as the server reads it, flat, at a Version, its Root titled so a read tells apart. */
const systemAt = (version: number, title: string) => ({
  root: { _tag: 'Tile', id: 'root', title, preview: '', body: '', version: 1 },
  tiles: {},
  owned: true,
  version,
})

const ok = (value: unknown) => Promise.resolve({ ok: true, value }) as never

/** The System's stand-in answers `first`, then `then` on every read after it. */
function reading(first: unknown, then: unknown) {
  vi.mocked(Mapping.system)
    .mockImplementationOnce(() => ok(first))
    .mockImplementation(() => ok(then))
}

/** The Version's stand-in answers each of these in turn, then the last again. */
function polling(...versions: ReadonlyArray<number>) {
  const last = versions.at(-1) ?? 0
  for (const version of versions)
    vi.mocked(Mapping.systemVersion).mockImplementationOnce(() => ok(version))
  vi.mocked(Mapping.systemVersion).mockImplementation(() => ok(last))
}

/** The page: the System it shows, and the poll following it, closely or not. */
function render(closely = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(
    () => {
      useFollowSystem({ closely })
      return useSystem().data?.system
    },
    { wrapper },
  )
}

/** The tab loses focus, then regains it. */
function refocus() {
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
}

describe('the page following the System', () => {
  it('reads the System again on focus once its Version moved past the cache’s', async () => {
    reading(systemAt(3, 'First'), systemAt(4, 'Read again'))
    polling(3, 4)
    const { result } = render()
    await waitFor(() => {
      expect(result.current?.root.title).toBe('First')
    })
    await waitFor(() => {
      expect(Mapping.systemVersion).toHaveBeenCalledTimes(1)
    })
    refocus()
    await waitFor(() => {
      expect(result.current?.root.title).toBe('Read again')
    })
    expect(Mapping.systemVersion).toHaveBeenCalledTimes(2)
    expect(Mapping.system).toHaveBeenCalledTimes(2)
  })

  it('polls on focus without reading the System again while its Version stays', async () => {
    reading(systemAt(3, 'First'), systemAt(3, 'Never read'))
    polling(3)
    const { result } = render()
    await waitFor(() => {
      expect(result.current?.root.title).toBe('First')
    })
    for (const times of [2, 3]) {
      refocus()
      await waitFor(() => {
        expect(Mapping.systemVersion).toHaveBeenCalledTimes(times)
      })
    }
    expect(Mapping.system).toHaveBeenCalledTimes(1)
    expect(result.current?.root.title).toBe('First')
  })

  it('reads nothing again for a Version behind the cache’s, a read that landed first', async () => {
    reading(systemAt(5, 'First'), systemAt(5, 'Never read'))
    polling(4)
    const { result } = render()
    await waitFor(() => {
      expect(result.current?.root.title).toBe('First')
    })
    refocus()
    await waitFor(() => {
      expect(Mapping.systemVersion).toHaveBeenCalledTimes(2)
    })
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })

  it('polls every 2 s while following closely, and reads the System again once it moved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    reading(systemAt(1, 'First'), systemAt(2, 'Read again'))
    polling(1, 1, 2)
    const { result } = render(true)
    await waitFor(() => {
      expect(result.current?.root.title).toBe('First')
    })
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    expect(Mapping.system).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await waitFor(() => {
      expect(result.current?.root.title).toBe('Read again')
    })
    expect(Mapping.systemVersion).toHaveBeenCalledTimes(3)
  })

  it('polls nothing on a timer while not following closely', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    reading(systemAt(1, 'First'), systemAt(2, 'Never read'))
    polling(1, 2)
    const { result } = render()
    await waitFor(() => {
      expect(result.current?.root.title).toBe('First')
    })
    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(Mapping.systemVersion).toHaveBeenCalledTimes(1)
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })
})
