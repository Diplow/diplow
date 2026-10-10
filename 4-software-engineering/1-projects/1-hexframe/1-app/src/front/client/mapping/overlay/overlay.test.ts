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
  useEditTileSubmit,
  useMoveTile,
  useSwapTiles,
  useSystem,
  useSystemRefusals,
  useSystemWriting,
} from '../queries'
import { operationOf, overlaid, refusalOf } from './overlay'

// The System the page shows while writes are on their way, over stand-ins for the server functions:
// each write shows before its answer, a refused one stops showing without a rollback, a refetch slips
// in under what is pending, nothing flickers once a write lands, a write a read already holds is not
// folded again, its Tiles' Versions moved on, and a refusal Mapping's `decide` foresees is sent
// nowhere. A refusal is what the client receives, its wire form, decoded.
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

/** A Branch of the Root, at its first Version unless it was changed since. */
const branch = (
  tileId: string,
  title: string,
  slot: PlacedTile['slot'],
  version = 1,
): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title,
  preview: '',
  body: '',
  version,
  parent: id.root,
  slot,
})

/** The System as the server reads it: the Root, `A` in Direction 1 and `B` in Direction 2. */
const served: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Me', preview: '', body: '', version: 1 },
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
const tileChanged = {
  ok: false,
  failure: { _tag: 'TileChanged', kind: 'Conflict' },
  requestId: 'req-2',
} as const

/**
 * Renders `hook` beside the System as the page shows it, under the app's QueryClient, once the first
 * read has landed; and every System shown, render after render.
 */
async function rendered<T>(hook: () => T, system: System = served) {
  serving(system)
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
      result.current.hook.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ parent: id.root, slot: 4 })
    })
    expect(result.current.writing).toBe(true)
    serving(servedWith(branch(id.a, 'A', 4, 2)))
    moved.settle(ok)
    await waitFor(() => {
      expect(result.current.writing).toBe(false)
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
  })

  it('shows the same System while nothing changes, a write pending', async () => {
    vi.mocked(Mapping.moveTile).mockReturnValue(later<never>().promise)
    const { result } = await rendered(useMoveTile)
    act(() => {
      result.current.hook.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
    })
    const shown = result.current.shown
    await act(() => new Promise((settled) => setTimeout(settled, 50)))
    expect(result.current.shown).toBe(shown)
  })

  it('stops showing a refused write, and still shows the write queued behind it', async () => {
    const moved = later<unknown>()
    const edited = later<unknown>()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise as never)
    vi.mocked(Mapping.editTile).mockReturnValue(edited.promise as never)
    const { result } = await rendered(() => ({ move: useMoveTile(), edit: useEditTile() }))
    act(() => {
      result.current.hook.move.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
      result.current.hook.edit.mutate({ id: id.b, version: 1, title: 'B, renamed' })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
    })
    expect(result.current.shown?.tiles[id.b]).toMatchObject({ title: 'B, renamed' })
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(Mapping.editTile).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 1 })
    })
    expect(result.current.shown?.tiles[id.b]).toMatchObject({ title: 'B, renamed' })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_direction_taken())
  })

  it('lets a read carrying someone else’s change slip in under a pending write', async () => {
    vi.mocked(Mapping.editTile).mockReturnValue(later<never>().promise)
    const { result, client } = await rendered(useEditTile)
    act(() => {
      result.current.hook.mutate({ id: id.b, version: 1, title: 'B, renamed' })
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
      result.current.hook.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(Mapping.system).toHaveBeenCalled()
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4 })
    readAgain.settle({ ok: true, value: servedWith(branch(id.a, 'A', 4, 2)) })
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
      result.current.hook.mutate({ a: id.a, aVersion: 1, b: id.b, bVersion: 1 })
    })
    await waitFor(() => {
      expect(Mapping.swapTiles).toHaveBeenCalled()
    })
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 2 })
    serving(servedWith(branch(id.a, 'A', 2, 2), branch(id.b, 'B', 1, 2)))
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

describe('a write on a Tile changed since the screen drew it', () => {
  it('refuses a write queued on a Tile a refused write before it had changed, as the screen drew it', async () => {
    const moved = later<unknown>()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise as never)
    const { result } = await rendered(() => ({ move: useMoveTile(), edit: useEditTile() }))
    act(() => {
      result.current.hook.move.mutate({ id: id.a, version: 1, parent: id.root, slot: 4 })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 4, version: 2 })
    })
    // The rename names A as the screen drew it, moved: a Version the server never gave A.
    act(() => {
      result.current.hook.edit.mutate({ id: id.a, version: 2, title: 'A, renamed' })
    })
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(m.error_mapping_tile_changed())
    })
    expect(Mapping.editTile).not.toHaveBeenCalled()
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ slot: 1, title: 'A' })
  })

  it('refuses a pending edit onto its channel once the server’s System changed its Tile under it', async () => {
    const moved = later<unknown>()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise as never)
    const { result } = await rendered(() => ({ move: useMoveTile(), edit: useEditTile() }))
    act(() => {
      result.current.hook.move.mutate({ id: id.b, version: 1, parent: id.root, slot: 4 })
      result.current.hook.edit.mutate({ id: id.a, version: 1, title: 'A, mine' })
    })
    await waitFor(() => {
      expect(result.current.shown?.tiles[id.a]).toMatchObject({ title: 'A, mine' })
    })
    // Meanwhile the Assistant renamed A: the read after the move holds its change, at A's next Version.
    serving(servedWith(branch(id.a, 'A, the Assistant’s', 1, 2), branch(id.b, 'B', 4, 2)))
    moved.settle(ok)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_tile_changed())
    })
    expect(Mapping.editTile).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(result.current.shown?.tiles[id.a]).toMatchObject({ title: 'A, the Assistant’s' })
  })

  it('takes the server’s refusal onto the same channel, when the change lands after the read', async () => {
    vi.mocked(Mapping.editTile).mockResolvedValue(tileChanged)
    const { result } = await rendered(useEditTile)
    act(() => {
      result.current.hook.mutate({ id: id.a, version: 1, title: 'A, mine' })
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_tile_changed())
    })
    expect(Mapping.editTile).toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('hands an edit back, sent nowhere, when its form opened on a Version the Tile no longer has', async () => {
    const refused: Refused[] = []
    // Another tab saved A meanwhile: the System this page reads holds it at its next Version.
    const { result } = await rendered(
      () => {
        useSystemRefusals((refusal) => {
          refused.push(refusal)
          return true
        })
        return useEditTileSubmit({ id: id.a, version: 1, title: 'A', preview: '', body: '' })
      },
      servedWith(branch(id.a, 'A, from the other tab', 1, 2)),
    )
    act(() => {
      result.current.hook({ title: 'A, mine', preview: '', body: '' })
    })
    await waitFor(() => {
      expect(refused).toMatchObject([
        {
          operation: { _tag: 'EditTile', id: id.a, version: 1, title: 'A, mine' },
          shown: { form: m.error_mapping_tile_changed() },
        },
      ])
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_tile_changed())
    expect(Mapping.editTile).not.toHaveBeenCalled()
  })
})

describe('a refusal foreseen', () => {
  it('sends a move to a taken Direction nowhere, and shows it in a toast, unreported', async () => {
    const { result } = await rendered(useMoveTile)
    act(() => {
      result.current.hook.mutate({ id: id.a, version: 1, parent: id.root, slot: 2 })
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
    const move = (slot: 2 | 4, version = 1) =>
      operationOf('moveTile', { id: id.a, version, parent: id.root, slot })
    const taken = move(2)
    const free = move(4)
    const stale = move(4, 2)
    if (taken === undefined || free === undefined || stale === undefined) {
      throw new Error('A move read as no Operation')
    }
    expect(refusalOf(served, taken)).toMatchObject({ _tag: 'DirectionTaken' })
    expect(refusalOf(served, stale)).toMatchObject({ _tag: 'TileChanged' })
    expect(refusalOf(served, free)).toBeUndefined()
  })

  it('folds pending writes in their turn, whatever order they are listed in', () => {
    const shown = overlaid(served, [
      {
        turn: 2,
        operation: operationOf('moveTile', { id: id.b, version: 1, parent: id.root, slot: 1 }),
      },
      {
        turn: 1,
        operation: operationOf('moveTile', { id: id.a, version: 1, parent: id.root, slot: 4 }),
      },
    ])
    expect(shown.tiles[id.a]).toMatchObject({ slot: 4 })
    expect(shown.tiles[id.b]).toMatchObject({ slot: 1 })
  })

  it('folds a swap the System does not hold yet, and leaves alone one it already holds', () => {
    // Read once the server swapped them, each Tile at its next Version.
    const swappedBack = servedWith(branch(id.a, 'A', 2, 2), branch(id.b, 'B', 1, 2))
    const swap = (version: number) =>
      operationOf('swapTiles', { a: id.a, aVersion: version, b: id.b, bVersion: version })
    // The second swaps them back, made on the screen that showed the first.
    const pending = [
      { turn: 1, operation: swap(1) },
      { turn: 2, operation: swap(2) },
    ]
    expect(overlaid(served, pending.slice(0, 1)).tiles[id.a]).toMatchObject({ slot: 2 })
    expect(overlaid(swappedBack, pending.slice(0, 1)).tiles[id.a]).toMatchObject({ slot: 2 })
    expect(overlaid(served, pending).tiles[id.a]).toMatchObject({ slot: 1 })
    expect(overlaid(swappedBack, pending).tiles[id.a]).toMatchObject({ slot: 1 })
  })

  it('leaves alone a swap that moved a Leaf, once the System holds it', () => {
    const before = servedWith(branch(id.c, 'C', { leaf: 3 }))
    const after = servedWith(branch(id.c, 'C', 2, 2), branch(id.b, 'B', { leaf: 3 }, 2))
    const fields = { a: id.c, aVersion: 1, b: id.b, bVersion: 1 }
    const swap = { turn: 1, operation: operationOf('swapTiles', fields) }
    expect(overlaid(before, [swap]).tiles[id.c]).toMatchObject({ slot: 2 })
    expect(overlaid(after, [swap]).tiles[id.c]).toMatchObject({ slot: 2 })
    expect(overlaid(after, [swap]).tiles[id.b]).toMatchObject({ slot: { leaf: 3 } })
  })

  it('reads no Operation from an import, nor from fields Mapping’s schema refuses', () => {
    expect(operationOf('importTiles', { place: { _tag: 'Root' } })).toBeUndefined()
    expect(
      operationOf('moveTile', { id: 'not-an-id', version: 1, parent: id.root, slot: 4 }),
    ).toBeUndefined()
    expect(operationOf('moveTile', { id: id.a, parent: id.root, slot: 4 })).toBeUndefined()
    expect(
      operationOf('moveTile', { id: id.a, version: 1, parent: id.root, slot: 4 }),
    ).toMatchObject({
      _tag: 'MoveTile',
      id: id.a,
    })
  })
})
