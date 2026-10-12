// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { issueKey } from '#/api/iam/iam'
import { encodeFailure } from '#/api/report/errors/failure'
import { KeyNameInvalid } from '#/domains/iam/errors'
import { makeQueryClient } from '#/front/client/channels'

import { stepOnOpen, useKeyWidgetState, type KeyStep } from './useKeyWidgetState'

// The key widget's steps, over a stand-in for IAM's issuing: the Keys, a name, the secret shown once,
// then the receipt; a refused name on its field; the URL closing the widget forgetting the secret.
vi.mock('#/api/iam/iam', () => ({ issueKey: vi.fn(), keys: vi.fn(), revokeKey: vi.fn() }))
vi.mock('#/front/ui/atoms/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const issued = {
  key: { id: 'k1', name: 'Laptop', start: 'hf_a3f', createdAt: new Date(0), lastUsedAt: null },
  secret: 'hf_a3fEXAMPLE',
}

function render(open = true) {
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result, rerender } = renderHook(({ open: now }) => useKeyWidgetState(now), {
    wrapper,
    initialProps: { open },
  })
  return {
    result,
    reopen: (now: boolean) => {
      rerender({ open: now })
    },
    run: (action: (actions: (typeof result.current)['actions']) => void) => {
      act(() => {
        action(result.current.actions)
      })
    },
  }
}

describe('the key widget on home', () => {
  it('opens on the Keys, then a new one named, then its secret with its command', async () => {
    vi.mocked(issueKey).mockResolvedValue({ ok: true, value: issued, requestId: 'r' } as never)
    const { result, run } = render()
    expect(result.current.state.step).toEqual({ kind: 'list' })
    run((actions) => {
      actions.issue()
      actions.name('Laptop')
    })
    expect(result.current.state).toMatchObject({ step: { kind: 'issue' }, name: 'Laptop' })
    await act(() => result.current.actions.send())
    expect(issueKey).toHaveBeenCalledExactlyOnceWith({ data: { name: 'Laptop' } })
    expect(result.current.state.step).toEqual({
      kind: 'shown',
      name: 'Laptop',
      secret: 'hf_a3fEXAMPLE',
      command: expect.stringContaining('Authorization: Bearer hf_a3fEXAMPLE') as string,
    })
    expect(result.current.state.sending).toBe(false)
  })

  it('leaves a receipt naming the Key, never its secret, once done', async () => {
    vi.mocked(issueKey).mockResolvedValue({ ok: true, value: issued, requestId: 'r' } as never)
    const { result, run, reopen } = render()
    run((actions) => {
      actions.issue()
      actions.name('Laptop')
    })
    await act(() => result.current.actions.send())
    run((actions) => {
      actions.done()
    })
    reopen(false)
    expect(result.current.state.step).toMatchObject({ kind: 'done', name: 'Laptop' })
    expect(JSON.stringify(result.current.state)).not.toContain('hf_a3fEXAMPLE')
    // Opened again, the Keys show, the receipt making way.
    reopen(true)
    expect(result.current.state.step).toEqual({ kind: 'list' })
  })

  it('shows a refused name on its field, until it changes', async () => {
    vi.mocked(issueKey).mockResolvedValue({
      ok: false,
      failure: encodeFailure(new KeyNameInvalid({ fields: ['name'] })),
      requestId: 'r',
    } as never)
    const { result, run } = render()
    run((actions) => {
      actions.issue()
    })
    await act(() => result.current.actions.send())
    expect(result.current.state.refused).toEqual(expect.any(String))
    expect(result.current.state.step).toEqual({ kind: 'issue' })
    run((actions) => {
      actions.name('L')
    })
    expect(result.current.state.refused).toBeUndefined()
  })

  it('goes back to the Keys, not now', () => {
    const { result, run } = render()
    run((actions) => {
      actions.issue()
      actions.later()
    })
    expect(result.current.state.step).toEqual({ kind: 'list' })
  })

  it('forgets a secret once the URL closes the widget', async () => {
    vi.mocked(issueKey).mockResolvedValue({ ok: true, value: issued, requestId: 'r' } as never)
    const { result, run, reopen } = render()
    run((actions) => {
      actions.issue()
      actions.name('Laptop')
    })
    await act(() => result.current.actions.send())
    reopen(false)
    expect(result.current.state.step).toEqual({ kind: 'list' })
  })
})

describe('the step the URL leaves', () => {
  const shown: KeyStep = { kind: 'shown', name: 'Laptop', secret: 's', command: 'c' }
  const done: KeyStep = { kind: 'done', name: 'Laptop', at: new Date(0) }

  it('keeps what is under way while open, a receipt making way for the Keys', () => {
    expect(stepOnOpen(shown, true)).toBe(shown)
    expect(stepOnOpen(done, true)).toEqual({ kind: 'list' })
  })

  it('forgets what was under way once closed, and keeps a receipt', () => {
    expect(stepOnOpen(shown, false)).toEqual({ kind: 'list' })
    expect(stepOnOpen(done, false)).toBe(done)
  })
})
