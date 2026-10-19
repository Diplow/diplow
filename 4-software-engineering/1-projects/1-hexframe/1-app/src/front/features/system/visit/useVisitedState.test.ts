// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import type { FoundTile, Seen } from '#/domains/mapping/entities'
import { makeQueryClient } from '#/front/client/channels'

import { useVisitedState } from './useVisitedState'

// The System home's URL visits, over a stand-in for the server function: none on the Account's own,
// its star named included; someone else's from its star; and the Titles of what was visited kept for
// the chat once the canvas went home.
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const star = (id: string, title: string): FoundTile => ({
  _tag: 'Tile',
  id,
  title,
  preview: '',
  body: '',
  version: 1,
})

const seen = (root: FoundTile, tiles: Seen['tiles'] = {}): Seen => ({
  root,
  tiles,
  rights: {},
  gaps: {},
  pinned: {},
  asOwner: false,
  version: 0,
})

const bobs = seen(star('bob', 'Bob'))
const anas = seen(star('ana', 'Ana'), {
  garden: { ...star('garden', 'Garden'), parent: 'ana', slot: 2 },
})

/** The server function, answering Bob's System, or Ana's by her star. */
function answering() {
  vi.mocked(Mapping.system).mockImplementation((({ data }: { data?: { system: string } }) =>
    Promise.resolve({ ok: true, value: data?.system === 'ana' ? anas : bobs })) as never)
}

function render(initial: { star: string | undefined; own?: string | undefined }) {
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(({ star: visited, own }) => useVisitedState(visited, own), {
    wrapper,
    initialProps: { own: 'bob', ...initial },
  })
}

describe('the System the URL visits', () => {
  it('is none on the Account’s own, its star named included', async () => {
    answering()
    const { result } = render({ star: 'bob' })
    await waitFor(() => {
      expect(Mapping.system).toHaveBeenCalled()
    })
    expect(result.current).toEqual({
      star: undefined,
      tree: undefined,
      system: undefined,
      titles: new Map(),
    })
    expect(Mapping.system).not.toHaveBeenCalledWith({ data: { system: 'bob' } })
  })

  it('is none before the Account’s own System is read, which tells whose star it names', () => {
    answering()
    const { result } = render({ star: 'ana', own: undefined })
    expect(result.current.star).toBeUndefined()
    expect(Mapping.system).not.toHaveBeenCalledWith({ data: { system: 'ana' } })
  })

  it('is someone else’s from their star, its Titles kept for the chat once the canvas went home', async () => {
    answering()
    const { result, rerender } = render({ star: 'ana' })
    await waitFor(() => {
      expect(result.current.tree).toMatchObject({ id: 'ana', branches: { 2: { id: 'garden' } } })
    })
    expect(result.current.star).toBe('ana')
    // Flat too, which the open Proposal over it is folded over.
    expect(result.current.system?.root.id).toBe('ana')
    rerender({ star: undefined, own: 'bob' })
    expect(result.current.star).toBeUndefined()
    expect(result.current.tree).toBeUndefined()
    expect(result.current.system).toBeUndefined()
    expect(result.current.titles.get('garden')).toBe('Garden')
  })
})
