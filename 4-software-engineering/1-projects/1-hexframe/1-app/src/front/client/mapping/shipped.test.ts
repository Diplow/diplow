// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'

import { useShipped } from './queries'

// The Systems hexframe ships, Help and the tutorial, read whole on the client: each by its own server
// function, a query per System and per language. Over stand-ins for the server functions; the
// functions themselves are covered in src/api/mapping/mapping.test.ts.
vi.mock('#/api/mapping/mapping', async (original) => ({
  ...(await original<typeof Mapping>()),
  help: vi.fn(),
  tutorial: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A server function's stand-in answering a shipped System's Root, titled by the language asked. */
const answering = (id: string) =>
  (({ data }: { data: { language: string } }) =>
    Promise.resolve({
      ok: true,
      value: { _tag: 'Tile', id, title: data.language, preview: '', body: '', version: 1 },
    })) as never

/** Renders `hook` under a QueryClient of its own, which retries nothing. */
function render<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(hook, { wrapper })
}

describe('a System hexframe ships, read whole', () => {
  it('reads Help in the language asked, each language a query of its own', async () => {
    vi.mocked(Mapping.help).mockImplementation(answering('help'))
    const { result } = render(() => ({
      en: useShipped('help', 'en'),
      fr: useShipped('help', 'fr'),
    }))
    await waitFor(() => {
      expect(result.current).toMatchObject({
        en: { data: { id: 'help', title: 'en' } },
        fr: { data: { id: 'help', title: 'fr' } },
      })
    })
    expect(Mapping.help).toHaveBeenCalledWith({ data: { language: 'en' } })
    expect(Mapping.help).toHaveBeenCalledWith({ data: { language: 'fr' } })
  })

  it('reads the tutorial by its own server function, a query apart from Help’s', async () => {
    vi.mocked(Mapping.help).mockImplementation(answering('help'))
    vi.mocked(Mapping.tutorial).mockImplementation(answering('tutorial'))
    const { result } = render(() => ({
      help: useShipped('help', 'fr'),
      tutorial: useShipped('tutorial', 'fr'),
    }))
    await waitFor(() => {
      expect(result.current).toMatchObject({
        help: { data: { id: 'help', title: 'fr' } },
        tutorial: { data: { id: 'tutorial', title: 'fr' } },
      })
    })
    expect(Mapping.tutorial).toHaveBeenCalledExactlyOnceWith({ data: { language: 'fr' } })
    expect(Mapping.help).toHaveBeenCalledExactlyOnceWith({ data: { language: 'fr' } })
  })
})
