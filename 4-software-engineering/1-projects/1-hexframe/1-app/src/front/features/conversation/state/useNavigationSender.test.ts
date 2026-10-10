// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { postMessage, recordNavigation } from '#/api/assistant/assistant'
import { deleteTile } from '#/api/mapping/mapping'
import { useDeleteTile } from '#/front/client/mapping/queries'

import { publish } from '../../bus'
import { Navigated } from '../../facts'
import { useNavigationSender } from './useNavigationSender'

// The navigation sender, over stand-ins for the server functions: gestures published as navigation
// facts, as home publishes them, merge into one navigation, sent once a Message, a write to the System
// or the page hiding comes next, and never one per gesture. The merge rule itself is Assistant's
// (`domains/assistant/entities/navigation.test.ts`).
vi.mock('#/api/assistant/assistant', () => ({
  conversationDay: vi.fn(),
  postMessage: vi.fn(),
  recordNavigation: vi.fn(),
}))
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn(), deleteTile: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

/** The server functions answering, each with nothing worth reading. */
function answering() {
  vi.mocked(recordNavigation).mockResolvedValue({ ok: true, value: {} } as never)
  vi.mocked(postMessage).mockResolvedValue({ ok: true, value: {} } as never)
  vi.mocked(deleteTile).mockResolvedValue({ ok: true, value: undefined } as never)
}

/** Renders the sender beside a write to the System, under a QueryClient of its own. */
function rendered() {
  answering()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(
    () => ({ sender: useNavigationSender(), remove: useDeleteTile() }),
    {
      wrapper,
    },
  )
  return result
}

/** The user makes a gesture on the canvas, and home publishes it. */
const gesture = (tile: string, name: Navigated['gesture'] = 'center') => {
  act(() => {
    publish(new Navigated({ gesture: name, tile }))
  })
}

/** What each recorded navigation sent, in the order sent. */
const sentNavigations = () => vi.mocked(recordNavigation).mock.calls.map(([{ data }]) => data)

/** Hides or shows the page, as leaving its tab does. */
const visibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('the navigation sender', () => {
  it('sends ten gestures then a Message as one navigation, then the Message', async () => {
    const result = rendered()
    const tiles = Array.from({ length: 10 }, (_, n) => `tile-${String(n)}`)
    for (const tile of tiles) gesture(tile)
    expect(recordNavigation).not.toHaveBeenCalled()
    act(() => {
      result.current.sender.postMessage('What would you add to Games?')
    })
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1)
    })
    expect(sentNavigations()).toEqual([
      {
        navigation: {
          _tag: 'Navigation',
          steps: tiles.map((tile) => ({ gesture: 'center', tile })),
          gestures: 10,
        },
        sinceLast: expect.any(Number) as number,
      },
    ])
    expect(postMessage).toHaveBeenCalledWith({ data: { text: 'What would you add to Games?' } })
    const [navigationOrder] = vi.mocked(recordNavigation).mock.invocationCallOrder
    const [messageOrder] = vi.mocked(postMessage).mock.invocationCallOrder
    expect(navigationOrder).toBeLessThan(messageOrder ?? 0)
  })

  it('sends a Message alone when the user went nowhere since the last one', async () => {
    const result = rendered()
    gesture('a')
    act(() => {
      result.current.sender.postMessage('First')
    })
    act(() => {
      result.current.sender.postMessage('Second')
    })
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(2)
    })
    expect(recordNavigation).toHaveBeenCalledTimes(1)
  })

  it('sends the navigation under way the moment a write to the System is made', async () => {
    const result = rendered()
    gesture('a', 'expand')
    gesture('a', 'collapse')
    act(() => {
      result.current.remove.mutate({ id: crypto.randomUUID(), version: 1 })
    })
    await waitFor(() => {
      expect(recordNavigation).toHaveBeenCalledTimes(1)
    })
    expect(sentNavigations()[0]?.navigation).toEqual({
      _tag: 'Navigation',
      steps: [
        { gesture: 'expand', tile: 'a' },
        { gesture: 'collapse', tile: 'a' },
      ],
      gestures: 2,
    })
  })

  it('sends the navigation under way when the page is hidden, and nothing when shown again', async () => {
    rendered()
    gesture('a')
    visibility('hidden')
    await waitFor(() => {
      expect(recordNavigation).toHaveBeenCalledTimes(1)
    })
    visibility('visible')
    visibility('hidden')
    expect(recordNavigation).toHaveBeenCalledTimes(1)
  })

  it('starts a new navigation once one is sent', async () => {
    rendered()
    gesture('a')
    visibility('hidden')
    await waitFor(() => {
      expect(recordNavigation).toHaveBeenCalledTimes(1)
    })
    visibility('visible')
    gesture('b', 'show-context')
    visibility('hidden')
    await waitFor(() => {
      expect(recordNavigation).toHaveBeenCalledTimes(2)
    })
    expect(sentNavigations().map(({ navigation }) => navigation.steps)).toEqual([
      [{ gesture: 'center', tile: 'a' }],
      [{ gesture: 'show-context', tile: 'b' }],
    ])
  })
})
