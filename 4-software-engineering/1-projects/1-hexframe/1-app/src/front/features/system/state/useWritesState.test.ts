// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import type { System } from '#/domains/mapping/entities'
import { makeQueryClient } from '#/front/client/channels'
import type { Underway } from '#/front/client/mapping/overlay/overlay'
import { useMoveTile, useSystem } from '#/front/client/mapping/queries'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { useWritesState } from './useWritesState'

// What the canvas marks of the writes, over a stand-in for the server function: a Tile saving while
// its write is on its way, a free slot an import lands in, and a Tile flaring once its write is
// refused, for as long as `--duration-flare`, nothing put back here. A refusal is what the client
// receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn(), moveTile: vi.fn() }))
vi.mock('#/front/ui/atoms/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  document.documentElement.style.removeProperty('--duration-flare')
})

const id = { root: crypto.randomUUID(), a: crypto.randomUUID(), b: crypto.randomUUID() }

const served: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Me', preview: '', body: '', version: 1 },
  tiles: {
    [id.a]: {
      _tag: 'Tile',
      id: id.a,
      title: 'A',
      preview: '',
      body: '',
      version: 1,
      parent: id.root,
      slot: 1,
    },
  },
  version: 0,
}

const nothing: Underway = { tiles: new Set(), slots: [] }

const parent: TileNode = { id: id.b, title: 'B', preview: '' }

function render(underway: Underway = nothing) {
  vi.mocked(Mapping.system).mockResolvedValue({
    ok: true,
    value: { ...served, rights: {}, gaps: {}, pinned: {}, asOwner: true },
  })
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(
    () => ({ writes: useWritesState(underway), move: useMoveTile(), shown: useSystem().data }),
    { wrapper },
  )
}

describe('useWritesState', () => {
  it('marks a Tile saving while a write on its way changes it, and leaves the others alone', () => {
    const { result } = render({ tiles: new Set([id.a]), slots: [] })
    expect(result.current.writes.tile(id.a)).toBe('pending')
    expect(result.current.writes.tile(id.b)).toBeUndefined()
  })

  it('marks the free slot an import lands in, read as the ring it stands in', () => {
    const { result } = render({ tiles: new Set(), slots: [{ parent: id.b, slot: { leaf: 3 } }] })
    const { landing } = result.current.writes
    expect(landing({ parent, ring: 'children', direction: 3 })).toBe(true)
    expect(landing({ parent, ring: 'branches', direction: 3 })).toBe(false)
    expect(landing({ parent, ring: 'children', direction: 4 })).toBe(false)
  })

  it('flares a refused Tile for as long as the flare lasts, then lets it be', async () => {
    document.documentElement.style.setProperty('--duration-flare', '60ms')
    vi.mocked(Mapping.moveTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    })
    const { result } = render()
    await waitFor(() => {
      expect(result.current.shown).toBeDefined()
    })
    act(() => {
      result.current.move.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(result.current.writes.tile(id.a)).toBe('refused')
    })
    await waitFor(() => {
      expect(result.current.writes.tile(id.a)).toBeUndefined()
    })
  })
})
