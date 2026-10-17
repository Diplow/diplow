// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acceptProposal,
  assistantAvailable,
  conversationDay,
  discardProposal,
  latest,
  postMessage,
  recordNavigation,
  setMode,
  stopTurn,
  undo,
} from '#/api/assistant/assistant'

import { makeQueryClient } from '../channels'
import {
  latestRead,
  useAcceptProposal,
  useAssistantAvailable,
  useConversation,
  useDiscardProposal,
  useMessagesOnTheirWay,
  useNavigationsOnTheirWay,
  usePostMessage,
  useRecordNavigation,
  useSetMode,
  useStopTurn,
  useUndo,
} from './conversation'

// The Conversation's hooks over stand-ins for Assistant's server functions: what each calls, with the
// reader's day, and when the Conversation is read again and the latest polled. The server functions
// themselves are covered in src/api/assistant/assistant.test.ts.
vi.mock('#/api/assistant/assistant', () => ({
  acceptProposal: vi.fn(),
  assistantAvailable: vi.fn(),
  conversationDay: vi.fn(),
  discardProposal: vi.fn(),
  latest: vi.fn(),
  postMessage: vi.fn(),
  recordNavigation: vi.fn(),
  setMode: vi.fn(),
  stopTurn: vi.fn(),
  undo: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const today = { day: { date: '2026-10-10', offset: 120 }, entries: [], titles: {} }

/** The server function stand-ins: today's Conversation is empty, every write succeeds. */
function answering() {
  vi.mocked(conversationDay).mockResolvedValue({ ok: true, value: today } as never)
  vi.mocked(latest).mockResolvedValue({ ok: true, value: { version: 0 } } as never)
  vi.mocked(postMessage).mockResolvedValue({ ok: true, value: {} } as never)
  vi.mocked(stopTurn).mockResolvedValue({ ok: true, value: null } as never)
  vi.mocked(recordNavigation).mockResolvedValue({ ok: true, value: {} } as never)
  vi.mocked(setMode).mockResolvedValue({ ok: true, value: 'apply' } as never)
  vi.mocked(acceptProposal).mockResolvedValue({ ok: true, value: null } as never)
  vi.mocked(discardProposal).mockResolvedValue({ ok: true, value: null } as never)
  vi.mocked(undo).mockResolvedValue({ ok: true, value: null } as never)
}

/** Renders `hook` beside today's Conversation, under a QueryClient of its own, once it is read. */
async function render<T>(hook: () => T) {
  answering()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(
    () => ({ days: useConversation(), latest: useQuery(latestRead), hook: hook() }),
    { wrapper },
  )
  await waitFor(() => {
    expect(rendered.result.current.days.isSuccess).toBe(true)
    expect(rendered.result.current.latest.isSuccess).toBe(true)
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

  it('post a Message from its view, with the reader’s offset, then read the Conversation again and poll', async () => {
    const result = await render(usePostMessage)
    const view = { center: 'root', shown: ['root', 'a'] }
    act(() => {
      result.current.hook.mutate({ text: 'Hello', view })
    })
    await waitFor(() => {
      expect(conversationDay).toHaveBeenCalledTimes(2)
      expect(latest).toHaveBeenCalledTimes(2)
    })
    expect(postMessage).toHaveBeenCalledWith({
      data: { text: 'Hello', view, offset: offsetAt(new Date()) },
    })
  })

  it('stop the Turn running, then read the Conversation again and poll', async () => {
    const result = await render(useStopTurn)
    act(() => {
      result.current.hook.mutate()
    })
    await waitFor(() => {
      expect(conversationDay).toHaveBeenCalledTimes(2)
      expect(latest).toHaveBeenCalledTimes(2)
    })
    expect(stopTurn).toHaveBeenCalledWith({ data: undefined })
  })

  it.each([true, false])(
    'read whether the Account may use the Assistant: %s',
    async (available) => {
      vi.mocked(assistantAvailable).mockResolvedValue({ ok: true, value: available } as never)
      const result = await render(useAssistantAvailable)
      await waitFor(() => {
        expect(result.current.hook.data).toBe(available)
      })
      expect(assistantAvailable).toHaveBeenCalledWith({ data: undefined })
    },
  )

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

  it('switch the Mode, then poll the latest, which says it', async () => {
    const result = await render(useSetMode)
    act(() => {
      result.current.hook.mutate('apply')
    })
    await waitFor(() => {
      expect(latest).toHaveBeenCalledTimes(2)
    })
    expect(setMode).toHaveBeenCalledWith({ data: { mode: 'apply' } })
    expect(conversationDay).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['accept', useAcceptProposal, acceptProposal],
    ['discard', useDiscardProposal, discardProposal],
  ] as const)(
    '%s the open Proposal, then read the Conversation again and poll',
    async (_, hook, call) => {
      const result = await render(hook)
      act(() => {
        result.current.hook.mutate('proposal-1')
      })
      await waitFor(() => {
        expect(conversationDay).toHaveBeenCalledTimes(2)
        expect(latest).toHaveBeenCalledTimes(2)
      })
      expect(call).toHaveBeenCalledWith({ data: { proposal: 'proposal-1' } })
    },
  )

  it('undoes what was applied by its id, then reads the Conversation again and polls', async () => {
    const result = await render(useUndo)
    act(() => {
      result.current.hook.mutate('turn-1')
    })
    await waitFor(() => {
      expect(conversationDay).toHaveBeenCalledTimes(2)
      expect(latest).toHaveBeenCalledTimes(2)
    })
    expect(undo).toHaveBeenCalledWith({ data: { applied: 'turn-1' } })
  })

  it('leave the Conversation read beside the chat undefined once its read failed, thrown nowhere', async () => {
    vi.mocked(conversationDay).mockResolvedValueOnce({
      ok: false,
      failure: { _tag: 'Unexpected', kind: 'Unexpected' },
      requestId: 'req-1',
    } as never)
    // The app's QueryClient, which throws a read's failure to the nearest boundary.
    const client = makeQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const { result } = renderHook(() => useConversation({ throwing: false }), { wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.data).toBeUndefined()
  })
})

describe('the Messages on their way', () => {
  it('hold a Message on its way until the Conversation read after it has landed', async () => {
    let answer: (outcome: unknown) => void = () => undefined
    const result = await render(() => ({ post: usePostMessage(), sent: useMessagesOnTheirWay() }))
    vi.mocked(postMessage).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }) as never,
    )
    const view = { center: 'root', shown: ['root'] }
    act(() => {
      result.current.hook.post.mutate({ text: 'Hello', view })
    })
    await waitFor(() => {
      expect(result.current.hook.sent.messages).toEqual([
        { id: expect.any(Number) as number, sent: { text: 'Hello', view }, refused: false },
      ])
    })
    act(() => {
      answer({ ok: true, value: {} })
    })
    await waitFor(() => {
      expect(result.current.hook.sent.messages).toEqual([])
    })
    expect(conversationDay).toHaveBeenCalledTimes(2)
  })

  it('keep a refused Message until it is forgotten', async () => {
    const result = await render(() => ({ post: usePostMessage(), sent: useMessagesOnTheirWay() }))
    vi.mocked(postMessage).mockRejectedValueOnce(new Error('down'))
    act(() => {
      result.current.hook.post.mutate({ text: 'Hello', view: { center: 'root', shown: [] } })
    })
    await waitFor(() => {
      expect(result.current.hook.sent.messages.map(({ refused }) => refused)).toEqual([true])
    })
    act(() => {
      result.current.hook.sent.forget(result.current.hook.sent.messages[0]?.id ?? -1)
    })
    await waitFor(() => {
      expect(result.current.hook.sent.messages).toEqual([])
    })
  })
})

describe('the navigations on their way', () => {
  it('hold a navigation on its way until the Conversation read after it has landed', async () => {
    let answer: (outcome: unknown) => void = () => undefined
    const result = await render(() => ({
      record: useRecordNavigation(),
      going: useNavigationsOnTheirWay(),
    }))
    vi.mocked(recordNavigation).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }) as never,
    )
    const navigation = {
      _tag: 'Navigation' as const,
      steps: [{ gesture: 'expand', tile: 'a' }],
      gestures: 1,
    }
    act(() => {
      result.current.hook.record.mutate({ navigation, sinceLast: 0 })
    })
    await waitFor(() => {
      expect(result.current.hook.going).toEqual([
        { id: expect.any(Number) as number, navigation, at: expect.any(Number) as number },
      ])
    })
    act(() => {
      answer({ ok: true, value: {} })
    })
    await waitFor(() => {
      expect(result.current.hook.going).toEqual([])
    })
    expect(conversationDay).toHaveBeenCalledTimes(2)
  })

  it('drop a refused navigation, as a lost one is', async () => {
    const result = await render(() => ({
      record: useRecordNavigation(),
      going: useNavigationsOnTheirWay(),
    }))
    vi.mocked(recordNavigation).mockRejectedValueOnce(new Error('down'))
    act(() => {
      result.current.hook.record.mutate({
        navigation: { _tag: 'Navigation', steps: [{ gesture: 'center', tile: 'a' }], gestures: 1 },
        sinceLast: 0,
      })
    })
    await waitFor(() => {
      expect(recordNavigation).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.hook.going).toEqual([])
    })
  })
})
