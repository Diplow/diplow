// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import type { PlacedTile, System } from '#/domains/mapping/entities'
import { makeQueryClient } from '#/front/client/channels'
import {
  useCreateTile,
  useDeleteTile,
  useEditTile,
  useMoveTile,
  useSwapTiles,
  useSystem,
} from '#/front/client/mapping/queries'
import { toast } from '#/front/ui/feedback/Toaster'
import { m } from '#/paraglide/messages'

import {
  changeOf,
  viewOf,
  withChange,
  type SearchChange,
  type SystemSearch,
} from '../search/search'
import { useRefusalState } from './useRefusalState'

// What a refused write puts back in the URL, over stand-ins for the server functions: each kind of
// refusal its change, two in a row, and one arriving once the user has gone elsewhere on the page,
// which comes back on the URL of that moment. The URL is a plain value the route would hold. A
// refusal is what the client receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', () => ({
  system: vi.fn(),
  createTile: vi.fn(),
  editTile: vi.fn(),
  moveTile: vi.fn(),
  swapTiles: vi.fn(),
  deleteTile: vi.fn(),
}))
vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const id = {
  root: crypto.randomUUID(),
  a: crypto.randomUUID(),
  b: crypto.randomUUID(),
  notes: crypto.randomUUID(),
}

const placed = (tileId: string, title: string, slot: PlacedTile['slot']): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title,
  preview: `What ${title} is`,
  body: `# ${title}`,
  parent: id.root,
  slot,
})

/** The System as the server reads it: Branches `A` and `B` in Directions 1 and 2, a Leaf in 3. */
const served: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Me', preview: '', body: '' },
  tiles: {
    [id.a]: placed(id.a, 'A', 1),
    [id.b]: placed(id.b, 'B', 2),
    [id.notes]: placed(id.notes, 'Notes', { leaf: 3 }),
  },
  owned: true,
}

const titleMissing = {
  ok: false,
  failure: { _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] },
  requestId: 'req-1',
} as const

const directionTaken = {
  ok: false,
  failure: { _tag: 'DirectionTaken', kind: 'Conflict' },
  requestId: 'req-2',
} as const

/** A promise the case settles when it chooses, as a slow server would. */
function later() {
  let settle: (value: unknown) => void = () => undefined
  const promise = new Promise((resolve) => {
    settle = resolve
  })
  return { promise: promise as never, settle }
}

/** The page: the URL as the route holds it, each change applied to it as it stands then. */
function usePage() {
  const [url, setUrl] = useState<SystemSearch>({ center: id.root })
  const navigate = (change: SearchChange) => {
    setUrl((current) => (typeof change === 'function' ? change(current) : change))
  }
  return {
    url,
    navigate,
    reopened: useRefusalState(url, navigate),
    shown: useSystem().data?.system,
    create: useCreateTile(),
    edit: useEditTile(),
    move: useMoveTile(),
    swap: useSwapTiles(),
    remove: useDeleteTile(),
  }
}

/**
 * Renders the page's state hook beside the System's writes, under the app's QueryClient, once the
 * System is read, on a URL centered on the Root.
 */
async function rendered() {
  vi.mocked(Mapping.system).mockResolvedValue({ ok: true, value: served } as never)
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(usePage, { wrapper })
  await waitFor(() => {
    expect(result.current.shown).toBeDefined()
  })
  return {
    result,
    url: () => result.current.url,
    reopened: () => result.current.reopened,
    /** The user goes elsewhere on the page, as a click on the canvas would. */
    navigate: (change: SearchChange) => {
      act(() => {
        result.current.navigate(change)
      })
    },
    /** Sends a write, and ends the change under way at once, as the page does. */
    send: (write: () => void) => {
      act(() => {
        write()
        result.current.navigate((current) => withChange(current, { kind: 'none' }))
      })
    },
  }
}

describe('a refused create', () => {
  it('reopens its form in its slot, with what the user typed and why on its field', async () => {
    vi.mocked(Mapping.createTile).mockResolvedValue(titleMissing)
    const page = await rendered()
    const typed = { title: ' ', preview: 'What C is', body: '# C' }
    page.send(() => {
      page.result.current.create.mutate({
        id: crypto.randomUUID(),
        parent: id.a,
        slot: 4,
        ...typed,
      })
    })
    expect(changeOf(page.url())).toEqual({ kind: 'none' })
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'add', parent: id.a, slot: 4 })
    })
    expect(page.reopened()).toMatchObject({
      change: { kind: 'add', parent: id.a, slot: 4 },
      content: typed,
      shown: { fields: { title: m.error_mapping_title_missing() } },
    })
    expect(viewOf(page.url()).center).toBe(id.root)
  })
})

describe('a refused edit', () => {
  it('reopens its form, the fields it sent over what the Tile still says', async () => {
    vi.mocked(Mapping.editTile).mockResolvedValue(titleMissing)
    const page = await rendered()
    page.send(() => {
      page.result.current.edit.mutate({ id: id.b, title: ' ' })
    })
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'edit', id: id.b })
    })
    expect(page.reopened()).toMatchObject({
      change: { kind: 'edit', id: id.b },
      content: { title: ' ', preview: 'What B is', body: '# B' },
    })
  })
})

describe('a refused move or swap', () => {
  it('brings the move back, and shows why in a toast', async () => {
    vi.mocked(Mapping.moveTile).mockResolvedValue(directionTaken)
    const page = await rendered()
    page.send(() => {
      page.result.current.move.mutate({ id: id.a, parent: id.root, slot: 5 })
    })
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.a })
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_direction_taken())
    expect(page.reopened()).toBeUndefined()
  })

  it('brings back the move of the Tile a swap moved', async () => {
    vi.mocked(Mapping.swapTiles).mockResolvedValue(directionTaken as never)
    const page = await rendered()
    page.send(() => {
      page.result.current.swap.mutate({ a: id.b, b: id.a })
    })
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.b })
    })
  })

  it('brings back the move of a Leaf taken into a Context, which changes no kind', async () => {
    vi.mocked(Mapping.moveTile).mockResolvedValue(directionTaken)
    const page = await rendered()
    page.send(() => {
      page.result.current.move.mutate({ id: id.notes, parent: id.root, slot: -3 })
    })
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.notes })
    })
  })

  it('brings no move back for a swap whose moving Tile is gone', async () => {
    const page = await rendered()
    page.send(() => {
      page.result.current.swap.mutate({ a: crypto.randomUUID(), b: id.a })
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledOnce()
    })
    expect(changeOf(page.url())).toEqual({ kind: 'none' })
  })

  it('brings no move back for a Leaf grown into a Branch from its card', async () => {
    vi.mocked(Mapping.moveTile).mockResolvedValue(directionTaken)
    const page = await rendered()
    act(() => {
      page.result.current.move.mutate({ id: id.notes, parent: id.root, slot: 3 })
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledOnce()
    })
    expect(changeOf(page.url())).toEqual({ kind: 'none' })
  })
})

describe('a refused delete', () => {
  it('shows the Tile again where it stood, and leaves the URL where it is', async () => {
    const answer = later()
    vi.mocked(Mapping.deleteTile).mockReturnValue(answer.promise)
    const page = await rendered()
    page.navigate({ center: id.a })
    act(() => {
      page.result.current.remove.mutate({ id: id.b })
    })
    await waitFor(() => {
      expect(page.result.current.shown?.tiles[id.b]).toBeUndefined()
    })
    answer.settle({ ok: false, failure: { _tag: 'TileNotFound', kind: 'NotFound' } })
    await waitFor(() => {
      expect(page.result.current.shown?.tiles[id.b]).toMatchObject({ slot: 2 })
    })
    expect(page.url()).toEqual({ center: id.a })
  })
})

describe('refusals in turn', () => {
  it('puts back the first, and leaves the change it put back be when the second arrives', async () => {
    const first = later()
    const second = later()
    vi.mocked(Mapping.moveTile)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const page = await rendered()
    page.send(() => {
      page.result.current.move.mutate({ id: id.a, parent: id.root, slot: 5 })
    })
    page.send(() => {
      page.result.current.move.mutate({ id: id.b, parent: id.root, slot: 6 })
    })
    first.settle(directionTaken)
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.a })
    })
    second.settle(directionTaken)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(2)
    })
    expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.a })
  })

  it('keeps the form the first reopened when a move refused next would replace it', async () => {
    const created = later()
    const moved = later()
    vi.mocked(Mapping.createTile).mockReturnValue(created.promise)
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise)
    const page = await rendered()
    const typed = { title: 'C', preview: '', body: '' }
    page.send(() => {
      page.result.current.create.mutate({
        id: crypto.randomUUID(),
        parent: id.a,
        slot: 4,
        ...typed,
      })
    })
    page.send(() => {
      page.result.current.move.mutate({ id: id.b, parent: id.root, slot: 6 })
    })
    created.settle(directionTaken)
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'add', parent: id.a, slot: 4 })
    })
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(2)
    })
    expect(changeOf(page.url())).toEqual({ kind: 'add', parent: id.a, slot: 4 })
    expect(page.reopened()?.content).toEqual(typed)
  })

  it('reopens a form afresh for each refusal of the same slot', async () => {
    vi.mocked(Mapping.createTile).mockResolvedValue(titleMissing)
    const page = await rendered()
    const create = (title: string) => {
      page.send(() => {
        page.result.current.create.mutate({
          id: crypto.randomUUID(),
          parent: id.a,
          slot: 4,
          title,
          preview: '',
          body: '',
        })
      })
    }
    create(' ')
    await waitFor(() => {
      expect(page.reopened()?.content.title).toBe(' ')
    })
    const first = page.reopened()?.turn
    create('  ')
    await waitFor(() => {
      expect(page.reopened()?.content.title).toBe('  ')
    })
    expect(page.reopened()?.turn).not.toBe(first)
  })
})

describe('a refusal arriving once the user went elsewhere', () => {
  it('comes back on the URL of that moment, its view kept', async () => {
    const moved = later()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise)
    const page = await rendered()
    page.send(() => {
      page.result.current.move.mutate({ id: id.a, parent: id.root, slot: 5 })
    })
    page.navigate((current) => ({ ...current, center: id.b }))
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.a })
    })
    expect(viewOf(page.url()).center).toBe(id.b)
  })
})

describe('a form the user has open', () => {
  it('is left be by a refusal, which shows on no field but in a toast', async () => {
    const created = later()
    vi.mocked(Mapping.createTile).mockReturnValue(created.promise)
    const page = await rendered()
    page.send(() => {
      page.result.current.create.mutate({
        id: crypto.randomUUID(),
        parent: id.a,
        slot: 4,
        title: ' ',
        preview: '',
        body: '',
      })
    })
    page.navigate((current) => withChange(current, { kind: 'edit', id: id.b }))
    created.settle(titleMissing)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_title_missing())
    })
    expect(changeOf(page.url())).toEqual({ kind: 'edit', id: id.b })
    expect(page.reopened()).toBeUndefined()
  })
})

describe('a move the user has started', () => {
  it('is left be by a move refused meanwhile, which shows in its toast', async () => {
    const moved = later()
    vi.mocked(Mapping.moveTile).mockReturnValue(moved.promise)
    const page = await rendered()
    page.send(() => {
      page.result.current.move.mutate({ id: id.a, parent: id.root, slot: 5 })
    })
    page.navigate((current) => withChange(current, { kind: 'move', id: id.b }))
    moved.settle(directionTaken)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(m.error_mapping_direction_taken())
    })
    expect(changeOf(page.url())).toEqual({ kind: 'move', id: id.b })
  })
})

describe('a reopened form', () => {
  it('is let go once the URL leaves it, so its slot opens blank again', async () => {
    vi.mocked(Mapping.editTile).mockResolvedValue(titleMissing)
    const page = await rendered()
    page.send(() => {
      page.result.current.edit.mutate({ id: id.a, title: ' ' })
    })
    await waitFor(() => {
      expect(page.reopened()).toBeDefined()
    })
    page.navigate((current) => withChange(current, { kind: 'add', parent: id.b, slot: 3 }))
    expect(page.reopened()).toBeUndefined()
    page.navigate((current) => withChange(current, { kind: 'edit', id: id.a }))
    expect(page.reopened()).toBeUndefined()
  })

  it('stays while its own change is under way, the view changing beneath it', async () => {
    vi.mocked(Mapping.editTile).mockResolvedValue(titleMissing)
    const page = await rendered()
    page.send(() => {
      page.result.current.edit.mutate({ id: id.a, title: ' ' })
    })
    await waitFor(() => {
      expect(page.reopened()).toBeDefined()
    })
    page.navigate((current) => ({ ...current, center: id.a }))
    expect(page.reopened()).toMatchObject({ change: { kind: 'edit', id: id.a } })
  })
})
