// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import { reportError } from '#/api/report/observability/client'
import type { PlacedTile, System } from '#/domains/mapping/entities'
import { toast } from '#/front/ui/feedback/Toaster'
import { m } from '#/paraglide/messages'

import { makeQueryClient } from '../../channels'
import {
  type Refused,
  useCreateTileSubmit,
  useEditTile,
  useMoveTile,
  useSwapTiles,
  useSystem,
  useSystemRefusals,
  useSystemWriting,
} from '../queries'
import { operationOf, overlaid, refusalOf } from './overlay'

// The System the page shows while writes are on their way, over stand-ins for the server functions:
// each write shows before its answer, a refused one stops showing without a rollback, a refetch slips
// in under what is pending, nothing flickers once a write lands, and a refusal Mapping's `decide`
// foresees is sent nowhere. A refusal is what the client receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', () => ({
  system: vi.fn(),
  createTile: vi.fn(),
  editTile: vi.fn(),
  moveTile: vi.fn(),
  swapTiles: vi.fn(),
}))
vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))
vi.mock('#/api/report/observability/client', async (original) => ({
  ...(await original<object>()),
  reportError: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const id = {
  root: crypto.randomUUID(),
  a: crypto.randomUUID(),
  b: crypto.randomUUID(),
  c: crypto.randomUUID(),
}

const branch = (tileId: string, title: string, slot: PlacedTile['slot']): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title,
  preview: '',
  body: '',
  parent: id.root,
  slot,
})

/** The System as the server reads it: the Root, `A` in Direction 1 and `B` in Direction 2. */
const served: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Me', preview: '', body: '' },
  tiles: { [id.a]: branch(id.a, 'A', 1), [id.b]: branch(id.b, 'B', 2) },
  owned: true,
}

/** The System with these Tiles placed over the served one's. */
const servedWith = (...tiles: ReadonlyArray<PlacedTile>): System => ({
  ...served,
  tiles: { ...served.tiles, ...Object.fromEntries(tiles.map((tile) => [tile.id, tile])) },
})

/** The System's stand-in answers `system` from now on. */
function serving(system: System) {
  vi.mocked(Mapping.system).mockImplementation(() => Promise.resolve({ ok: true, value: system }))
}

/** A promise the case settles when it chooses, as a slow server would. */
function later<T>() {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const ok = { ok: true, value: undefined } as const
const directionTaken = {
  ok: false,
  failure: { _tag: 'DirectionTaken', kind: 'Conflict' },
  requestId: 'req-1',
} as const

/**
 * Renders `hook` beside the System as the page shows it, under the app's QueryClient, once the first
 * read has landed; and every System shown, render after render.
 */
async function rendered<T>(hook: () => T) {
  serving(served)
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const shownEach: Array<System | undefined> = []
  const { result } = renderHook(
    () => {
      const shown = useSystem().data?.system
      shownEach.push(shown)
      return { shown, writing: useSystemWriting(), hook: hook() }
    },
    { wrapper },
  )
  await waitFor(() => {
    expect(result.current.shown).toBeDefined()
  })
  return { result, client, shownEach }
}

describe('the System the page shows', () => {
  it('shows a write before its answer, and the server’s System once it lands', async () => {
    const moved = later<unknown>()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise as never)
    const { result } = await rendered(useMoveTile)
    act(() => {
      result.current.hook.mutate({ id: id.a, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ parent: id.root, slot: 4 })
    })
    expect(result.current.writing).toBe(true)
    serving(servedWith(branch(id.a, 'A', 4)))
    moved.settle(ok)
    await waitFor(() => {
      expect(result.current.writing).toBe(false)
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
  })

  it('stops showing a refused write, and still shows the write queued behind it', async () => {
    const moved = later<unknown>()
    const edited = later<unknown>()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise as never)
    vi.mocked(Mapping.editTile).mockReturnValue(edited.promise as never)
    const { result } = await rendered(() => ({ move: useMoveTile(), edit: useEditTile() }))
    act(() => {
      result.current.hook.move.mutate({ id: id.a, parent: id.root, slot: 4 })
      result.current.hook.edit.mutate({ id: id.a, title: 'A, renamed' })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4, title: 'A, renamed' })
    })
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(Mapping.editTile).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 1, title: 'A, renamed' })
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_direction_taken())
  })

  it('lets a read carrying someone else’s change slip in under a pending write', async () => {
    vi.mocked(Mapping.editTile).mockReturnValue(later<never>().promise)
    const { result, client } = await rendered(useEditTile)
    act(() => {
      result.current.hook.mutate({ id: id.b, title: 'B, renamed' })
    })
    serving(servedWith(branch(id.c, 'C, from the Assistant', 3)))
    await act(() => client.invalidateQueries({ queryKey: ['system'] }))
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.c]).toMatchObject({ title: 'C, from the Assistant' })
    })
    expect(result.current.shown?.tiles[id.b]).toMatchObject({ title: 'B, renamed' })
  })

  it('never flickers back between a write’s answer and the System read again', async () => {
    vi.mocked(Mapping.moveTile).mockResolvedValue(ok)
    const { result, shownEach } = await rendered(useMoveTile)
    const readAgain = later<unknown>()
    vi.mocked(Mapping.system).mockReturnValue(readAgain.promise as never)
    act(() => {
      result.current.hook.mutate({ id: id.a, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(Mapping.system).toHaveBeenCalled()
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
    readAgain.settle({ ok: true, value: servedWith(branch(id.a, 'A', 4)) })
    await waitFor(() => {
      expect(result.current.writing).toBe(false)
    })
    const first = shownEach.findIndex((shown) => shown?.tiles[id.a]?.slot === 4)
    expect(first).toBeGreaterThan(0)
    expect(shownEach.slice(first).map((shown) => shown?.tiles[id.a]?.slot)).not.toContain(1)
  })

  it('never swaps two Tiles back when a read lands holding their swap before its answer does', async () => {
    const swapped = later<unknown>()
    vi.mocked(Mapping.swapTiles).mockReturnValue(swapped.promise as never)
    const { result, client, shownEach } = await rendered(useSwapTiles)
    act(() => {
      result.current.hook.mutate({ a: id.a, b: id.b })
    })
    await waitFor(() => {
      expect(Mapping.swapTiles).toHaveBeenCalled()
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 2 })
    serving(servedWith(branch(id.a, 'A', 2), branch(id.b, 'B', 1)))
    await act(() => client.refetchQueries({ queryKey: ['system'] }))
    await waitFor(() => {
      expect(client.getQueryData<System>(['system', 'read'])?.tiles[id.a]).toMatchObject({
        slot: 2,
      })
    })
    expect(result.current.writing).toBe(true)
    const first = shownEach.findIndex((shown) => shown?.tiles[id.a]?.slot === 2)
    expect(shownEach.slice(first).map((shown) => shown?.tiles[id.a]?.slot)).not.toContain(1)
    expect(result.current.shown?.tiles[id.b]).toMatchObject({ slot: 1 })
  })
})

describe('a refusal foreseen', () => {
  it('sends a move to a taken Direction nowhere, and shows it in a toast, unreported', async () => {
    const { result } = await rendered(useMoveTile)
    act(() => {
      result.current.hook.mutate({ id: id.a, parent: id.root, slot: 2 })
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_direction_taken())
    })
    expect(Mapping.moveTile).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 1 })
  })

  it('sends an untitled Tile nowhere, and hands its form why, on its field, once the System read again has landed', async () => {
    const refused: Refused[] = []
    const { result } = await rendered(() => {
      useSystemRefusals((refusal) => {
        refused.push(refusal)
        return true
      })
      return useCreateTileSubmit({ parent: id.root, slot: 3 })
    })
    // Read again, the System comes back retitled, so the refusal says which read it was handed after.
    const readAgain = { ...served, root: { ...served.root, title: 'Read again' } }
    serving(readAgain)
    act(() => {
      result.current.hook({ title: '', preview: '', body: '' })
    })
    await waitFor(() => {
      expect(refused).toMatchObject([
        {
          operation: { _tag: 'CreateTile', parent: id.root, slot: 3, title: '' },
          shown: { fields: { title: 'Give this tile a title.' } },
          system: readAgain,
        },
      ])
    })
    expect(Mapping.system).toHaveBeenCalledTimes(2)
    expect(Mapping.createTile).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('the overlay', () => {
  it('folds a new Tile under the id its client chose', async () => {
    vi.mocked(Mapping.createTile).mockReturnValue(later<never>().promise)
    const { result } = await rendered(() => useCreateTileSubmit({ parent: id.root, slot: 3 }))
    act(() => {
      result.current.hook({ title: 'C', preview: '', body: '' })
    })
    await waitFor(() => {
      expect(Mapping.createTile).toHaveBeenCalled()
    })
    const [[{ data }]] = vi.mocked(Mapping.createTile).mock.calls as unknown as [
      [{ data: { id: string } }],
    ]
    expect(result.current.shown?.tiles[data.id]).toMatchObject({ title: 'C', slot: 3 })
  })

  it('foresees the refusal Mapping answers, and none for a write it lets through', () => {
    const move = (slot: 2 | 4) => operationOf('moveTile', { id: id.a, parent: id.root, slot })
    const taken = move(2)
    const free = move(4)
    if (taken === undefined || free === undefined) throw new Error('A move read as no Operation')
    expect(refusalOf(served, taken)).toMatchObject({ _tag: 'DirectionTaken' })
    expect(refusalOf(served, free)).toBeUndefined()
  })

  it('folds pending writes in their turn, whatever order they are listed in', () => {
    const shown = overlaid(served, [
      { turn: 2, operation: operationOf('moveTile', { id: id.b, parent: id.root, slot: 1 }) },
      { turn: 1, operation: operationOf('moveTile', { id: id.a, parent: id.root, slot: 4 }) },
    ])
    expect(shown.tiles[id.a]).toMatchObject({ slot: 4 })
    expect(shown.tiles[id.b]).toMatchObject({ slot: 1 })
  })

  it('folds a swap the System does not hold yet, and leaves alone one it already holds', () => {
    const swappedBack = servedWith(branch(id.a, 'A', 2), branch(id.b, 'B', 1))
    const swap = { operation: operationOf('swapTiles', { a: id.a, b: id.b }) }
    const pending = [
      { turn: 1, ...swap, before: served },
      { turn: 2, ...swap, before: swappedBack },
    ]
    expect(overlaid(served, pending.slice(0, 1)).tiles[id.a]).toMatchObject({ slot: 2 })
    expect(overlaid(swappedBack, pending.slice(0, 1)).tiles[id.a]).toMatchObject({ slot: 2 })
    expect(overlaid(served, pending).tiles[id.a]).toMatchObject({ slot: 1 })
    expect(overlaid(swappedBack, pending).tiles[id.a]).toMatchObject({ slot: 1 })
  })

  it('leaves alone a swap that moved a Leaf, once the System holds it', () => {
    const before = servedWith(branch(id.c, 'C', { leaf: 3 }))
    const after = servedWith(branch(id.c, 'C', 2), branch(id.b, 'B', { leaf: 3 }))
    const swap = { turn: 1, operation: operationOf('swapTiles', { a: id.c, b: id.b }), before }
    expect(overlaid(before, [swap]).tiles[id.c]).toMatchObject({ slot: 2 })
    expect(overlaid(after, [swap]).tiles[id.c]).toMatchObject({ slot: 2 })
    expect(overlaid(after, [swap]).tiles[id.b]).toMatchObject({ slot: { leaf: 3 } })
  })

  it('reads no Operation from an import, nor from fields Mapping’s schema refuses', () => {
    expect(operationOf('importTiles', { place: { _tag: 'Root' } })).toBeUndefined()
    expect(operationOf('moveTile', { id: 'not-an-id', parent: id.root, slot: 4 })).toBeUndefined()
    expect(operationOf('moveTile', { id: id.a, parent: id.root, slot: 4 })).toMatchObject({
      _tag: 'MoveTile',
      id: id.a,
    })
  })
})
