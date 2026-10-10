// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { conversationDay, postMessage, recordNavigation } from '#/api/assistant/assistant'

import { useConversation, usePostMessage, useRecordNavigation } from './conversation'

// The Conversation's hooks over stand-ins for Assistant's server functions: what each calls, with the
// reader's day, and when the Conversation is read again. The server functions themselves are covered
// in src/api/assistant/assistant.test.ts.
vi.mock('#/api/assistant/assistant', () => ({
  conversationDay: vi.fn(),
  postMessage: vi.fn(),
  recordNavigation: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const today = { day: { date: '2026-10-10', offset: 120 }, entries: [], titles: {} }

/** The server function stand-ins: today's Conversation is empty, every write succeeds. */
function answering() {
  vi.mocked(conversationDay).mockResolvedValue({ ok: true, value: today } as never)
  vi.mocked(postMessage).mockResolvedValue({ ok: true, value: {} } as never)
  vi.mocked(recordNavigation).mockResolvedValue({ ok: true, value: {} } as never)
}

/** Renders `hook` beside today's Conversation, under a QueryClient of its own, once it is read. */
async function render<T>(hook: () => T) {
  answering()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(() => ({ days: useConversation(), hook: hook() }), { wrapper })
  await waitFor(() => {
    expect(rendered.result.current.days.isSuccess).toBe(true)
  })
  return rendered.result
}

/** How many minutes the test's clock stands ahead of UTC at an instant. */
const offsetAt = (at: Date) => -at.getTimezoneOffset()

describe("the Conversation's hooks", () => {
  it('read today, the reader’s own date, in their time zone', async () => {
    const result = await render(() => undefined)
    expect(result.current.days.data?.pages).toEqual([today])
    const now = new Date()
    const [year, month, date] = [now.getFullYear(), now.getMonth(), now.getDate()]
    expect(conversationDay).toHaveBeenCalledWith({
      data: {
        date: [year, month + 1, date].map((n) => String(n).padStart(2, '0')).join('-'),
        offset: offsetAt(new Date(year, month, date)),
        nextOffset: offsetAt(new Date(year, month, date + 1)),
      },
    })
    expect(result.current.days.hasNextPage).toBe(false)
  })

  it('read, scrolling back, the reader’s day holding the latest Entry before, at its offsets', async () => {
    // Before today, the latest Entry is on 29 March 2026, at noon of the reader's clock.
    const earlier = new Date(2026, 2, 29, 12)
    const before = { day: { date: '2026-03-29', offset: 0 }, entries: [], titles: {} }
    vi.mocked(conversationDay)
      .mockResolvedValueOnce({ ok: true, value: { ...today, earlier } } as never)
      .mockResolvedValueOnce({ ok: true, value: before } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const { result } = renderHook(useConversation, { wrapper })
    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true)
    })
    await act(() => result.current.fetchNextPage())
    await waitFor(() => {
      expect(result.current.data?.pages).toEqual([{ ...today, earlier }, before])
    })
    expect(conversationDay).toHaveBeenLastCalledWith({
      data: {
        date: '2026-03-29',
        offset: offsetAt(new Date(2026, 2, 29)),
        nextOffset: offsetAt(new Date(2026, 2, 30)),
      },
    })
    expect(result.current.hasNextPage).toBe(false)
  })

  it('post a Message, then read the Conversation again', async () => {
    const result = await render(usePostMessage)
    act(() => {
      result.current.hook.mutate('Hello')
    })
    await waitFor(() => {
      expect(conversationDay).toHaveBeenCalledTimes(2)
    })
    expect(postMessage).toHaveBeenCalledWith({ data: { text: 'Hello' } })
  })

  it('record a merged navigation, then read the Conversation again', async () => {
    const result = await render(useRecordNavigation)
    const sent = {
      navigation: {
        _tag: 'Navigation' as const,
        steps: [{ gesture: 'center', tile: 'a' }],
        gestures: 1,
      },
      sinceLast: 1_500,
    }
    act(() => {
      result.current.hook.mutate(sent)
    })
    await waitFor(() => {
      expect(conversationDay).toHaveBeenCalledTimes(2)
    })
    expect(recordNavigation).toHaveBeenCalledWith({ data: sent })
  })
})
