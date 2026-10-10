// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { conversationDay, postMessage, recordNavigation } from '#/api/assistant/assistant'

import { useConversationDay, usePostMessage, useRecordNavigation } from './conversation'

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
  const rendered = renderHook(() => ({ today: useConversationDay(), hook: hook() }), { wrapper })
  await waitFor(() => {
    expect(rendered.result.current.today.isSuccess).toBe(true)
  })
  return rendered.result
}

/** How many minutes the test's clock stands ahead of UTC at an instant. */
const offsetAt = (at: Date) => -at.getTimezoneOffset()

describe("the Conversation's hooks", () => {
  it('read today in the reader’s time zone, no date sent', async () => {
    const result = await render(() => undefined)
    expect(result.current.today.data).toEqual(today)
    const now = new Date()
    const [year, month, date] = [now.getFullYear(), now.getMonth(), now.getDate()]
    expect(conversationDay).toHaveBeenCalledWith({
      data: {
        offset: offsetAt(new Date(year, month, date)),
        nextOffset: offsetAt(new Date(year, month, date + 1)),
      },
    })
  })

  it('read a day of the reader’s calendar, at the offsets of its midnight and the next', async () => {
    const result = await render(() => useConversationDay('2026-03-29'))
    await waitFor(() => {
      expect(result.current.hook.isSuccess).toBe(true)
    })
    expect(conversationDay).toHaveBeenCalledWith({
      data: {
        date: '2026-03-29',
        offset: offsetAt(new Date(2026, 2, 29)),
        nextOffset: offsetAt(new Date(2026, 2, 30)),
      },
    })
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
