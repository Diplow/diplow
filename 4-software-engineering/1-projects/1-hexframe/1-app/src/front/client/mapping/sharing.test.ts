// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { findStars, setGrant, starOfLink, whoReaches } from '#/api/mapping/mapping'

import { CallFailed } from '../calls'
import { typedOf, useSetGrant, useStarsFor, useWhoReaches } from './sharing'

// The hooks over stand-ins for Mapping's server functions: what each calls, and when who reaches a
// Tile is read again; and what is typed in the star picker, read as a Title or a link, and the stars
// it leads to. The server functions themselves are covered in src/api/mapping/seen.test.ts.
vi.mock('#/api/mapping/mapping', () => ({
  whoReaches: vi.fn(),
  setGrant: vi.fn(),
  findStars: vi.fn(),
  starOfLink: vi.fn(),
}))

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

const page = 'https://hexframe.ai/fr/?center=x'
const star = { id: crypto.randomUUID(), title: 'Ana', preview: 'Gardens.' }

describe('what is typed in the star picker', () => {
  it('reads a Title as the query it makes, none while too short', () => {
    expect(typedOf('  Ana ', page)).toEqual({ by: 'title', query: 'Ana' })
    expect(typedOf('A', page)).toEqual({ by: 'title', query: undefined })
    expect(typedOf('t/abc', page)).toEqual({ by: 'title', query: 't/abc' })
  })

  it('reads a link to a Tile on this site, its page or home centered on it, as that Tile', () => {
    const tile = crypto.randomUUID()
    for (const link of [
      `/t/${tile}`,
      `/fr/t/${tile}`,
      `https://hexframe.ai/t/${tile}`,
      `HTTPS://hexframe.ai/?center=${tile}`,
    ]) {
      expect(typedOf(link, page)).toEqual({ by: 'link', tile })
    }
  })

  it('reads a link to a Tile hexframe ships as that Tile, by the id a visit takes (HEX-139)', () => {
    expect(typedOf('/t/help', page)).toEqual({ by: 'link', tile: 'help' })
    expect(typedOf('https://hexframe.ai/fr/t/help%2F3', page)).toEqual({
      by: 'link',
      tile: 'help/3',
    })
  })

  it('reads a link to no Tile, on another site or by an id no Tile could have, as one naming none', () => {
    for (const link of [
      `https://elsewhere.example/t/${crypto.randomUUID()}`,
      '/t/nothing',
      '/t/help%2F9',
      '/settings',
      'https://',
    ]) {
      expect(typedOf(link, page)).toEqual({ by: 'link', tile: undefined })
    }
  })
})

/** Renders the stars `typed` leads to, under a QueryClient of its own. */
function rendering(typed: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(({ text }) => useStarsFor(text, page), {
    wrapper,
    initialProps: { text: typed },
  })
}

describe('the stars what is typed leads to', () => {
  it('asks nothing while too short, then finds the stars a Title holds', async () => {
    vi.mocked(findStars).mockResolvedValue({ ok: true, value: [star] } as never)
    const { result, rerender } = rendering('A')
    expect(result.current).toEqual({ state: 'short' })
    expect(findStars).not.toHaveBeenCalled()
    rerender({ text: 'Ana' })
    expect(result.current).toEqual({ state: 'looking' })
    await waitFor(() => {
      expect(result.current).toEqual({ state: 'found', stars: [star] })
    })
    expect(findStars).toHaveBeenCalledWith({ data: { query: 'Ana' } })
  })

  it('keeps the stars found while the next are on their way', async () => {
    vi.mocked(findStars).mockResolvedValueOnce({ ok: true, value: [star] } as never)
    vi.mocked(findStars).mockReturnValueOnce(new Promise(() => undefined) as never)
    const { result, rerender } = rendering('Ana')
    await waitFor(() => {
      expect(result.current).toEqual({ state: 'found', stars: [star] })
    })
    rerender({ text: 'Anab' })
    expect(result.current).toEqual({ state: 'found', stars: [star], stale: true })
  })

  it('leads a link to its star, to the user’s own, or nowhere', async () => {
    const tile = crypto.randomUUID()
    const answers = [
      [
        { _tag: 'Star', star },
        { state: 'found', stars: [star] },
      ],
      [{ _tag: 'Own' }, { state: 'own' }],
      [{ _tag: 'Nowhere' }, { state: 'nowhere' }],
    ] as const
    for (const [answer, shown] of answers) {
      vi.mocked(starOfLink).mockResolvedValue({ ok: true, value: answer } as never)
      const { result, unmount } = rendering(`/t/${tile}`)
      await waitFor(() => {
        expect(result.current).toEqual(shown)
      })
      unmount()
    }
    expect(starOfLink).toHaveBeenCalledWith({ data: { tile } })
  })

  it('leads a link to Help to the star holding it, the Hexframe Organization’s', async () => {
    const hexframe = { id: crypto.randomUUID(), title: 'Hexframe', preview: '' }
    vi.mocked(starOfLink).mockResolvedValue({
      ok: true,
      value: { _tag: 'Star', star: hexframe },
    } as never)
    const { result } = rendering('/t/help')
    await waitFor(() => {
      expect(result.current).toEqual({ state: 'found', stars: [hexframe] })
    })
    expect(starOfLink).toHaveBeenCalledWith({ data: { tile: 'help' } })
  })

  it('asks nothing of a link that names no Tile', () => {
    const { result } = rendering('/settings')
    expect(result.current).toEqual({ state: 'nowhere' })
    expect(starOfLink).not.toHaveBeenCalled()
  })
})
