// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'

import { useShipped } from './queries'

// The Systems hexframe ships, Help and the tutorial, read whole on the client: each by its Root
// through the one server function, a query per System and per language, and none at all while its
// read is not enabled. Over a stand-in for the server function; the function itself is covered in
// src/api/mapping/mapping.test.ts.
vi.mock('#/api/mapping/mapping', async (original) => ({
  ...(await original<typeof Mapping>()),
  shipped: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The server function's stand-in: the Root of the System asked, titled by the language asked. */
const answering = (({ data }: { data: { root: string; language: string } }) =>
  Promise.resolve({
    ok: true,
    value: { _tag: 'Tile', id: data.root, title: data.language, preview: '', body: '', version: 1 },
  })) as never

/** Renders `hook` under a QueryClient of its own, which retries nothing. */
function render<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(hook, { wrapper })
}

describe('a System hexframe ships, read whole', () => {
  it('reads each System by its Root in the language asked, each a query of its own', async () => {
    vi.mocked(Mapping.shipped).mockImplementation(answering)
    const { result } = render(() => ({
      helpEn: useShipped('help', 'en'),
      helpFr: useShipped('help', 'fr'),
      tutorial: useShipped('tutorial', 'fr'),
    }))
    await waitFor(() => {
      expect(result.current).toMatchObject({
        helpEn: { data: { id: 'help', title: 'en' } },
        helpFr: { data: { id: 'help', title: 'fr' } },
        tutorial: { data: { id: 'tutorial', title: 'fr' } },
      })
    })
    expect(Mapping.shipped).toHaveBeenCalledTimes(3)
    expect(Mapping.shipped).toHaveBeenCalledWith({ data: { root: 'tutorial', language: 'fr' } })
  })

  it('reads nothing while not enabled, and shows what the canvas read of the same System', async () => {
    vi.mocked(Mapping.shipped).mockImplementation(answering)
    const alone = render(() => useShipped('tutorial', 'en', { throwing: false, enabled: false }))
    await new Promise((settled) => setTimeout(settled, 50))
    expect(alone.result.current.data).toBeUndefined()
    expect(Mapping.shipped).not.toHaveBeenCalled()
    const beside = render(() => ({
      corner: useShipped('tutorial', 'en', { throwing: false, enabled: false }),
      canvas: useShipped('tutorial', 'en'),
    }))
    await waitFor(() => {
      expect(beside.result.current.corner.data).toMatchObject({ id: 'tutorial', title: 'en' })
    })
    expect(Mapping.shipped).toHaveBeenCalledOnce()
  })
})
