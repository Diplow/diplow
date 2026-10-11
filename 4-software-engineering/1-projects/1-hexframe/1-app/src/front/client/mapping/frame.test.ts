// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { Component, createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'

import { CallFailed } from '../calls'
import { makeQueryClient } from '../channels'
import { useSystem } from './queries'

// The System framed beside the canvas: home's chat reads the same System as the canvas, but a failed
// read shows only in the canvas's boundary, and the chat stays up. Over a stand-in for the server
// function, under the app's QueryClient, which throws a read's failure to the nearest boundary.
vi.mock('#/api/mapping/mapping', async (original) => ({
  ...(await original<typeof Mapping>()),
  system: vi.fn(),
}))

vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A boundary holding what its children threw, as a ReadBoundary would show it. */
class Caught extends Component<{ children: ReactNode; onCatch: (error: unknown) => void }> {
  override state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  override componentDidCatch(error: unknown) {
    this.props.onCatch(error)
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

describe("the System's read failed", () => {
  it('throws to the canvas’s boundary, and leaves the chat’s frame of it undefined, thrown nowhere', async () => {
    // React logs what a boundary caught.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(Mapping.system).mockResolvedValue({
      ok: false,
      failure: { _tag: 'Unexpected', kind: 'Unexpected' },
      requestId: 'req-1',
    } as never)
    const client = makeQueryClient()
    const onCatch = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, createElement(Caught, { onCatch, children }))
    // The chat beside the canvas, then the canvas, each in a boundary of its own.
    const chat = renderHook(() => useSystem({ frame: true }), { wrapper })
    renderHook(() => useSystem(), { wrapper })
    await waitFor(() => {
      expect(onCatch).toHaveBeenCalledExactlyOnceWith(expect.any(CallFailed))
    })
    expect(onCatch.mock.calls[0]?.[0]).toMatchObject({
      scope: 'system',
      failure: { _tag: 'Unexpected' },
    })
    expect(chat.result.current.data).toBeUndefined()
    // One read, which both observe.
    expect(Mapping.system).toHaveBeenCalledOnce()
  })
})
