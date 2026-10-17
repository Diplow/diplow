// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import { makeQueryClient } from '#/front/client/channels'
import {
  type PlacedReference,
  type PlacedTile,
  type Slot,
  type System,
  systemOf,
} from '#/domains/mapping/entities'
import { m } from '#/paraglide/messages'
import { toast } from '#/front/ui/atoms/Toaster'
import { layoutCanvas } from '#/front/ui/canvas/geometry/shape'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { TileAct } from '#/front/ui/canvas/tile/menu/verbs'
import { showView, type CanvasView } from '#/front/ui/canvas/view/view'
import { firstKindOf } from '#/front/ui/canvas/view/tiles'

import type { Reach } from '../acting'
import type { SearchChange, SystemSearch } from '../search/search'
import { canvasTree } from '../tree'
import { useActingState } from './useActingState'

// What a Tile's menu and a free slot's do on home, over stand-ins for the server functions: what
// each line sends, a turn into the other kind one at a time and refused in a toast, a delete asked
// first, the lines that open a form, an import or the move in the URL, a copy, an export; and a move
// under way, its free slots and its swaps. A refusal is what the client receives, its wire form,
// decoded.
vi.mock('#/api/mapping/mapping', () => ({
  moveTile: vi.fn(),
  swapTiles: vi.fn(),
  deleteTile: vi.fn(),
  deleteReference: vi.fn(),
  system: vi.fn(),
}))
vi.mock('#/front/ui/atoms/Toaster', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const placed = (id: string, parent: string, slot: Slot, more: Partial<PlacedTile> = {}) =>
  ({
    _tag: 'Tile',
    id,
    title: id,
    preview: `What ${id} is`,
    body: `# ${id}`,
    version: 1,
    parent,
    slot,
    ...more,
  }) as PlacedTile

/**
 * The Root holds Holding in 1, which holds a Leaf, and a Leaf, Notes, in 1; Bare, a Branch with
 * nothing below it, in 2; a file's Leaf in 4; a Reference to Bare in its Context, in -3.
 */
const flat: System = {
  root: { _tag: 'Tile', id: 'root', title: 'Me', preview: '', body: '', version: 4 },
  tiles: {
    holding: placed('holding', 'root', 1),
    inner: placed('inner', 'holding', { leaf: 1 }),
    notes: placed('notes', 'root', { leaf: 1 }),
    bare: placed('bare', 'root', 2),
    'run.yaml': placed(
      'run.yaml',
      'root',
      { leaf: 4 },
      {
        name: 'run.yaml',
        preview: '',
      },
    ),
    toBare: { _tag: 'Reference', id: 'toBare', parent: 'root', slot: -3, target: 'bare' },
  } satisfies Record<string, PlacedTile | PlacedReference>,
  owned: true,
  version: 0,
}

const root = systemOf(flat)
const tree = canvasTree(root, { yours: true })

/** A view with the center opened into its first ring, unless it says otherwise, as a click leaves it. */
const opened = (view: CanvasView): CanvasView => ({
  frame: firstKindOf(showView(tree, view).center),
  ...view,
})

/** The System read again after a write, flat as the server answers it: its content plays no part. */
function answering(
  write: 'moveTile' | 'swapTiles' | 'deleteTile' | 'deleteReference',
  outcome: unknown,
) {
  vi.mocked(Mapping[write]).mockResolvedValue(outcome as never)
  vi.mocked(Mapping.system).mockResolvedValue({
    ok: true,
    value: { root: flat.root, tiles: {}, version: 0, owned: true },
  } as never)
}

const done = { ok: true, value: undefined }

function render(
  search: SystemSearch = {},
  { exporting = false, reach = 'owned' }: { exporting?: boolean; reach?: Reach } = {},
) {
  const client = makeQueryClient()
  const onSearchChange = vi.fn<(change: SearchChange) => void>()
  const start = vi.fn()
  const onAsk = vi.fn<(tile: string, place?: number) => void>()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(
    () =>
      useActingState({
        systems: { root, flat, tree, reach },
        search,
        onSearchChange,
        exporting: { start, pending: exporting },
        onAsk,
      }),
    { wrapper },
  )
  return { result, onSearchChange, start, onAsk }
}

/** The hex a view draws under this key. */
function hex(key: string, view: CanvasView = {}): TileHex {
  const found = layoutCanvas(showView(tree, opened(view))).find(
    (drawn): drawn is TileHex => drawn.kind === 'tile' && drawn.key === key,
  )
  if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
  return found
}

/** Chooses a line of the menu on the Tile drawn under `key`. */
function choose(
  result: ReturnType<typeof render>['result'],
  key: string,
  line: TileAct,
  view?: CanvasView,
) {
  act(() => {
    result.current.acting.tile(hex(key, view))?.onAct(line, '')
  })
}

/** The search params a change made of the page's. */
const changed = (onSearchChange: ReturnType<typeof render>['onSearchChange'], search = {}) => {
  const next = onSearchChange.mock.lastCall?.[0]
  return typeof next === 'function' ? next(search) : next
}

describe('turning a Tile into the other kind', () => {
  it('moves a Leaf to the Branch slot of its own Direction', async () => {
    answering('moveTile', done)
    const { result } = render()
    choose(result, 'tile:run.yaml', { verb: 'make-branch' })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'run.yaml', version: 1, parent: 'root', slot: 4 },
      })
    })
  })

  it('grows a Leaf into a Branch before a new Tile goes under it, the new one a Leaf', async () => {
    answering('moveTile', done)
    const { result, onSearchChange } = render()
    choose(result, 'tile:run.yaml', { verb: 'add', at: 2 })
    expect(changed(onSearchChange)).toMatchObject({ add: 'run.yaml', slot: { leaf: 2 } })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'run.yaml', version: 1, parent: 'root', slot: 4 },
      })
    })
  })

  it('moves a bare Branch to the Leaf slot of its own Direction', async () => {
    answering('moveTile', done)
    const { result } = render()
    choose(result, 'tile:bare', { verb: 'make-leaf' })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'bare', version: 1, parent: 'root', slot: { leaf: 2 } },
      })
    })
  })

  it('sends nothing more while one is on its way', async () => {
    const settles: ((outcome: unknown) => void)[] = []
    vi.mocked(Mapping.moveTile).mockReturnValue(
      new Promise((resolve) => settles.push(resolve)) as never,
    )
    const { result } = render()
    choose(result, 'tile:run.yaml', { verb: 'make-branch' })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledOnce()
    })
    choose(result, 'tile:run.yaml', { verb: 'make-branch' })
    settles[0]?.(done)
    expect(Mapping.moveTile).toHaveBeenCalledOnce()
  })

  it('shows a taken Direction in a toast', async () => {
    answering('moveTile', {
      ok: false,
      failure: { _tag: 'DirectionTaken', kind: 'Conflict' },
      requestId: 'req-1',
    })
    const { result } = render()
    choose(result, 'tile:run.yaml', { verb: 'make-branch' })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(m.error_mapping_direction_taken())
    })
  })
})

describe('a line that writes', () => {
  it('moves a Tile to a free place of its ring, the view and the URL left as they are', async () => {
    answering('moveTile', done)
    const { result, onSearchChange } = render()
    choose(result, 'tile:holding', { verb: 'move', at: 5 })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'holding', version: 1, parent: 'root', slot: 5 },
      })
    })
    expect(onSearchChange).not.toHaveBeenCalled()
  })

  it('swaps a Tile with the Branch seated where it trades', async () => {
    answering('swapTiles', done)
    const { result } = render()
    choose(result, 'tile:holding', { verb: 'swap', at: 2 })
    await waitFor(() => {
      expect(Mapping.swapTiles).toHaveBeenCalledWith({
        data: { a: 'holding', aVersion: 1, b: 'bare', bVersion: 1 },
      })
    })
  })

  it('removes a Reference from its slot, the Tile it points at kept', async () => {
    answering('deleteReference', done)
    const { result } = render()
    choose(result, 'tile:root:context:3', { verb: 'remove-reference' }, { inner: 'context' })
    await waitFor(() => {
      expect(Mapping.deleteReference).toHaveBeenCalledWith({
        data: { parent: 'root', parentVersion: 4, slot: -3 },
      })
    })
    expect(Mapping.deleteTile).not.toHaveBeenCalled()
  })

  it('asks before a delete, counting what goes with it, and sends it once confirmed', async () => {
    answering('deleteTile', done)
    const { result, onSearchChange } = render({ move: 'inner' })
    choose(result, 'tile:holding', { verb: 'delete' })
    expect(result.current.deleting).toMatchObject({ title: 'holding', below: 1 })
    expect(Mapping.deleteTile).not.toHaveBeenCalled()
    act(() => {
      result.current.deleting?.confirm()
    })
    await waitFor(() => {
      expect(Mapping.deleteTile).toHaveBeenCalledWith({ data: { id: 'holding', version: 1 } })
    })
    expect(result.current.deleting).toBeUndefined()
    // As the widget's delete: the Tile it stood under centered, the move of a Tile that went ends.
    expect(changed(onSearchChange, { center: 'holding', move: 'inner' })).toMatchObject({
      center: undefined,
      move: undefined,
    })
  })

  it('sends no delete called off', () => {
    const { result } = render()
    choose(result, 'tile:holding', { verb: 'delete' })
    act(() => {
      result.current.deleting?.cancel()
    })
    expect(result.current.deleting).toBeUndefined()
    expect(Mapping.deleteTile).not.toHaveBeenCalled()
  })
})

describe('a line that opens something', () => {
  it('opens the edit, the new Tile at a place, the move and an import in the URL', () => {
    const { result, onSearchChange } = render()
    choose(result, 'tile:holding', { verb: 'edit' })
    expect(changed(onSearchChange)).toMatchObject({ edit: 'holding' })
    choose(result, 'tile:holding', { verb: 'add', at: 3 })
    expect(changed(onSearchChange)).toMatchObject({ add: 'holding', slot: { leaf: 3 } })
    choose(result, 'tile:holding', { verb: 'move-elsewhere' })
    expect(changed(onSearchChange)).toMatchObject({ move: 'holding' })
    choose(result, 'tile:root', { verb: 'import' })
    expect(changed(onSearchChange)).toMatchObject({ import: 'root' })
  })

  it('exports a Tile and what is below it, which the chat shows', () => {
    const { result, start } = render()
    choose(result, 'tile:holding', { verb: 'export' })
    expect(start).toHaveBeenCalledWith({ tile: { id: 'holding', title: 'holding' }, below: 1 })
  })

  it('exports nothing more while an export is on its way', () => {
    const { result, start } = render({}, { exporting: true })
    choose(result, 'tile:holding', { verb: 'export' })
    expect(start).not.toHaveBeenCalled()
  })

  it("copies a Tile's title, saying so", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { result } = render()
    choose(result, 'tile:holding', { verb: 'copy-title' })
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(m.system_copied())
    })
    expect(writeText).toHaveBeenCalledWith('holding')
    vi.unstubAllGlobals()
  })
})

describe("a free slot's menu", () => {
  const slotOf = (view: CanvasView = {}) => {
    const empty = layoutCanvas(showView(tree, opened(view))).find((drawn) => drawn.kind === 'empty')
    if (empty?.kind !== 'empty') throw new Error('No free slot is drawn')
    return empty.slot
  }

  it('opens the new Tile there, or an import into it', () => {
    const { result, onSearchChange } = render()
    const slot = slotOf()
    const menu = result.current.acting.slot(slot)
    expect(menu?.subject).toEqual({ kind: 'slot', at: slot.direction, parent: 'Me' })
    act(() => {
      menu?.onAct({ verb: 'new-tile' }, '')
    })
    expect(changed(onSearchChange)).toMatchObject({ add: 'root', slot: { leaf: slot.direction } })
    act(() => {
      menu?.onAct({ verb: 'import' }, '')
    })
    expect(changed(onSearchChange)).toMatchObject({ import: 'root', slot: slot.direction })
  })

  it('asks the agent for one there, naming the Tile it would go under and the place', () => {
    const { result, onAsk, onSearchChange } = render()
    const slot = slotOf()
    act(() => {
      result.current.acting.slot(slot)?.onAct({ verb: 'ask-agent' }, '')
    })
    expect(onAsk).toHaveBeenCalledExactlyOnceWith('root', slot.direction)
    expect(onSearchChange).not.toHaveBeenCalled()
  })
})

describe("a Tile's agent line", () => {
  it('asks the agent about the Tile through the chat, the URL left as it is', () => {
    const { result, onAsk, onSearchChange } = render()
    choose(result, 'tile:holding', { verb: 'ask-agent' })
    expect(onAsk).toHaveBeenCalledExactlyOnceWith('holding')
    expect(onSearchChange).not.toHaveBeenCalled()
  })

  it("is in a Tile's menu, the Root's too", () => {
    const { result } = render()
    expect(result.current.acting.tile(hex('tile:root'))?.without).not.toContain('ask-agent')
    expect(result.current.acting.tile(hex('tile:holding'))?.without).not.toContain('ask-agent')
  })
})

describe('a click on a free slot', () => {
  const free = (view: CanvasView = {}) =>
    layoutCanvas(showView(tree, opened(view))).flatMap((drawn) =>
      drawn.kind === 'empty' ? [drawn.slot] : [],
    )

  it("opens the new Tile's form there, named for its ring", () => {
    const { result, onSearchChange } = render()
    const [slot] = free()
    const click = slot && result.current.emptySlots(slot)
    expect(click?.label).toBe(m.system_add_child({ title: 'Me' }))
    act(() => {
      click?.onSelect()
    })
    expect(changed(onSearchChange)).toMatchObject({
      add: 'root',
      slot: { leaf: slot?.direction },
    })
  })

  it('moves the Tile on the move there, ending the move as it is sent', async () => {
    answering('moveTile', done)
    const { result, onSearchChange } = render({ move: 'bare' })
    const [slot] = free()
    act(() => {
      if (slot) result.current.emptySlots(slot)?.onSelect()
    })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'bare', version: 1, parent: 'root', slot: slot?.direction },
      })
    })
    expect(changed(onSearchChange, { move: 'bare' })).toMatchObject({ move: undefined })
  })

  it('takes no Tile where Mapping would refuse the move: under itself', () => {
    const { result } = render({ move: 'holding', center: 'holding' })
    expect(free({ center: 'holding' }).map((slot) => result.current.emptySlots(slot))).toEqual(
      free({ center: 'holding' }).map(() => undefined),
    )
  })
})

describe('a move under way', () => {
  it('names the Tile on the move, starts on a drag and stops', () => {
    const { result, onSearchChange } = render({ move: 'bare' })
    expect(result.current.move.moving).toMatchObject({ id: 'bare', title: 'bare' })
    act(() => {
      result.current.move.stop()
    })
    expect(changed(onSearchChange)).toMatchObject({ move: undefined })
    act(() => {
      result.current.move.start('holding')
    })
    expect(changed(onSearchChange)).toMatchObject({ move: 'holding' })
  })

  it('is no move for a Tile gone: the free slots add a Tile', () => {
    const { result } = render({ move: 'gone' })
    expect(result.current.move.moving).toBeUndefined()
  })

  it('swaps with a Branch, and lands in a free slot, each ending the move as it is sent', async () => {
    answering('swapTiles', done)
    const { result, onSearchChange } = render({ move: 'bare' })
    const swap = result.current.move.moving?.swapTargets(hex('tile:holding').tile)
    expect(swap?.label).toBe(m.system_swap_with({ title: 'holding' }))
    act(() => {
      swap?.onSelect()
    })
    await waitFor(() => {
      expect(Mapping.swapTiles).toHaveBeenCalledOnce()
    })
    expect(changed(onSearchChange, { move: 'bare' })).toMatchObject({ move: undefined })
  })
})

describe("on a System only looked at, someone else's", () => {
  const free = (view: CanvasView = {}) =>
    layoutCanvas(showView(tree, opened(view))).flatMap((drawn) =>
      drawn.kind === 'empty' ? [drawn.slot] : [],
    )

  it('offers no free slot a click, nor a menu', () => {
    const { result } = render({}, { reach: 'looking' })
    const slots = free()
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      expect(result.current.emptySlots(slot)).toBeUndefined()
      expect(result.current.acting.slot(slot)).toBeUndefined()
    }
  })

  it("leaves every line that acts out of a Tile's menu, Copy aside", () => {
    const { result } = render({}, { reach: 'looking' })
    const without = result.current.acting.tile(hex('tile:holding'))?.without
    expect(without).toEqual(expect.arrayContaining(['edit', 'move', 'delete', 'add', 'ask-agent']))
    expect(without).not.toContain('copy')
  })

  it('is no move, as a link may name one', () => {
    const { result } = render({ move: 'bare' }, { reach: 'looking' })
    expect(result.current.move.moving).toBeUndefined()
    expect(free().map((slot) => result.current.emptySlots(slot))).toEqual(
      free().map(() => undefined),
    )
  })
})
