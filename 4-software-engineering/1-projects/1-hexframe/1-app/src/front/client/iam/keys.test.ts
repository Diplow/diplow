// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodeFailure } from '#/api/errors/failure'
import { messageFor } from '#/api/errors/messages'
import { issueKey, keys, revokeKey } from '#/api/iam/iam'

import { CallFailed } from '../calls'
import { useIssueKeySubmit, useKeys, useRevokeKey } from './keys'

// The hooks over stand-ins for IAM's server functions: what each calls, what it answers, and when the
// Keys are read again. The server functions themselves are covered in src/api/iam/iam.test.ts. A
// refusal is what the client receives, its wire form: the front never imports a domain.
vi.mock('#/api/iam/iam', () => ({ keys: vi.fn(), issueKey: vi.fn(), revokeKey: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const laptop = {
  id: 'k1',
  name: 'laptop',
  start: 'hf_abc',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  lastUsedAt: null,
}
const secret = 'hf_abcdefghijklmnop'

/** The server function stand-ins: the Keys read answers `laptop`, issuing and revoking succeed. */
function answering() {
  vi.mocked(keys).mockResolvedValue({ ok: true, value: [laptop] } as never)
  vi.mocked(issueKey).mockResolvedValue({ ok: true, value: { key: laptop, secret } } as never)
  vi.mocked(revokeKey).mockResolvedValue({ ok: true, value: undefined } as never)
}

/** Renders `hook` beside the Keys' read, under a QueryClient of its own, once the Keys are read. */
async function render<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(() => ({ keys: useKeys(), hook: hook() }), { wrapper })
  await waitFor(() => {
    expect(rendered.result.current.keys.isSuccess).toBe(true)
  })
  return { client, result: rendered.result }
}

describe("the Keys' hooks", () => {
  it('read the Keys through their server function', async () => {
    answering()
    const { result } = await render(() => undefined)
    expect(result.current.keys.data).toEqual([laptop])
    expect(keys).toHaveBeenCalledWith({ data: undefined })
  })

  it('revoke a Key by its id, then read the Keys again', async () => {
    answering()
    const { result } = await render(useRevokeKey)
    await result.current.hook.mutateAsync({ id: 'k1' })
    expect(revokeKey).toHaveBeenCalledWith({ data: { id: 'k1' } })
    await waitFor(() => {
      expect(keys).toHaveBeenCalledTimes(2)
    })
  })

  it('throw a refused revoke as a CallFailed holding it, and read the Keys again all the same', async () => {
    answering()
    const keyNotFound = { _tag: 'KeyNotFound', kind: 'NotFound' } as const
    vi.mocked(revokeKey).mockResolvedValue({
      ok: false,
      failure: keyNotFound,
      requestId: 'req-1',
    } as never)
    const { result } = await render(useRevokeKey)
    const failed = await result.current.hook
      .mutateAsync({ id: 'gone' })
      .catch((error: unknown) => error)
    expect(failed).toBeInstanceOf(CallFailed)
    expect(failed).toMatchObject({ scope: 'revokeKey', failure: decodeFailure(keyNotFound) })
    await waitFor(() => {
      expect(keys).toHaveBeenCalledTimes(2)
    })
  })
})

describe('issuing a Key', () => {
  it('hands the Key and its secret to the caller, keeps the secret in no cache, and reads the Keys again', async () => {
    answering()
    const onIssued = vi.fn()
    const { client, result } = await render(() => useIssueKeySubmit(onIssued))
    await expect(result.current.hook({ value: { name: 'laptop' } })).resolves.toBeUndefined()
    expect(issueKey).toHaveBeenCalledWith({ data: { name: 'laptop' } })
    expect(onIssued).toHaveBeenCalledWith({ key: laptop, secret })
    await waitFor(() => {
      expect(keys).toHaveBeenCalledTimes(2)
    })
    const cached = JSON.stringify([
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.data),
    ])
    expect(cached).not.toContain(secret)
  })

  it('shows a refused name on its field, and reads the Keys again all the same', async () => {
    answering()
    const keyNameInvalid = { _tag: 'KeyNameInvalid', kind: 'Invalid', fields: ['name'] } as const
    vi.mocked(issueKey).mockResolvedValue({
      ok: false,
      failure: keyNameInvalid,
      requestId: 'req-1',
    } as never)
    const onIssued = vi.fn()
    const { result } = await render(() => useIssueKeySubmit(onIssued))
    await expect(result.current.hook({ value: { name: '' } })).resolves.toEqual({
      fields: { name: messageFor(decodeFailure(keyNameInvalid), 'issueKey') },
    })
    expect(onIssued).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(keys).toHaveBeenCalledTimes(2)
    })
  })
})
