// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Assistant from '#/api/assistant/assistant'
import * as Mapping from '#/api/mapping/mapping'

import { useSystem } from '../mapping/queries'
import { useConversation } from './conversation'
import { useFollowLatest } from './follow'

// Following the System and the Conversation over stand-ins for the server functions: the latest of
// both polled on focus, and every 2 s while the page follows closely, the System read again only once
// its Version moved past the one the cache holds, the Conversation once its last Entry is another than
// the one it read. The server functions themselves are src/api/assistant/assistant.test.ts's.
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn() }))
vi.mock('#/api/assistant/assistant', () => ({ latest: vi.fn(), conversationDay: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
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

/** What the poll answers: the System at a Version, and the Conversation's last Entry, if any. */
type Latest = number | { version: number; last?: string }

/** The poll's stand-in answers each of these in turn, then the last again. */
function polling(...answers: ReadonlyArray<Latest>) {
  const answer = (latest: Latest) => ok(typeof latest === 'number' ? { version: latest } : latest)
  const last = answers.at(-1) ?? 0
  for (const latest of answers)
    vi.mocked(Assistant.latest).mockImplementationOnce(() => answer(latest))
  vi.mocked(Assistant.latest).mockImplementation(() => answer(last))
}

/** Today's Conversation, its Entries named by these texts, its last Entry the last of them. */
const dayWith = (...texts: ReadonlyArray<string>) => ({
  day: { date: '2026-10-10', offset: 0 },
  entries: texts.map((text) => ({
    _tag: 'Message',
    author: 'user',
    text,
    id: text,
    at: new Date(),
  })),
  titles: {},
  ...(texts.length > 0 && { last: texts.at(-1) }),
})

/** The Conversation's stand-in answers `first`, then `then` on every read after it. */
function conversing(first: unknown, then: unknown) {
  vi.mocked(Assistant.conversationDay)
    .mockImplementationOnce(() => ok(first))
    .mockImplementation(() => ok(then))
}

/**
 * The page: the System it shows, the Conversation's last Entry it shows, and the poll following
 * both, closely or not. Today's Conversation is empty unless a test says otherwise.
 */
function render(closely = false) {
  if (vi.mocked(Assistant.conversationDay).getMockImplementation() === undefined)
    conversing(dayWith(), dayWith())
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(
    () => {
      useFollowLatest({ closely })
      const days = useConversation().data?.pages
      return { system: useSystem().data?.system, said: days?.[0]?.entries.at(-1) }
    },
    { wrapper },
  )
  return { ...rendered, client }
}

/** A write settles, landed, in the System's queue or another. */
const settled = (client: QueryClient, queue: string) =>
  act(() =>
    client
      .getMutationCache()
      .build(client, { scope: { id: queue }, mutationFn: () => Promise.resolve() })
      .execute(undefined),
  )

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
      expect(result.current.system?.root.title).toBe('First')
    })
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(1)
    })
    refocus()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('Read again')
    })
    expect(Assistant.latest).toHaveBeenCalledTimes(2)
    expect(Mapping.system).toHaveBeenCalledTimes(2)
  })

  it('polls on focus without reading the System again while its Version stays', async () => {
    reading(systemAt(3, 'First'), systemAt(3, 'Never read'))
    polling(3)
    const { result } = render()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    for (const times of [2, 3]) {
      refocus()
      await waitFor(() => {
        expect(Assistant.latest).toHaveBeenCalledTimes(times)
      })
    }
    expect(Mapping.system).toHaveBeenCalledTimes(1)
    expect(result.current.system?.root.title).toBe('First')
  })

  it('reads once more when the read it made lands still behind the Version polled', async () => {
    vi.mocked(Mapping.system)
      .mockImplementationOnce(() => ok(systemAt(3, 'First')))
      .mockImplementationOnce(() => ok(systemAt(4, 'Started before')))
      .mockImplementation(() => ok(systemAt(5, 'Caught up')))
    polling(3, 5)
    const { result } = render()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(1)
    })
    refocus()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('Caught up')
    })
    expect(Mapping.system).toHaveBeenCalledTimes(3)
  })

  it('reads nothing again for a Version behind the cache’s, a read that landed first', async () => {
    reading(systemAt(5, 'First'), systemAt(5, 'Never read'))
    polling(4)
    const { result } = render()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    refocus()
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(2)
    })
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })

  it('polls every 2 s while following closely, and reads the System again once it moved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    reading(systemAt(1, 'First'), systemAt(2, 'Read again'))
    polling(1, 1, 2)
    const { result } = render(true)
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    expect(Mapping.system).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('Read again')
    })
    expect(Assistant.latest).toHaveBeenCalledTimes(3)
  })

  it('polls nothing on a timer while not following closely', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    reading(systemAt(1, 'First'), systemAt(2, 'Never read'))
    polling(1, 2)
    const { result } = render()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(Assistant.latest).toHaveBeenCalledTimes(1)
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })
})

describe('the page following the Conversation', () => {
  it('reads the Conversation again on focus once its last Entry is another, the System not', async () => {
    reading(systemAt(3, 'First'), systemAt(3, 'Never read'))
    conversing(dayWith('mine'), dayWith('mine', 'a Key’s'))
    polling({ version: 3, last: 'mine' }, { version: 3, last: 'a Key’s' })
    const { result } = render()
    await waitFor(() => {
      expect(result.current.said).toMatchObject({ text: 'mine' })
    })
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(1)
    })
    expect(Assistant.conversationDay).toHaveBeenCalledTimes(1)
    refocus()
    await waitFor(() => {
      expect(result.current.said).toMatchObject({ text: 'a Key’s' })
    })
    expect(Assistant.conversationDay).toHaveBeenCalledTimes(2)
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })

  it('reads nothing again while the Conversation’s last Entry is the one it read', async () => {
    reading(systemAt(3, 'First'), systemAt(3, 'Never read'))
    conversing(dayWith('mine'), dayWith('never read'))
    polling({ version: 3, last: 'mine' })
    const { result } = render()
    await waitFor(() => {
      expect(result.current.said).toMatchObject({ text: 'mine' })
    })
    for (const times of [2, 3]) {
      refocus()
      await waitFor(() => {
        expect(Assistant.latest).toHaveBeenCalledTimes(times)
      })
    }
    expect(Assistant.conversationDay).toHaveBeenCalledTimes(1)
    expect(Mapping.system).toHaveBeenCalledTimes(1)
  })

  it('reads the System and the Conversation again together when both moved', async () => {
    reading(systemAt(3, 'First'), systemAt(4, 'Read again'))
    conversing(dayWith(), dayWith('edited by a Key'))
    polling(3, { version: 4, last: 'edited by a Key' })
    const { result } = render()
    await waitFor(() => {
      expect(result.current.system?.root.title).toBe('First')
    })
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(1)
    })
    refocus()
    await waitFor(() => {
      expect(result.current.said).toMatchObject({ text: 'edited by a Key' })
    })
    expect(result.current.system?.root.title).toBe('Read again')
  })

  it('polls once a write to the System settled, and reads the Entry it recorded', async () => {
    reading(systemAt(3, 'First'), systemAt(3, 'First'))
    conversing(dayWith(), dayWith('you edited it'))
    polling(3, { version: 3, last: 'you edited it' })
    const { result, client } = render()
    await waitFor(() => {
      expect(Assistant.latest).toHaveBeenCalledTimes(1)
    })
    await settled(client, 'conversation')
    expect(Assistant.latest).toHaveBeenCalledTimes(1)
    await settled(client, 'system')
    await waitFor(() => {
      expect(result.current.said).toMatchObject({ text: 'you edited it' })
    })
    expect(Assistant.latest).toHaveBeenCalledTimes(2)
  })
})
