// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setGrant, whoReaches } from '#/api/mapping/mapping'

import { CallFailed } from '../calls'
import { useSetGrant, useWhoReaches } from './sharing'

// The hooks over stand-ins for Mapping's server functions: what each calls, and when who reaches a
// Tile is read again. The server functions themselves are covered in src/api/mapping/seen.test.ts.
vi.mock('#/api/mapping/mapping', () => ({ whoReaches: vi.fn(), setGrant: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const tile = crypto.randomUUID()
const everyone = { _tag: 'Everyone' } as const
const reached = { everyone: { subject: everyone, value: 'read', from: tile }, others: [] }

/** The stand-ins: the read answers Everyone reading the Tile, and the write succeeds. */
function answering() {
  vi.mocked(whoReaches).mockResolvedValue({ ok: true, value: reached } as never)
  vi.mocked(setGrant).mockResolvedValue({ ok: true, value: undefined } as never)
}

/** Renders `hook` beside who reaches the Tile, under a QueryClient of its own, once it is read. */
async function render<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(() => ({ reach: useWhoReaches(tile), hook: hook() }), { wrapper })
  await waitFor(() => {
    expect(rendered.result.current.reach.isSuccess).toBe(true)
  })
  return rendered.result
}

describe('who reaches a Tile, on the client', () => {
  it('reads who reaches the Tile through its server function', async () => {
    answering()
    const result = await render(() => undefined)
    expect(result.current.reach.data).toEqual(reached)
    expect(whoReaches).toHaveBeenCalledWith({ data: { tile } })
  })

  it('sets Everyone on the Tile, then reads who reaches it again', async () => {
    answering()
    const result = await render(useSetGrant)
    await result.current.hook.mutateAsync({ tile, subject: everyone, value: 'none' })
    expect(setGrant).toHaveBeenCalledWith({ data: { tile, subject: everyone, value: 'none' } })
    await waitFor(() => {
      expect(whoReaches).toHaveBeenCalledTimes(2)
    })
  })

  it('throws a refused change as a CallFailed holding it, and reads who reaches it again all the same', async () => {
    answering()
    vi.mocked(setGrant).mockResolvedValue({
      ok: false,
      failure: { _tag: 'NotAllowed', kind: 'Forbidden' },
      requestId: 'req-1',
    } as never)
    const result = await render(useSetGrant)
    const failed = await result.current.hook
      .mutateAsync({ tile, subject: everyone, value: 'read' })
      .catch((error: unknown) => error)
    expect(failed).toBeInstanceOf(CallFailed)
    expect(failed).toMatchObject({ scope: 'setGrant', failure: { _tag: 'NotAllowed' } })
    await waitFor(() => {
      expect(whoReaches).toHaveBeenCalledTimes(2)
    })
  })
})
